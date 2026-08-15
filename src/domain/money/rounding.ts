import { money, type Money } from './money'

/**
 * The single home for every division in this codebase. The constitution requires the
 * rounding policy to be defined once, centrally, and covered by tests.
 *
 * Two rules, chosen so the app is never optimistic about the user's position:
 *   - amounts derived by division round DOWN, so it never overstates saving
 *   - month counts derived by division round UP, so it never promises an early date
 *
 * Division appears in exactly four places — average monthly contribution, saving pace,
 * months to target, and required monthly contribution — and all four route through here.
 */

/** Divides an amount, rounding down. Floor, not truncation: -999.5 becomes -1_000. */
export function divideToAmount(total: Money, divisor: number): Money {
  if (divisor === 0) {
    throw new RangeError('Cannot divide an amount by zero')
  }
  if (!Number.isInteger(divisor)) {
    throw new RangeError(`Divisor must be a whole number, received ${divisor}`)
  }
  return money(Math.floor(total / divisor))
}

/**
 * How many whole months are needed to cover `remaining` at `perMonth`.
 * Rounds up, because a partial month still requires that month's saving.
 */
export function divideToWholeMonths(remaining: Money, perMonth: Money): number {
  if (perMonth <= 0) {
    throw new RangeError('Cannot project months at a pace of zero or less')
  }
  if (remaining <= 0) {
    return 0
  }
  return Math.ceil(remaining / perMonth)
}

/**
 * Progress as a percentage, for display only. Clamped to 0–100 so a surplus renders as
 * a reached goal rather than 130%, and never returns NaN.
 */
export function percentOf(part: Money, whole: Money): number {
  if (whole <= 0) {
    return 0
  }
  const raw = (part / whole) * 100
  const clamped = Math.min(100, Math.max(0, raw))
  return Math.round(clamped * 100) / 100
}
