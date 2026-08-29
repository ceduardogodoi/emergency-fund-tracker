import { validationError } from '../errors/app-error'
import { money, type Money } from '../money/money'
import { err, ok, type Result } from '../result'
import { MAXIMUM_COVERAGE_MONTHS, MINIMUM_COVERAGE_MONTHS } from './levels'

/**
 * The edge where a number becomes a domain value.
 *
 * Each validator takes a plain `number` of minor units rather than a `Money`. `money()`
 * throws on anything that is not a whole, safe integer, so a validator taking `Money`
 * could only ever be handed values that had already passed the check it exists to perform
 * — the rejection would have happened as an exception, somewhere else, with no message for
 * the user. A `Money` is still accepted here, since the brand is a `number`.
 *
 * Two entry paths reach these: a screen, where `MoneyInput` has already stripped anything
 * that is not a digit, and an imported file (FR-046), where nothing has. Both must be
 * rejected the same way, which is why "not a number" is a case rather than an assumption.
 */

/**
 * Checks the user's average monthly essential expenses (FR-001).
 *
 * @param minorUnits The entered amount, in minor units.
 * @returns The amount as `Money`, or a validation failure naming the field.
 */
export function validateMonthlyExpenses(minorUnits: number): Result<Money> {
  if (!isWholeUnits(minorUnits)) {
    return err(validationError('monthlyExpenses', 'goal.expenses-not-a-number'))
  }
  if (minorUnits <= 0) {
    return err(validationError('monthlyExpenses', 'goal.expenses-must-be-positive'))
  }
  return ok(money(minorUnits))
}

/**
 * Checks a coverage duration against the 1–24 month range FR-002 permits.
 *
 * A fraction is reported separately from a duration out of range, because the two need
 * different corrections and "between 1 and 24" is unhelpful advice to someone who typed
 * 6.5.
 *
 * @param months The chosen or entered number of months.
 * @returns The duration, or a validation failure naming the field.
 */
export function validateCoverageMonths(months: number): Result<number> {
  if (!Number.isInteger(months)) {
    return err(validationError('coverageMonths', 'goal.coverage-not-a-whole-number'))
  }
  if (months < MINIMUM_COVERAGE_MONTHS || months > MAXIMUM_COVERAGE_MONTHS) {
    return err(validationError('coverageMonths', 'goal.coverage-out-of-range'))
  }
  return ok(months)
}

/**
 * Checks a target amount (FR-005).
 *
 * Applies to the manual override in particular: a calculated target is the product of two
 * already-validated figures, but a typed one is the only path that can produce a zero, and
 * a fund with nothing to reach is not a fund.
 *
 * @param minorUnits The entered target, in minor units.
 * @returns The target as `Money`, or a validation failure naming the field.
 */
export function validateTarget(minorUnits: number): Result<Money> {
  if (!isWholeUnits(minorUnits)) {
    return err(validationError('target', 'goal.target-not-a-number'))
  }
  if (minorUnits <= 0) {
    return err(validationError('target', 'goal.target-must-be-positive'))
  }
  return ok(money(minorUnits))
}

/**
 * Whether a number is something `money()` will accept.
 *
 * `Number.isSafeInteger` covers all four rejections at once — NaN, infinity, a fraction of
 * a minor unit, and a magnitude past exact integer precision — which is the same set
 * `money()` throws on, checked here where there is still a message to give the user.
 */
function isWholeUnits(value: number): boolean {
  return Number.isSafeInteger(value)
}
