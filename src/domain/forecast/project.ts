import {
  addMonths,
  firstDayOfMonth,
  lastDayOfMonth,
  monthKey,
  type CalendarDate,
} from '../dates/calendar-date'
import { isPositive, type Money } from '../money/money'
import { divideToWholeMonths } from '../money/rounding'
import type { PaceResult } from './pace'

/**
 * What the forecast screen shows (ui-contract, screen inventory).
 *
 * A union rather than a nullable projection, so that the "not enough history" and "pace is
 * zero" cases in FR-029 and FR-030 cannot be forgotten at the call site — the compiler asks
 * for every one of them to be rendered.
 */
export type ForecastState =
  | {
      /** Too few complete months to measure a pace (FR-029). */
      readonly kind: 'insufficient-history'
      /** Complete months of history so far. */
      readonly monthsAvailable: number
      /** How many more complete months are needed. */
      readonly monthsNeeded: number
    }
  | {
      /** A pace of zero or less, from which no date follows (FR-030). */
      readonly kind: 'no-pace'
    }
  | {
      /** Nothing remains to be saved. */
      readonly kind: 'reached'
    }
  | {
      readonly kind: 'projected'
      /** The pace the projection assumes continues, per month (FR-028). Always above zero. */
      readonly pace: Money
      /** How many complete months the pace was measured over, three to six (FR-028). */
      readonly paceMonths: number
      /** Whole months from the end of this one, rounded up. At least one. */
      readonly monthsToTarget: number
      /** The last day of the month the target is reached in (FR-027). */
      readonly projectedDate: CalendarDate
    }

/**
 * Projects when the target will be reached at the pace measured (FR-027 – FR-030).
 *
 * A straight line, as the spec assumes: the remaining amount over the pace, rounded up so
 * the date is never earlier than the arithmetic supports, counted from the end of the month
 * in progress — the pace was measured over complete months, so the months it projects are
 * complete months too. The date is the last day of the month the count lands in, since
 * reaching a target "in N months" means by the end of that month.
 *
 * A reached fund is reached before anything else is asked. The data model lists the
 * history check first, but a fund that opened at its target has nothing to forecast, and
 * telling that user to wait three months for a pace would be telling them something untrue.
 *
 * @param remaining What is still to be saved, never negative (`ProgressSummary.remaining`).
 * @param pace From {@link calculatePace}.
 * @param today From the `Clock` port.
 * @returns The state for the screen to render.
 */
export function project(remaining: Money, pace: PaceResult, today: CalendarDate): ForecastState {
  if (!isPositive(remaining)) {
    return { kind: 'reached' }
  }
  if (pace.kind === 'insufficient-history') {
    return pace
  }
  if (!isPositive(pace.pace)) {
    return { kind: 'no-pace' }
  }
  const monthsToTarget = divideToWholeMonths(remaining, pace.pace)
  const landing = addMonths(firstDayOfMonth(monthKey(today)), monthsToTarget)
  return {
    kind: 'projected',
    pace: pace.pace,
    paceMonths: pace.months.length,
    monthsToTarget,
    projectedDate: lastDayOfMonth(monthKey(landing)),
  }
}
