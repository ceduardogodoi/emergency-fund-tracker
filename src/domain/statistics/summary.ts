import { monthKey, type CalendarDate, type MonthKey } from '../dates/calendar-date'
import type { EntryType, LedgerEntry } from '../ledger/types'
import { maxOf, subtract, sum, type Money } from '../money/money'
import { divideToAmount } from '../money/rounding'
import { breakdownByMonth, type MonthBreakdown } from './breakdown'
import { hasHappened, periodMonths, type Period } from './period'
import { currentStreak, longestStreak } from './streaks'

/**
 * Everything the statistics view states about one period (FR-020 – FR-023).
 *
 * Computed together, so a screen cannot pair the totals of one period with the streaks of
 * another. Nothing here is stored — like the balance, it is derived from the ledger on
 * every read, which is what lets an edit or a deletion change every figure at once.
 */
export interface SavingStatistics {
  /** The period these figures describe, for the screen to label (FR-023). */
  readonly period: Period
  /** The months the period covers, ascending. Empty when there is no history in it. */
  readonly months: readonly MonthKey[]
  /** The sum of contributions. Excludes the opening balance, which was not one. */
  readonly totalContributed: Money
  /** The sum of withdrawals. */
  readonly totalWithdrawn: Money
  /** Contributed minus withdrawn. Negative when more left than came in. */
  readonly netSaved: Money
  /** How many contributions. Excludes the opening balance. */
  readonly contributionCount: number
  /** The largest single contribution, or null when the period holds none. */
  readonly largestContribution: Money | null
  /**
   * Contributions per complete month, rounded down to the minor unit — or null while the
   * period holds no complete month, which is a figure that does not exist yet rather than
   * a zero.
   */
  readonly averageMonthlyContribution: Money | null
  /** How many of {@link months} are complete — what the average divides by. */
  readonly completeMonths: number
  /** Consecutive months with a contribution, ending now (FR-021). */
  readonly currentStreak: number
  /** The longest such run within the period. */
  readonly longestStreak: number
  /** What went in and out each month, and where the balance closed (FR-022). */
  readonly breakdown: readonly MonthBreakdown[]
}

/**
 * The statistics for a period (FR-020 – FR-023).
 *
 * The average divides by complete months only, and counts only what those months hold.
 * Under all time the month in progress is in the totals but not in the average: half a
 * month would drag it down today and push it up on the 31st, for no change in how the user
 * saves. A recent period is complete months already, so there the two agree.
 *
 * Entries dated after today are left out of every figure (FR-033).
 *
 * @param entries Every entry in the fund, in any order.
 * @param period The period chosen.
 * @param today From the `Clock` port.
 * @returns The figures for the period.
 */
export function summarize(
  entries: readonly LedgerEntry[],
  period: Period,
  today: CalendarDate,
): SavingStatistics {
  const months = periodMonths(entries, period, today)
  const inPeriod = new Set(months)
  const counted = entries.filter(
    (entry) => hasHappened(entry, today) && inPeriod.has(monthKey(entry.date)),
  )
  const contributions = amountsOf(counted, 'contribution')
  const totalContributed = sum(contributions)
  const totalWithdrawn = sum(amountsOf(counted, 'withdrawal'))
  const completeMonths = months.filter((month) => month !== monthKey(today))

  return {
    period,
    months,
    totalContributed,
    totalWithdrawn,
    netSaved: subtract(totalContributed, totalWithdrawn),
    contributionCount: contributions.length,
    largestContribution: contributions.length === 0 ? null : contributions.reduce(maxOf),
    averageMonthlyContribution: averageOver(counted, completeMonths),
    completeMonths: completeMonths.length,
    currentStreak: currentStreak(entries, months, today),
    longestStreak: longestStreak(entries, months, today),
    breakdown: breakdownByMonth(entries, months, today),
  }
}

/**
 * Contributions per month over the given months, rounded down through the rounding module —
 * the one place division happens.
 *
 * @returns Null when there are no months to divide by.
 */
function averageOver(entries: readonly LedgerEntry[], months: readonly MonthKey[]): Money | null {
  if (months.length === 0) {
    return null
  }
  const inMonths = new Set(months)
  const total = sum(
    amountsOf(
      entries.filter((entry) => inMonths.has(monthKey(entry.date))),
      'contribution',
    ),
  )
  return divideToAmount(total, months.length)
}

/** The amounts of one kind of entry. */
function amountsOf(entries: readonly LedgerEntry[], type: EntryType): readonly Money[] {
  return entries.filter((entry) => entry.type === type).map((entry) => entry.amount)
}
