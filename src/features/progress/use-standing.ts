import { combineQueries, type QueryLike } from '@/runtime/query'
import type { Goal } from '@/domain/goal/types'
import { coveredMonths } from '@/domain/ledger/coverage'
import { summarizeProgress } from '@/domain/ledger/progress'
import type { ProgressSummary } from '@/domain/ledger/types'
import type { Money } from '@/domain/money/money'
import { useBalance } from '@/features/entries/hooks'
import { useStoredGoal, type StoredGoal } from '@/features/goal/hooks'

/** The goal, and where the fund stands against it. */
export interface Standing {
  readonly goal: Goal
  readonly progress: ProgressSummary
  /** Whole months of the stored expenses the balance covers, capped at the plan. */
  readonly monthsCovered: number
}

/**
 * Where the fund stands, as Home reads it (FR-013, FR-015).
 *
 * The goal and the balance come from different queries and neither means anything to Home
 * without the other: a target with no balance beside it is setup, not progress, and a
 * balance that failed to load must not be shown as zero. So they are one query here, and a
 * failure in either is the screen's failure.
 *
 * The goal comes with the stored expenses, which the coverage meter measures the balance in.
 * Setup saves the two in one transaction, so a goal without them is setup unfinished.
 *
 * Null when there is no goal, which is how Home knows setup never finished.
 *
 * @returns The pair, for `toViewState`.
 */
export function useStanding(): QueryLike<Standing | null> {
  return combineQueries(useStoredGoal(), useBalance(), standingOf)
}

/** The goal with its progress, or null when there is no goal to measure against. */
function standingOf(stored: StoredGoal | null, balance: Money): Standing | null {
  if (stored === null) {
    return null
  }
  const { goal, monthlyExpenses } = stored
  return {
    goal,
    progress: summarizeProgress(balance, goal.target),
    monthsCovered: coveredMonths(balance, monthlyExpenses, goal.coverageMonths),
  }
}
