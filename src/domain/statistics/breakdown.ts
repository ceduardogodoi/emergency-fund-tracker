import { monthKey, type CalendarDate, type MonthKey } from '../dates/calendar-date'
import { calculateBalance } from '../ledger/balance'
import type { EntryType, LedgerEntry } from '../ledger/types'
import { add, money, subtract, zero, type Money } from '../money/money'
import { hasHappened } from './period'

/** One month of the breakdown (FR-022). */
export interface MonthBreakdown {
  /** The month, `YYYY-MM`. */
  readonly month: MonthKey
  /** What went in through contributions. The opening balance is not one. */
  readonly contributed: Money
  /** What went out through withdrawals. */
  readonly withdrawn: Money
  /**
   * The balance at the end of the month — or today, for the month in progress. The real
   * balance, carried in from before the period rather than starting it at zero, and
   * negative when the fund was overdrawn.
   */
  readonly closingBalance: Money
}

/**
 * What went in and out each month, and where the balance closed (FR-019, FR-022).
 *
 * Balance growth and the breakdown are one list on the statistics view — a month's flows
 * and the balance they left — so they come from one computation, and the closing balance
 * cannot disagree with the flows beside it.
 *
 * A month with nothing in it is a row of zeros rather than a missing row. A month the user
 * saved nothing in is information, and a breakdown that skipped it would draw the months
 * either side as neighbours.
 *
 * Entries dated after today are left out everywhere (FR-033). The opening balance moves the
 * closing balance but is not counted as contributed: it was not a movement, it is where the
 * fund started.
 *
 * @param entries Every entry in the fund, in any order — a backfilled entry lands in the
 *   month its date names.
 * @param months The period's months, ascending, as `periodMonths` gives them.
 * @param today From the `Clock` port.
 * @returns One row per month, in the order given.
 */
export function breakdownByMonth(
  entries: readonly LedgerEntry[],
  months: readonly MonthKey[],
  today: CalendarDate,
): readonly MonthBreakdown[] {
  const happened = entries.filter((entry) => hasHappened(entry, today))
  const first = months[0]
  if (first === undefined) {
    return []
  }

  let balance = calculateBalance(
    happened.filter((entry) => monthKey(entry.date) < first),
    today,
  )
  return months.map((month) => {
    const inMonth = happened.filter((entry) => monthKey(entry.date) === month)
    const contributed = totalOf(inMonth, 'contribution')
    const withdrawn = totalOf(inMonth, 'withdrawal')
    balance = subtract(add(add(balance, totalOf(inMonth, 'opening')), contributed), withdrawn)
    return { month, contributed, withdrawn, closingBalance: balance }
  })
}

/** The total of one kind of entry. */
function totalOf(entries: readonly LedgerEntry[], type: EntryType): Money {
  return money(
    entries
      .filter((entry) => entry.type === type)
      .reduce<number>((total, entry) => total + entry.amount, zero),
  )
}
