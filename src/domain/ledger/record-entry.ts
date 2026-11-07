import type { CalendarDate } from '../dates/calendar-date'
import type { Repositories } from '../ports/repositories'
import { isErr, ok, type Result } from '../result'
import { calculateBalance } from './balance'
import { validateEntry } from './entry'
import type { LedgerEntry, LedgerEntryInput } from './types'
import { assessWithdrawal } from './withdrawal'

/** What the user has already agreed to, for an entry that needed asking about. */
export interface RecordOptions {
  /**
   * The user has seen that this withdrawal is larger than the balance, and confirmed it
   * (FR-017). Without it such a withdrawal is refused, as a question.
   */
  readonly overBalanceConfirmed: boolean
}

/** Nothing confirmed: the default for every entry that does not need asking about. */
const UNCONFIRMED: RecordOptions = { overBalanceConfirmed: false }

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
 * A withdrawal larger than the balance is refused unless {@link RecordOptions} says it was
 * confirmed (FR-017). Measured here, against the entries in storage, rather than by the
 * screen against its cache: the question is then asked about the balance the withdrawal is
 * actually taken from.
 *
 * @param repositories The repository set for the current transaction.
 * @param entry What the user or an import supplied.
 * @param today From the `Clock` port, never `new Date()`.
 * @param options What the user has already confirmed. Nothing, by default.
 * @returns The stored entry, the first rule it broke, or an `over-balance` refusal for the
 *   screen to ask about.
 */
export async function recordEntry(
  repositories: Repositories,
  entry: LedgerEntryInput,
  today: CalendarDate,
  options: RecordOptions = UNCONFIRMED,
): Promise<Result<LedgerEntry>> {
  const stored = await readLedger(repositories, entry)
  if (isErr(stored)) {
    return stored
  }
  const existing = stored.value

  const validated = validateEntry(entry, {
    today,
    hasOpening: existing.some((recorded) => recorded.type === 'opening'),
  })
  if (isErr(validated)) {
    return validated
  }
  if (entry.type === 'withdrawal' && !options.overBalanceConfirmed) {
    const assessed = assessWithdrawal(entry.amount, calculateBalance(existing, today))
    if (isErr(assessed)) {
      return assessed
    }
  }
  return repositories.ledger.add(validated.value)
}

/**
 * The ledger as stored, when the entry's rules need it.
 *
 * An opening needs it to know whether one exists, and a withdrawal to know the balance.
 * A contribution needs neither, and it is the common case — reading the whole ledger to
 * establish something irrelevant to it would put a scan on the path a user takes most often.
 * For a contribution this is an empty list, which answers both questions the way that
 * leaves it alone.
 */
async function readLedger(
  repositories: Repositories,
  entry: LedgerEntryInput,
): Promise<Result<readonly LedgerEntry[]>> {
  if (entry.type === 'contribution') {
    return ok([])
  }
  return repositories.ledger.list()
}
