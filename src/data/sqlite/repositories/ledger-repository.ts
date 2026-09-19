import type { CalendarDate } from '@/domain/dates/calendar-date'
import { notFoundError } from '@/domain/errors/app-error'
import type {
  DateRange,
  LedgerEntry,
  LedgerEntryInput,
  LedgerEntryPatch,
} from '@/domain/ledger/types'
import type { Clock } from '@/domain/ports/clock'
import type { IdGenerator } from '@/domain/ports/id-generator'
import type { LedgerRepository } from '@/domain/ports/repositories'
import { err, isErr, ok, type Result } from '@/domain/result'

import type { SqliteDatabase, SqlValue } from '../driver'
import { toLedgerEntry, type LedgerEntryRow } from '../mappers/ledger'
import { attempt } from './attempt'

/** Every column the mapper needs, named so the row shape cannot drift from the query. */
const COLUMNS = `
  id, type, amount_minor, entry_date, note, withdrawal_reason, created_at, updated_at
`

const INSERT = `
  INSERT INTO ledger_entry (
    id, type, amount_minor, entry_date, note, withdrawal_reason, created_at, updated_at
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`

const SELECT_BY_ID = `SELECT ${COLUMNS} FROM ledger_entry WHERE id = ?`

/**
 * The history, oldest first (FR-014).
 *
 * `created_at` breaks the tie, then `rowid` breaks that. Several entries can share a date —
 * that is the ordinary case, not an edge one — and a test clock gives them the same audit
 * instant too, at which point insertion order is the only thing left that means anything.
 * Without the tiebreaks SQLite is free to return equal rows in any order it likes, and the
 * order changes with the query plan; the date index alone would be enough to disturb it.
 */
const SELECT_ALL = `
  SELECT ${COLUMNS} FROM ledger_entry ORDER BY entry_date ASC, created_at ASC, rowid ASC
`

/** The same history, scoped to an inclusive window (FR-023). */
const SELECT_IN_RANGE = `
  SELECT ${COLUMNS} FROM ledger_entry
  WHERE entry_date >= ? AND entry_date <= ?
  ORDER BY entry_date ASC, created_at ASC, rowid ASC
`

/** Entries dated past today, which every calculation excludes and the user must correct. */
const SELECT_FUTURE_DATED = `
  SELECT ${COLUMNS} FROM ledger_entry
  WHERE entry_date > ?
  ORDER BY entry_date ASC, created_at ASC, rowid ASC
`

const DELETE_BY_ID = `DELETE FROM ledger_entry WHERE id = ?`

/**
 * Builds the SQLite-backed {@link LedgerRepository}.
 *
 * The ledger is the fund's only source of truth: the balance, every statistic, and the
 * forecast are derived from these rows and none of them is stored. That is why nothing here
 * writes a total — there is no total to keep correct.
 *
 * @param db The open database.
 * @param clock Supplies the audit timestamps, never taken from the caller.
 * @param ids Supplies entry identifiers, which are preserved across export and import so
 *   that merge deduplication is exact rather than heuristic (FR-047).
 * @returns The repository.
 */
export function createLedgerRepository(
  db: SqliteDatabase,
  clock: Clock,
  ids: IdGenerator,
): LedgerRepository {
  return { ...createWrites(db, clock, ids), ...createReads(db) }
}

/**
 * The three operations that change the ledger.
 *
 * Split from the reads because the port carries both, and one factory holding all six is
 * long enough that the boundary between what observes the fund and what alters it stops
 * being visible — the same reason `goal-repository.ts` separates the goal from its log.
 */
function createWrites(
  db: SqliteDatabase,
  clock: Clock,
  ids: IdGenerator,
): Pick<LedgerRepository, 'add' | 'update' | 'remove'> {
  return {
    async add(entry: LedgerEntryInput): Promise<Result<LedgerEntry>> {
      return attempt('ledger.add-failed', async () => {
        const now = clock.now()
        const stored: LedgerEntry = { ...entry, id: ids.uuid(), createdAt: now, updatedAt: now }

        await db.run(INSERT, insertBindings(stored))
        return stored
      })
    },

    async update(id: string, patch: LedgerEntryPatch): Promise<Result<LedgerEntry>> {
      const existing = await requireExisting(db, id)
      if (isErr(existing)) {
        return existing
      }

      const updated = applyPatch(existing.value, patch, clock.now())
      return attempt('ledger.update-failed', async () => {
        await db.run(UPDATE_BY_ID, updateBindings(updated, id))
        return updated
      })
    },

    async remove(id: string): Promise<Result<void>> {
      const existing = await requireExisting(db, id)
      if (isErr(existing)) {
        return existing
      }
      return attempt('ledger.remove-failed', async () => {
        await db.run(DELETE_BY_ID, [id])
      })
    },
  }
}

/** The three that only observe it. */
function createReads(
  db: SqliteDatabase,
): Pick<LedgerRepository, 'getById' | 'list' | 'listFutureDated'> {
  return {
    async getById(id: string): Promise<Result<LedgerEntry | null>> {
      return findById(db, id)
    },

    async list(range?: DateRange): Promise<Result<readonly LedgerEntry[]>> {
      return attempt('ledger.list-failed', async () => {
        const rows =
          range === undefined
            ? await db.selectAll<LedgerEntryRow>(SELECT_ALL)
            : await db.selectAll<LedgerEntryRow>(SELECT_IN_RANGE, [range.from, range.to])
        return rows.map(toLedgerEntry)
      })
    },

    async listFutureDated(today: CalendarDate): Promise<Result<readonly LedgerEntry[]>> {
      return attempt('ledger.list-future-failed', async () => {
        const rows = await db.selectAll<LedgerEntryRow>(SELECT_FUTURE_DATED, [today])
        return rows.map(toLedgerEntry)
      })
    },
  }
}

/**
 * Every field an edit may change (FR-011), and no others.
 *
 * `id` and `type` are absent deliberately: changing an entry's type means deleting it and
 * creating the other kind, which keeps the identity in FR-047 stable — an id must always
 * refer to the same movement.
 */
const UPDATE_BY_ID = `
  UPDATE ledger_entry
  SET amount_minor = ?, entry_date = ?, note = ?, withdrawal_reason = ?, updated_at = ?
  WHERE id = ?
`

/**
 * The insert's bindings, in the order {@link INSERT} names its columns.
 *
 * Beside the statement rather than inline at the call site, because the only thing keeping
 * a positional bind list correct is that someone reads both at once.
 */
function insertBindings(entry: LedgerEntry): readonly SqlValue[] {
  return [
    entry.id,
    entry.type,
    entry.amount,
    entry.date,
    entry.note,
    entry.withdrawalReason,
    entry.createdAt,
    entry.updatedAt,
  ]
}

/** The update's bindings, in the order {@link UPDATE_BY_ID} names its assignments. */
function updateBindings(entry: LedgerEntry, id: string): readonly SqlValue[] {
  return [entry.amount, entry.date, entry.note, entry.withdrawalReason, entry.updatedAt, id]
}

/**
 * Reads one entry, insisting it exists.
 *
 * `update` and `remove` both need this, and both need it for the same reason: an UPDATE or
 * DELETE matching no rows succeeds as far as SQLite is concerned, so without the read the
 * caller would be told an edit landed that never did. A not-found rather than a storage
 * failure, because an unknown id is the caller's mistake and the screen's answer to it —
 * the entry was deleted elsewhere — is not "try again".
 */
async function requireExisting(db: SqliteDatabase, id: string): Promise<Result<LedgerEntry>> {
  const existing = await findById(db, id)
  if (isErr(existing)) {
    return existing
  }
  return existing.value === null ? err(notFoundError('ledger-entry')) : ok(existing.value)
}

/** Reads one entry, or null when no entry has that id. */
async function findById(db: SqliteDatabase, id: string): Promise<Result<LedgerEntry | null>> {
  return attempt('ledger.read-failed', async () => {
    const row = await db.selectOne<LedgerEntryRow>(SELECT_BY_ID, [id])
    return row === null ? null : toLedgerEntry(row)
  })
}

/**
 * Applies the fields a patch carries, leaving the rest as they were.
 *
 * `in` rather than a truthiness or `undefined` check, because `null` is a value a patch may
 * legitimately carry: it is how a note is cleared, and `patch.note ?? existing.note` would
 * quietly refuse to clear one. `in` alone is enough — `tsconfig` sets
 * `exactOptionalPropertyTypes`, so a key that is present holds a defined value, and
 * guarding for `undefined` as well would be a branch nothing could reach.
 */
function applyPatch(
  existing: LedgerEntry,
  patch: LedgerEntryPatch,
  updatedAt: LedgerEntry['updatedAt'],
): LedgerEntry {
  return {
    ...existing,
    ...('amount' in patch ? { amount: patch.amount } : {}),
    ...('date' in patch ? { date: patch.date } : {}),
    ...('note' in patch ? { note: patch.note } : {}),
    ...('withdrawalReason' in patch ? { withdrawalReason: patch.withdrawalReason } : {}),
    updatedAt,
  }
}
