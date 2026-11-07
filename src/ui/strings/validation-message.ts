import type { ValidationError } from '@/domain/errors'
import { MAXIMUM_COVERAGE_MONTHS, MINIMUM_COVERAGE_MONTHS } from '@/domain/goal/levels'
import { MAXIMUM_DAY_OF_MONTH } from '@/domain/reminders/schedule'
import { strings } from './strings'

/**
 * What each rejection reads as, keyed by the domain's message key.
 *
 * The domain reports keys rather than prose so it holds no opinion about language; this is
 * the one place that opinion is applied. Two keys share a message because "not a number"
 * is the same problem whichever amount it happened to, and the coverage message is built
 * from the bounds themselves rather than naming them again — a sentence that restated
 * "1 e 24" would keep saying so after the constant changed.
 */
const MESSAGES: Readonly<Record<string, string>> = {
  'goal.expenses-not-a-number': strings.validation.amountNotANumber,
  'goal.expenses-must-be-positive': strings.validation.expensesMustBePositive,
  'goal.coverage-not-a-whole-number': strings.validation.coverageNotAWholeNumber,
  'goal.coverage-out-of-range': strings.coverageRangeError(
    MINIMUM_COVERAGE_MONTHS,
    MAXIMUM_COVERAGE_MONTHS,
  ),
  'goal.target-not-a-number': strings.validation.amountNotANumber,
  'goal.target-must-be-positive': strings.validation.targetMustBePositive,
  'goal.target-does-not-match': strings.validation.targetDoesNotMatch,
  'goal.desired-date-not-ahead': strings.validation.desiredDateNotAhead,
  'entry.amount-must-be-positive': strings.validation.entryAmountMustBePositive,
  'entry.date-in-future': strings.validation.entryDateInFuture,
  'entry.note-too-long': strings.validation.entryNoteTooLong,
  'entry.opening-already-exists': strings.validation.entryOpeningAlreadyExists,
  'entry.reason-required': strings.validation.entryReasonRequired,
  'entry.reason-too-long': strings.validation.entryReasonTooLong,
  'entry.reason-not-allowed': strings.validation.entryReasonNotAllowed,
  'reminder.day-of-month-out-of-range':
    strings.validation.reminderDayOfMonthOutOfRange(MAXIMUM_DAY_OF_MONTH),
  'reminder.day-of-week-out-of-range': strings.validation.reminderDayOfWeekOutOfRange,
  'reminder.day-not-for-frequency': strings.validation.reminderDayNotForFrequency,
  'reminder.time-invalid': strings.validation.reminderTimeInvalid,
}

/**
 * Turns a rejected value into the sentence shown under the field (FR-052).
 *
 * Falls back to a general message rather than showing the key: a key is a string the user
 * can do nothing with, and an unmapped one still has to say that this field is the problem
 * — silence would leave a form that refuses to submit and never says why.
 *
 * @param error The validation failure, as the domain reported it.
 * @returns The message to show under the field.
 */
export function validationMessage(error: ValidationError): string {
  return MESSAGES[error.messageKey] ?? strings.validation.unknown
}

/**
 * The message a form shows under one field — the refusal's, if that field was refused.
 *
 * One refusal names one field, and every other field has to stay quiet about it: repeated
 * under the wrong input, a message sends the user to correct something that is fine.
 *
 * @param rejected What the last submission refused, or null when nothing was.
 * @param field The field asking, by the name the domain reports.
 * @returns The message to show under it, or undefined when it has nothing to say.
 */
export function fieldMessage(rejected: ValidationError | null, field: string): string | undefined {
  return rejected !== null && rejected.field === field ? validationMessage(rejected) : undefined
}
