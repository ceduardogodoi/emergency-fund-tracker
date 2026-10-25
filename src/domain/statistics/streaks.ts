import { monthKey, type CalendarDate, type MonthKey } from '../dates/calendar-date'
import type { LedgerEntry } from '../ledger/types'
import { hasHappened } from './period'

/**
 * Saving streaks (FR-021): runs of consecutive calendar months holding at least one
 * contribution.
 *
 * Only a contribution makes a month active. An opening balance is where the fund started
 * and a withdrawal takes from it; neither is the habit a streak measures. Many
 * contributions in one month make it active once.
 *
 * Both functions take the period's months as well as the entries, because the streaks
 * follow the period filter like every other figure on the view (FR-023). A run that began
 * before the period is cut at the period's start.
 */

/**
 * The run of active months ending now.
 *
 * Counted back from the last month of the period. When that month is the one in progress
 * and nothing is in it yet, counting starts from the month before instead: on the 15th, a
 * user who saves at the end of the month has not broken anything (data-model, streaks). A
 * recent period ends on a complete month, so there an empty last month is a break.
 *
 * @param entries Every entry in the fund, in any order.
 * @param months The period's months, ascending, as `periodMonths` gives them.
 * @param today From the `Clock` port.
 * @returns Whole months, zero when the run is broken or there is no history.
 */
export function currentStreak(
  entries: readonly LedgerEntry[],
  months: readonly MonthKey[],
  today: CalendarDate,
): number {
  const active = activeMonths(entries, today)
  let index = months.length - 1
  if (months[index] === monthKey(today) && !active.has(monthKey(today))) {
    index -= 1
  }
  let streak = 0
  while (index >= 0 && active.has(months[index] as MonthKey)) {
    streak += 1
    index -= 1
  }
  return streak
}

/**
 * The longest run of active months anywhere in the period.
 *
 * @param entries Every entry in the fund, in any order.
 * @param months The period's months, ascending.
 * @param today From the `Clock` port.
 * @returns Whole months, zero when the period holds no contribution.
 */
export function longestStreak(
  entries: readonly LedgerEntry[],
  months: readonly MonthKey[],
  today: CalendarDate,
): number {
  const active = activeMonths(entries, today)
  let longest = 0
  let run = 0
  for (const month of months) {
    run = active.has(month) ? run + 1 : 0
    longest = Math.max(longest, run)
  }
  return longest
}

/**
 * The months holding a contribution that has happened.
 *
 * A set keyed by month rather than a walk over sorted entries, so the order the ledger hands
 * them over in cannot matter — a backfilled month joins the run its date puts it in.
 */
function activeMonths(entries: readonly LedgerEntry[], today: CalendarDate): ReadonlySet<MonthKey> {
  return new Set(
    entries
      .filter((entry) => entry.type === 'contribution' && hasHappened(entry, today))
      .map((entry) => monthKey(entry.date)),
  )
}
