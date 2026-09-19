import type { CalendarDate } from '../dates/calendar-date'
import { isAfter } from '../dates/calendar-date'
import { validationError, type ValidationError } from '../errors/app-error'
import { err, ok, type Result } from '../result'
import type { LedgerEntryInput } from './types'

/**
 * The longest note an entry may carry.
 *
 * Long enough for the sentence a user writes to remind themselves what a contribution was,
 * short enough that the history list stays a list rather than a wall. Matches the column
 * the data model declares, so a note the domain accepts is one the database will store.
 */
export const MAXIMUM_NOTE_LENGTH = 280

/**
 * What the rules need to know beyond the entry itself.
 *
 * Passed in rather than read, because the domain has no clock and no repository — that is
 * what keeps these rules pure and testable without standing anything up. The caller holds
 * both: `today` comes from the `Clock` port, `hasOpening` from the ledger it is writing to.
 */
export interface EntryContext {
  /** The current date, against which a future-dated entry is refused (FR-009). */
  readonly today: CalendarDate
  /** Whether the fund already has its opening balance (FR-010). */
  readonly hasOpening: boolean
}

/**
 * Checks an entry against every rule that governs what may enter the ledger.
 *
 * Here rather than in the form, because an entry also arrives from an imported file
 * (FR-046), where no form has been anywhere near it. A rule enforced only by the screen is
 * a rule the import path does not have.
 *
 * Withdrawal-specific rules — that a withdrawal carries a reason (FR-016), and the
 * over-balance confirmation (FR-017) — are not here. They need the balance, which is a
 * question about the whole ledger rather than about one entry, and they arrive with User
 * Story 5.
 *
 * @param entry The entry to check.
 * @param context What the rules need beyond the entry — see {@link EntryContext}.
 * @returns The entry unchanged, or the first rule it broke, naming the field to blame.
 */
export function validateEntry(
  entry: LedgerEntryInput,
  context: EntryContext,
): Result<LedgerEntryInput, ValidationError> {
  // Ordered as the user would correct them: the amount is the reason the entry exists, the
  // date is what they chose next, and the note is an afterthought. Reporting the note first
  // would send someone to fix the least important thing about a row that is wrong anyway.
  if (entry.amount <= 0) {
    return err(validationError('amount', 'entry.amount-must-be-positive'))
  }
  if (isAfter(entry.date, context.today)) {
    return err(validationError('date', 'entry.date-in-future'))
  }
  if (entry.note !== null && entry.note.length > MAXIMUM_NOTE_LENGTH) {
    return err(validationError('note', 'entry.note-too-long'))
  }
  if (entry.type === 'opening' && context.hasOpening) {
    return err(validationError('type', 'entry.opening-already-exists'))
  }
  return ok(entry)
}
