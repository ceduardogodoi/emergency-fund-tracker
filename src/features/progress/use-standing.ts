import { combineQueries, type QueryLike } from '@/runtime/query'
import type { Goal } from '@/domain/goal/types'
import { summarizeProgress } from '@/domain/ledger/progress'
import type { ProgressSummary } from '@/domain/ledger/types'
import type { Money } from '@/domain/money/money'
import { useBalance } from '@/features/entries/hooks'
import { useGoal } from '@/features/goal/hooks'

/** The goal, and where the fund stands against it. */
export interface Standing {
  readonly goal: Goal
  readonly progress: ProgressSummary
}

/**
 * Where the fund stands, as Home reads it (FR-013, FR-015).
 *
 * The goal and the balance come from different queries and neither means anything to Home
 * without the other: a target with no balance beside it is setup, not progress, and a
 * balance that failed to load must not be shown as zero. So they are one query here, and a
 * failure in either is the screen's failure.
 *
 * Null when there is no goal, which is how Home knows setup never finished.
 *
 * @returns The pair, for `toViewState`.
 */
export function useStanding(): QueryLike<Standing | null> {
  return combineQueries(useGoal(), useBalance(), standingOf)
}

/** The goal with its progress, or null when there is no goal to measure against. */
function standingOf(goal: Goal | null, balance: Money): Standing | null {
  return goal === null ? null : { goal, progress: summarizeProgress(balance, goal.target) }
}
