import type { Money } from '../money/money'
import { wholeMonthsCovered } from '../money/rounding'

/**
 * How many months of the plan the balance covers, as Home's meter fills it.
 *
 * Measured in months of the stored expenses rather than as a share of the target, because
 * the meter's unit is time — "how long could I live on this". The two agree for a
 * calculated target and part ways for one the user typed, and the meter answers the
 * question it draws.
 *
 * Capped at the plan. A fund past its target covers more months than the meter has units,
 * and the caption states both numbers, so the count stops where the plan does rather than
 * reading "8 de 6 meses".
 *
 * @param balance The current balance, which may be negative after a withdrawal.
 * @param monthlyExpenses The stored monthly expenses, always above zero.
 * @param plannedMonths The months of cover the goal is sized for.
 * @returns Whole months covered, from zero to `plannedMonths`.
 * @throws {RangeError} When `monthlyExpenses` is zero or less, which validation forbids.
 */
export function coveredMonths(
  balance: Money,
  monthlyExpenses: Money,
  plannedMonths: number,
): number {
  return Math.min(wholeMonthsCovered(balance, monthlyExpenses), plannedMonths)
}
