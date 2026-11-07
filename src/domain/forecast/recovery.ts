import { compareDates, isAfter, type CalendarDate } from '../dates/calendar-date'
import type { LedgerEntry } from '../ledger/types'
import { maxOf, minOf, money, subtract, zero, type Money } from '../money/money'
import { calculateContributionPace } from './pace'
import { project, type ForecastState } from './project'

/**
 * How long restoring a shortfall will take: the forecast's states, less `reached`, which
 * is a shortfall of nothing and so no recovery at all.
 */
export type RecoveryEstimate = Exclude<ForecastState, { kind: 'reached' }>

/** What a withdrawal has left to restore, if anything (FR-018). */
export type RecoveryState =
  | {
      /** Nothing to restore: no withdrawal, or the fund is back where it was. */
      readonly kind: 'none'
    }
  | {
      readonly kind: 'recovering'
      /** What is left to restore, above zero. */
      readonly shortfall: Money
      /** When it will be restored, at the pace of contributions, or why that cannot be said. */
      readonly estimate: RecoveryEstimate
    }

/**
 * What withdrawals have taken from the fund and contributions have not yet put back
 * (FR-018): the highest balance the fund has reached, capped at the target, less the
 * balance today. Decided with the user on 2026-11-01.
 *
 * Measured from the high rather than from the last withdrawal, so a run of withdrawals is
 * one shortfall, and contributions refill it until the old high is reached again — past it,
 * the new high is where the fund stands and there is nothing to restore. Capped at the
 * target because FR-018 asks for the shortfall against the target: a surplus spent is not a
 * debt to the fund. Below zero counts as well, since an overdrawn fund has that to restore.
 *
 * The balance is read at the end of each day, never between two entries of one day, so the
 * order a day's entries were recorded in cannot raise the high. Entries dated after today
 * are left out, as from every calculation (FR-033).
 *
 * @param entries Every entry in the fund, in any order.
 * @param target The goal's target, above zero.
 * @param today From the `Clock` port.
 * @returns The shortfall, zero or above.
 */
export function calculateShortfall(
  entries: readonly LedgerEntry[],
  target: Money,
  today: CalendarDate,
): Money {
  let balance = zero
  let high = zero
  for (const change of dailyChanges(entries, today)) {
    balance = money(balance + change)
    high = maxOf(high, balance)
  }
  return maxOf(subtract(minOf(high, target), balance), zero)
}

/**
 * The shortfall, and how long it will take to restore at the pace of contributions alone
 * (FR-018).
 *
 * The forecast's projection applied to the shortfall instead of to the whole amount
 * remaining, as the data model puts it, at `calculateContributionPace` rather than the net
 * pace — so too little history and a pace of nothing are stated here as they are on the
 * forecast (FR-029, FR-030).
 *
 * @param entries Every entry in the fund, in any order.
 * @param target The goal's target, above zero.
 * @param today From the `Clock` port.
 * @returns Nothing to restore, or the shortfall with its estimate.
 */
export function estimateRecovery(
  entries: readonly LedgerEntry[],
  target: Money,
  today: CalendarDate,
): RecoveryState {
  const shortfall = calculateShortfall(entries, target, today)
  // `project` calls a shortfall of nothing reached, which is the one test for it.
  const estimate = project(shortfall, calculateContributionPace(entries, today), today)
  if (estimate.kind === 'reached') {
    return { kind: 'none' }
  }
  return { kind: 'recovering', shortfall, estimate }
}

/**
 * How much the balance moved on each day that has happened, oldest day first.
 *
 * Sorted on a copy with `sort`, not `toSorted`, which Hermes does not have (arrays rule).
 */
function dailyChanges(entries: readonly LedgerEntry[], today: CalendarDate): readonly number[] {
  const byDay = new Map<CalendarDate, number>()
  for (const entry of entries) {
    if (isAfter(entry.date, today)) {
      continue
    }
    const signed = entry.type === 'withdrawal' ? -entry.amount : entry.amount
    byDay.set(entry.date, (byDay.get(entry.date) ?? 0) + signed)
  }
  return [...byDay.entries()]
    .sort(([left], [right]) => compareDates(left, right))
    .map(([, change]) => change)
}
