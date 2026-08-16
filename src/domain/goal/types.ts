import type { CalendarDate } from '../dates/calendar-date'
import type { Instant } from '../dates/instant'
import type { Money } from '../money/money'

/**
 * How cautious the user chose to be, as named levels mapping to months of expense
 * coverage (FR-002). `custom` carries its own duration in `coverageMonths`.
 */
export type LevelKey = 'lean' | 'balanced' | 'cautious' | 'maximum' | 'custom'

/** Whether the active target was derived from expenses or typed in by hand (FR-005). */
export type TargetSource = 'calculated' | 'user_defined'

/**
 * The savings target and how it was arrived at.
 *
 * `coverageMonths` is retained even when `source` is `user_defined`, so switching back to
 * a calculated target restores the user's earlier choice instead of losing it.
 */
export interface Goal {
  /** Always above zero — a zero target is rejected at entry. */
  readonly target: Money
  readonly source: TargetSource
  readonly levelKey: LevelKey
  /** Months of expense coverage, 1–24 (FR-002). */
  readonly coverageMonths: number
  /** Optional finish date the user is aiming for; drives the required-monthly figure (FR-031). */
  readonly desiredCompletionDate: CalendarDate | null
  readonly createdAt: Instant
  /** When the goal was set or last changed — "the date the goal was set or last changed". */
  readonly updatedAt: Instant
}

/**
 * The caller-supplied half of a {@link Goal}. Audit timestamps come from the repository's
 * clock rather than the caller.
 */
export interface GoalInput {
  readonly target: Money
  readonly source: TargetSource
  readonly levelKey: LevelKey
  readonly coverageMonths: number
  readonly desiredCompletionDate: CalendarDate | null
}

/**
 * One recorded revision of the goal.
 *
 * Exists because the spec requires that when expenses change, "history is preserved with
 * the change recorded". Append-only: never edited, never deleted except by a full erase
 * or a replacing import.
 */
export interface GoalChange {
  readonly id: string
  readonly changedAt: Instant
  readonly previousTarget: Money
  readonly newTarget: Money
  readonly previousExpenses: Money
  readonly newExpenses: Money
  readonly previousCoverageMonths: number
  readonly newCoverageMonths: number
}

/** The caller-supplied half of a {@link GoalChange}; id and timestamp are generated. */
export type GoalChangeInput = Omit<GoalChange, 'id' | 'changedAt'>
