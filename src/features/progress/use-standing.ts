import { combineQueries, type QueryLike } from '@/runtime/query'
import { useServices } from '@/runtime/services-context'
import type { CalendarDate } from '@/domain/dates/calendar-date'
import { estimateRecovery, type RecoveryState } from '@/domain/forecast/recovery'
import type { Goal } from '@/domain/goal/types'
import { calculateBalance } from '@/domain/ledger/balance'
import { coveredMonths } from '@/domain/ledger/coverage'
import { summarizeProgress } from '@/domain/ledger/progress'
import type { LedgerEntry, ProgressSummary } from '@/domain/ledger/types'
import { useEntries } from '@/features/entries/hooks'
import { useStoredGoal, type StoredGoal } from '@/features/goal/hooks'

/** The goal, and where the fund stands against it. */
export interface Standing {
  readonly goal: Goal
  readonly progress: ProgressSummary
  /** Whole months of the stored expenses the balance covers, capped at the plan. */
  readonly monthsCovered: number
  /** What withdrawals have left to restore, and how long that will take (FR-018). */
  readonly recovery: RecoveryState
}

/**
 * Where the fund stands, as Home reads it (FR-013, FR-015, FR-018).
 *
 * The goal and the ledger come from different queries and neither means anything to Home
 * without the other: a target with no balance beside it is setup, not progress, and a
 * balance that failed to load must not be shown as zero. So they are one query here, and a
 * failure in either is the screen's failure.
 *
 * The ledger is read as entries rather than as a balance, because the shortfall a
 * withdrawal left is a question about the fund's history — the highest it has been — and
 * not only about where it stands today.
 *
 * The goal comes with the stored expenses, which the coverage meter measures the balance in.
 * Setup saves the two in one transaction, so a goal without them is setup unfinished.
 *
 * Null when there is no goal, which is how Home knows setup never finished.
 *
 * @returns The pair, for `toViewState`.
 */
export function useStanding(): QueryLike<Standing | null> {
  const { clock } = useServices()
  const today = clock.today()
  return combineQueries(useStoredGoal(), useEntries(), (stored, entries) =>
    standingOf(stored, entries, today),
  )
}

/** The goal with its progress, or null when there is no goal to measure against. */
function standingOf(
  stored: StoredGoal | null,
  entries: readonly LedgerEntry[],
  today: CalendarDate,
): Standing | null {
  if (stored === null) {
    return null
  }
  const { goal, monthlyExpenses } = stored
  const balance = calculateBalance(entries, today)
  return {
    goal,
    progress: summarizeProgress(balance, goal.target),
    monthsCovered: coveredMonths(balance, monthlyExpenses, goal.coverageMonths),
    recovery: estimateRecovery(entries, goal.target, today),
  }
}
