import type { CalendarDate } from '../dates/calendar-date'
import type { Repositories } from '../ports/repositories'
import { isErr, ok, type Result } from '../result'
import { validateEntry } from './entry'
import type { LedgerEntry, LedgerEntryInput } from './types'

/**
 * Checks an entry against the rules and writes it.
 *
 * A domain operation rather than two calls at the call site, for the reason `submitGoal` is
 * one: the interesting part is a decision that needs both the entry and what is already
 * stored. Only the ledger knows whether an opening exists, and only the rules know that a
 * second one is refused — leaving the sequence to the feature layer would put a domain rule
 * in the one place the import path (FR-046) does not go through.
 *
 * The schema enforces the same constraint with a partial unique index, and that stays the
 * backstop. What this adds is the difference between a rejection a screen can render — a
 * validation failure naming the field — and an opaque storage error from a driver.
 *
 * @param repositories The repository set for the current transaction.
 * @param entry What the user or an import supplied.
 * @param today From the `Clock` port, never `new Date()`.
 * @returns The stored entry, or the first rule it broke.
 */
export async function recordEntry(
  repositories: Repositories,
  entry: LedgerEntryInput,
  today: CalendarDate,
): Promise<Result<LedgerEntry>> {
  const hasOpening = await findOpening(repositories, entry)
  if (isErr(hasOpening)) {
    return hasOpening
  }

  const validated = validateEntry(entry, { today, hasOpening: hasOpening.value })
  if (isErr(validated)) {
    return validated
  }
  return repositories.ledger.add(validated.value)
}

/**
 * Whether an opening balance is already stored.
 *
 * Only asked when the entry being written is itself an opening. Every other entry is
 * unaffected by the answer, and a contribution is the common case — reading the whole
 * ledger to establish something irrelevant to it would put a scan on the path a user takes
 * most often.
 */
async function findOpening(
  repositories: Repositories,
  entry: LedgerEntryInput,
): Promise<Result<boolean>> {
  if (entry.type !== 'opening') {
    return ok(false)
  }
  const stored = await repositories.ledger.list()
  if (isErr(stored)) {
    return stored
  }
  return ok(stored.value.some((existing) => existing.type === 'opening'))
}
