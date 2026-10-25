import type { UseQueryResult } from '@tanstack/react-query'

import { useServices } from '@/runtime/services-context'
import type { CalendarDate, MonthKey } from '@/domain/dates/calendar-date'
import type { AppError } from '@/domain/errors'
import type { LedgerEntry } from '@/domain/ledger/types'
import { hasHappened, periodMonths, PERIODS, type Period } from '@/domain/statistics/period'
import { summarize, type SavingStatistics } from '@/domain/statistics/summary'
import { useLedgerView } from '@/features/entries/hooks'

/** A period the filter offers, with the months it would cover today. */
export interface PeriodOption {
  readonly period: Period
  /** Ascending. Empty when the period has no month to show yet. */
  readonly months: readonly MonthKey[]
}

/** Everything the statistics screen renders, from one read of the ledger. */
export interface StatisticsView {
  /** The figures for the chosen period. */
  readonly statistics: SavingStatistics
  /** Every period the filter offers, so each option can say what it covers (FR-023). */
  readonly options: readonly PeriodOption[]
  /**
   * Whether money has moved in or out — a contribution or a withdrawal that has happened.
   * An opening balance alone is where every user leaves setup, and there is nothing yet
   * to state about how they save (FR-025).
   */
  readonly hasMovements: boolean
  /** The date the figures were computed for, so the month in progress can be told apart. */
  readonly today: CalendarDate
}

/**
 * The statistics for a period, derived from the ledger every other screen reads.
 *
 * Through `useLedgerView` rather than a query of its own, so a write that refreshes the
 * history refreshes these figures too (FR-032's sibling for statistics) — there is no
 * statistics cache to forget to invalidate.
 *
 * @param period The period chosen in the filter.
 * @returns The query, for `toViewState`. Empty, for the screen, is `!hasMovements`.
 */
export function useStatistics(period: Period): UseQueryResult<StatisticsView, AppError> {
  const { clock } = useServices()
  return useLedgerView((entries) => viewOf(entries, period, clock.today()))
}

/** The view, computed. */
function viewOf(
  entries: readonly LedgerEntry[],
  period: Period,
  today: CalendarDate,
): StatisticsView {
  return {
    statistics: summarize(entries, period, today),
    options: PERIODS.map((option) => ({
      period: option,
      months: periodMonths(entries, option, today),
    })),
    hasMovements: entries.some((entry) => entry.type !== 'opening' && hasHappened(entry, today)),
    today,
  }
}
