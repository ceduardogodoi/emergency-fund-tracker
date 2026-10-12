import type { CalendarDate } from '../dates/calendar-date'
import { notFoundError } from '../errors/app-error'
import type { Repositories } from '../ports/repositories'
import { err, isErr, type Result } from '../result'
import { validateEntry } from './entry'
import type { LedgerEntry, LedgerEntryInput, LedgerEntryPatch } from './types'

/**
 * Checks a correction against the rules and writes it (FR-011).
 *
 * The counterpart of `recordEntry`, and a domain operation for the same reason: an edit
 * that went straight to the repository would be a way around every rule a new entry is held
 * to. An amount could be corrected to zero, or a date to next week, by any screen that
 * offered a form.
 *
 * What is checked is the entry as it would be stored, the patch laid over what is there. A
 * patch alone is a fragment: one that changes only the amount has no date to be late, and
 * an entry already dated ahead (FR-033) would stay that way through any edit that did not
 * happen to touch its date.
 *
 * @param repositories The repository set for the current transaction.
 * @param id The entry being corrected.
 * @param patch The fields to change. Absent fields are left alone; `null` clears a note.
 * @param today From the `Clock` port, never `new Date()`.
 * @returns The stored entry, the first rule the correction broke, or a not-found error.
 */
export async function reviseEntry(
  repositories: Repositories,
  id: string,
  patch: LedgerEntryPatch,
  today: CalendarDate,
): Promise<Result<LedgerEntry>> {
  const stored = await repositories.ledger.getById(id)
  if (isErr(stored)) {
    return stored
  }
  if (stored.value === null) {
    return err(notFoundError('ledger-entry'))
  }

  // An entry's type cannot change, so an opening being corrected is the one that exists
  // and the rule against a second has nothing to refuse.
  const validated = validateEntry(revised(stored.value, patch), { today, hasOpening: false })
  if (isErr(validated)) {
    return validated
  }
  return repositories.ledger.update(id, patch)
}

/**
 * The entry as the patch would leave it, in the shape the rules read.
 *
 * `note` is compared with `undefined` rather than defaulted with `??`: null is a value
 * here, the one that clears a note, and `??` would read it as "left alone".
 */
function revised(stored: LedgerEntry, patch: LedgerEntryPatch): LedgerEntryInput {
  return {
    type: stored.type,
    amount: patch.amount ?? stored.amount,
    date: patch.date ?? stored.date,
    note: patch.note === undefined ? stored.note : patch.note,
    withdrawalReason: stored.withdrawalReason,
  }
}
