import {
  overBalanceError,
  validationError,
  type OverBalanceError,
  type ValidationError,
} from '../errors/app-error'
import { subtract, type Money } from '../money/money'
import { err, ok, type Result } from '../result'
import type { LedgerEntryInput } from './types'

/**
 * The reasons a withdrawal can be given from a list (FR-016), as the keys they are stored
 * under — chosen with the user on 2026-11-01.
 *
 * Stored as keys rather than as their labels, so an export carries no language and a label
 * can be reworded without orphaning the entries that used it. `car-repair` is the key the
 * export contract's own example stores. A reason the user writes is stored as written.
 */
export const WITHDRAWAL_REASONS = [
  'medical',
  'car-repair',
  'home-repair',
  'income-loss',
  'family',
] as const

/** One of the {@link WITHDRAWAL_REASONS}. */
export type WithdrawalReasonKey = (typeof WITHDRAWAL_REASONS)[number]

/**
 * The longest reason a user may write.
 *
 * The note's limit, for the note's reason: the history shows it under the entry, and a
 * paragraph there turns the list into a wall.
 */
export const MAXIMUM_REASON_LENGTH = 280

/**
 * Whether a stored reason is one of the predefined keys, rather than the user's own words.
 *
 * Matched whole and exactly. A user who writes "car-repair" gets the predefined reason's
 * label shown back, which says the same thing.
 *
 * @param reason A stored withdrawal reason.
 * @returns True when it is a key from {@link WITHDRAWAL_REASONS}.
 */
export function isWithdrawalReasonKey(reason: string): reason is WithdrawalReasonKey {
  return (WITHDRAWAL_REASONS as readonly string[]).includes(reason)
}

/**
 * Checks where a reason may be, and what it may be (FR-016).
 *
 * A withdrawal must say why it was made, in something other than blank space; nothing else
 * may carry a reason. The schema refuses the second with a CHECK, and this is the refusal a
 * form or an import can report against a field.
 *
 * @param entry The entry to check.
 * @returns The entry unchanged, or the rule broken, on the `reason` field.
 */
export function validateWithdrawalReason(
  entry: LedgerEntryInput,
): Result<LedgerEntryInput, ValidationError> {
  const reason = entry.withdrawalReason
  if (entry.type !== 'withdrawal') {
    return reason === null ? ok(entry) : err(validationError('reason', 'entry.reason-not-allowed'))
  }
  if (reason === null || reason.trim() === '') {
    return err(validationError('reason', 'entry.reason-required'))
  }
  if (reason.length > MAXIMUM_REASON_LENGTH) {
    return err(validationError('reason', 'entry.reason-too-long'))
  }
  return ok(entry)
}

/**
 * Whether a withdrawal fits in the balance (FR-017).
 *
 * Exactly the balance fits: emptying the fund is what it is for. Anything more is refused
 * here, to be asked about rather than forbidden — the user may know of money the ledger does
 * not, and the balance is allowed below zero.
 *
 * @param amount The withdrawal, above zero.
 * @param balance The balance as of today, which may already be zero or below.
 * @returns Nothing when it fits, or the refusal stating the balance and how far below zero
 *   the withdrawal would take it.
 */
export function assessWithdrawal(amount: Money, balance: Money): Result<void, OverBalanceError> {
  if (amount <= balance) {
    return ok(undefined)
  }
  return err(overBalanceError(balance, subtract(amount, balance)))
}
