import { monthKey, type CalendarDate, type MonthKey } from '../dates/calendar-date'
import type { LedgerEntry } from '../ledger/types'
import { money, type Money } from '../money/money'
import { divideToAmount } from '../money/rounding'
import { periodMonths, type RecentMonths } from '../statistics/period'

/** How many complete months the pace looks back over, at most (FR-026). */
export const PACE_WINDOW_MONTHS: RecentMonths = 6

/** How many complete months of history a pace needs before it is worth stating (FR-029). */
export const MINIMUM_PACE_MONTHS = 3

/**
 * The saving pace, or the reason there is not one yet.
 *
 * A union rather than a nullable amount, so that "too little history" reaches the screen as
 * a state with its own numbers to state (FR-029) rather than as a missing value.
 */
export type PaceResult =
  | {
      /** Fewer complete months than {@link MINIMUM_PACE_MONTHS}. */
      readonly kind: 'insufficient-history'
      /** Complete months of history so far. */
      readonly monthsAvailable: number
      /** How many more complete months are needed — never zero in this state. */
      readonly monthsNeeded: number
    }
  | {
      readonly kind: 'measured'
      /** Net saved per month, in minor units, rounded down. Zero or negative is possible. */
      readonly pace: Money
      /** The complete months it was measured over, ascending. */
      readonly months: readonly MonthKey[]
    }

/**
 * The average monthly net saving over the trailing window (FR-026, research D-017).
 *
 * The window is the most recent complete calendar months, up to six. The month in progress
 * is left out, because half a month would drag the pace down until the month ended; its
 * entries still count toward the balance, which is the caller's business, not this one's.
 *
 * The window starts no earlier than the month of the first entry — the same rule a
 * statistics period follows, and through the same function, so the forecast and the
 * statistics view agree about which months the fund has existed. The opening balance's
 * month counts as history, since the fund existed then; the opening amount itself does not
 * count as saving, since it was set aside before the app and would read as a month of
 * extraordinary effort.
 *
 * Net is contributions minus withdrawals, so a pace can be zero or negative. That is kept
 * rather than clamped: FR-030 has to be able to tell the user why no date is shown.
 *
 * Entries dated after today are never in the window (FR-033): every month in it is over. Nor
 * can one start it — a fund whose only entry is dated next month has its first month after
 * every complete one, and so no window at all.
 *
 * @param entries Every entry in the fund, in any order.
 * @param today From the `Clock` port.
 * @returns The pace, or how much more history it needs.
 */
export function calculatePace(entries: readonly LedgerEntry[], today: CalendarDate): PaceResult {
  return measurePace(entries, today, signedSaving)
}

/**
 * The average monthly contribution over the same window, withdrawals left out — the pace a
 * recovery is estimated at (FR-018, decided with the user on 2026-11-01).
 *
 * "Recent contribution pace", as FR-018 says, rather than the net pace the forecast uses. A
 * withdrawal does not slow down how fast the fund refills, and counted, one large enough to
 * need recovering from would turn the net pace to zero or below and leave no estimate for
 * the six months it stays in the window. The window, the minimum history, and the rounding
 * are the net pace's, through the same code.
 *
 * @param entries Every entry in the fund, in any order.
 * @param today From the `Clock` port.
 * @returns The pace, never below zero, or how much more history it needs.
 */
export function calculateContributionPace(
  entries: readonly LedgerEntry[],
  today: CalendarDate,
): PaceResult {
  return measurePace(entries, today, contributed)
}

/** The window both paces share, averaged over what `saving` counts of each entry. */
function measurePace(
  entries: readonly LedgerEntry[],
  today: CalendarDate,
  saving: (entry: LedgerEntry) => number,
): PaceResult {
  const months = periodMonths(entries, { kind: 'recent', months: PACE_WINDOW_MONTHS }, today)
  if (months.length < MINIMUM_PACE_MONTHS) {
    return {
      kind: 'insufficient-history',
      monthsAvailable: months.length,
      monthsNeeded: MINIMUM_PACE_MONTHS - months.length,
    }
  }
  const inWindow = new Set(months)
  const net = entries
    .filter((entry) => inWindow.has(monthKey(entry.date)))
    .reduce((total, entry) => total + saving(entry), 0)
  return { kind: 'measured', pace: divideToAmount(money(net), months.length), months }
}

/** What an entry adds to the saving done: the opening balance was not saving. */
function signedSaving(entry: LedgerEntry): number {
  switch (entry.type) {
    case 'contribution':
      return entry.amount
    case 'withdrawal':
      return -entry.amount
    case 'opening':
      return 0
  }
}

/** What an entry put in: a contribution's amount, and nothing for any other kind. */
function contributed(entry: LedgerEntry): number {
  return entry.type === 'contribution' ? entry.amount : 0
}
