import { validationError } from '../errors/app-error'
import { multiply, type Money } from '../money/money'
import { err, ok, type Result } from '../result'
import type { GoalInput } from './types'

/**
 * The target: monthly essential expenses times the months of coverage (FR-004).
 *
 * Arithmetic only. Whether the coverage is a legal choice is `validateCoverageMonths`'s
 * question, asked before this is called — answering it here as well would put the range
 * in two places, and two copies of a rule are two rules waiting to disagree.
 *
 * @param monthlyExpenses The user's average monthly essentials, in minor units.
 * @param coverageMonths Whole months of coverage.
 * @returns The target amount.
 * @throws {RangeError} If `coverageMonths` is not a whole number. Fractional coverage
 *   would reintroduce the rounding FR-038 forbids, and there is no user input that can
 *   produce it — reaching this is a programmer error, not a rejected entry.
 */
export function calculateTarget(monthlyExpenses: Money, coverageMonths: number): Money {
  return multiply(monthlyExpenses, coverageMonths)
}

/**
 * Checks that a calculated target still equals the figures it was derived from.
 *
 * A mismatch is rejected rather than recalculated. The two figures disagree because a file
 * was hand-edited (fund-export-v1) or because a write went wrong, and guessing which of
 * them the author meant would be a fabrication presented as the user's own number.
 *
 * A `user_defined` target is exempt: FR-005 exists to let the user name a figure that is
 * not the product, so holding an overridden target to the product would make override
 * impossible.
 *
 * @param goal The goal to check.
 * @param monthlyExpenses The expenses the target should have been derived from.
 * @returns The goal unchanged, or a validation failure naming the target field.
 */
export function validateCalculatedTarget(
  goal: GoalInput,
  monthlyExpenses: Money,
): Result<GoalInput> {
  if (goal.source !== 'calculated') {
    return ok(goal)
  }
  if (goal.target !== calculateTarget(monthlyExpenses, goal.coverageMonths)) {
    return err(validationError('target', 'goal.target-does-not-match'))
  }
  return ok(goal)
}
