import {
  completeMonthKeysBefore,
  isAfter,
  monthKey,
  monthKeysBetween,
  type CalendarDate,
  type MonthKey,
} from '../dates/calendar-date'
import type { LedgerEntry } from '../ledger/types'

/**
 * A span of history the statistics view is filtered to (FR-023).
 *
 * A recent period is made of **complete** calendar months only, the way the forecast's pace
 * window is (D-017): on the 15th of October, "last 3 months" is July, August, and
 * September. A month still in progress would make every figure under it move as the month
 * filled, and a total that changes between Monday and Friday with no change in how the user
 * saves is not a total they can compare. The month in progress appears under all time alone.
 */
export type Period =
  | {
      /** A run of complete months ending with the last one before today. */
      readonly kind: 'recent'
      /** How many complete months, at most. */
      readonly months: RecentMonths
    }
  | {
      /** Everything, from the month of the first entry to the month in progress. */
      readonly kind: 'all-time'
    }

/** The lengths a recent period comes in — FR-023's minimum, and no more. */
export type RecentMonths = 3 | 6 | 12

/** Every period the filter offers, in the order it offers them. All time is the default. */
export const PERIODS: readonly Period[] = [
  { kind: 'all-time' },
  { kind: 'recent', months: 12 },
  { kind: 'recent', months: 6 },
  { kind: 'recent', months: 3 },
]

/**
 * The months a period covers, ascending.
 *
 * Never earlier than the month of the first entry. Months before the fund existed are not
 * months the user saved nothing in: showing them would draw empty bars for a time the app
 * was not installed, and dividing the average by them would understate it. So "last 12
 * months" over five months of history is those five.
 *
 * An entry dated after today needs no exclusion here (FR-033): it is always later than
 * anything that has happened, and on its own it gives a window ending before it begins,
 * which is empty.
 *
 * @param entries Every entry in the fund, in any order.
 * @param period The period chosen.
 * @param today From the `Clock` port.
 * @returns The months, oldest first. Empty when there is no history, or when a recent period
 *   is asked of history younger than one complete month.
 */
export function periodMonths(
  entries: readonly LedgerEntry[],
  period: Period,
  today: CalendarDate,
): readonly MonthKey[] {
  const first = firstMonth(entries)
  if (first === null) {
    return []
  }
  if (period.kind === 'all-time') {
    return monthKeysBetween(first, monthKey(today))
  }
  return completeMonthKeysBefore(today, period.months).filter((month) => month >= first)
}

/**
 * Whether an entry counts toward any statistic: it has happened.
 *
 * @param entry The entry.
 * @param today From the `Clock` port.
 * @returns False for an entry dated after today (FR-033).
 */
export function hasHappened(entry: LedgerEntry, today: CalendarDate): boolean {
  return !isAfter(entry.date, today)
}

/** The month of the earliest entry, or null when there are none. */
function firstMonth(entries: readonly LedgerEntry[]): MonthKey | null {
  let earliest: MonthKey | null = null
  for (const entry of entries) {
    const month = monthKey(entry.date)
    if (earliest === null || month < earliest) {
      earliest = month
    }
  }
  return earliest
}
