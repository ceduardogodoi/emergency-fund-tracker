import type { UseQueryResult } from '@tanstack/react-query'

import { combineQueries, type QueryLike } from '@/runtime/query'
import { useServices } from '@/runtime/services-context'
import type { CalendarDate } from '@/domain/dates/calendar-date'
import type { AppError } from '@/domain/errors'
import { calculatePace, type PaceResult } from '@/domain/forecast/pace'
import { project, type ForecastState } from '@/domain/forecast/project'
import { desiredContribution, type DesiredContribution } from '@/domain/forecast/required'
import type { Goal } from '@/domain/goal/types'
import { calculateBalance } from '@/domain/ledger/balance'
import { summarizeProgress } from '@/domain/ledger/progress'
import type { LedgerEntry, ProgressSummary } from '@/domain/ledger/types'
import type { Money } from '@/domain/money/money'
import { useLedgerView } from '@/features/entries/hooks'
import { useGoal } from '@/features/goal/hooks'

/**
 * The forecast has no cache of its own (FR-032). Everything here is derived from two reads
 * every other screen already shares — the entries, through `useLedgerView`, and the goal —
 * so a write that refreshes either refreshes the projection with it. A `forecast` query key
 * would be one more thing for every ledger and goal write to remember to invalidate, and the
 * one it forgot would show a date computed from a fund that no longer exists.
 */

/** Where the fund stands today, as far as forecasting is concerned. */
export interface SavingPosition {
  /** The balance as of today, which may be negative. */
  readonly balance: Money
  /** The pace over the trailing complete months, or how much more history it needs. */
  readonly pace: PaceResult
  /** The date both were computed for. */
  readonly today: CalendarDate
}

/** A desired completion date, and what it asks of the user (FR-031). */
export interface DesiredDate {
  readonly date: CalendarDate
  readonly contribution: DesiredContribution
}

/** Everything the forecast screen renders, from one read of the goal and the ledger. */
export interface Forecast {
  readonly goal: Goal
  /** Where the fund stands against the target, for the amount still to save. */
  readonly progress: ProgressSummary
  /** What the screen shows: a projection, or the reason there is none. */
  readonly state: ForecastState
  /** The desired completion date, when the user has set one. */
  readonly desired: DesiredDate | null
}

/**
 * The balance and the pace, from the ledger every other screen reads.
 *
 * @returns The query, resolving to today's position.
 */
export function useSavingPosition(): UseQueryResult<SavingPosition, AppError> {
  const { clock } = useServices()
  return useLedgerView((entries) => positionOf(entries, clock.today()))
}

/**
 * The forecast (FR-026 – FR-032): the projection, the pace it assumes, and what a desired
 * date asks.
 *
 * Null when there is no goal, which is setup unfinished — there is no target to project
 * onto. A failure reading either half is the screen's failure, never a forecast of nothing.
 *
 * @returns The pair as one query, for `toViewState`.
 */
export function useForecast(): QueryLike<Forecast | null> {
  return combineQueries(useGoal(), useSavingPosition(), forecastOf)
}

/**
 * What a desired date asks, against a target that may not be stored yet.
 *
 * The goal screen calls this with the target being drafted, so the figure follows the form
 * as it is edited rather than the goal as it was saved.
 *
 * @param position From {@link useSavingPosition}.
 * @param target The target to measure the remaining amount against.
 * @param date The desired completion date.
 * @returns The date and what it asks.
 */
export function desiredDateFor(
  position: SavingPosition,
  target: Money,
  date: CalendarDate,
): DesiredDate {
  const { remaining } = summarizeProgress(position.balance, target)
  return {
    date,
    contribution: desiredContribution(remaining, date, position.pace, position.today),
  }
}

/** The position, computed. */
function positionOf(entries: readonly LedgerEntry[], today: CalendarDate): SavingPosition {
  return {
    balance: calculateBalance(entries, today),
    pace: calculatePace(entries, today),
    today,
  }
}

/** The forecast, or null when there is no goal to forecast. */
function forecastOf(goal: Goal | null, position: SavingPosition): Forecast | null {
  if (goal === null) {
    return null
  }
  const progress = summarizeProgress(position.balance, goal.target)
  return {
    goal,
    progress,
    state: project(progress.remaining, position.pace, position.today),
    desired:
      goal.desiredCompletionDate === null
        ? null
        : desiredDateFor(position, goal.target, goal.desiredCompletionDate),
  }
}
