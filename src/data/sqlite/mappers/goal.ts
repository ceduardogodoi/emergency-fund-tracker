import { calendarDate } from '@/domain/dates/calendar-date'
import { instant } from '@/domain/dates/instant'
import type { Goal, GoalChange, LevelKey, TargetSource } from '@/domain/goal/types'
import { money } from '@/domain/money/money'

/** The `goal` row as SQLite hands it back. */
export interface GoalRow {
  readonly target_minor: number
  readonly source: string
  readonly level_key: string
  readonly coverage_months: number
  readonly desired_completion_date: string | null
  readonly created_at: string
  readonly updated_at: string
}

/** The `goal_change` row as SQLite hands it back. */
export interface GoalChangeRow {
  readonly id: string
  readonly changed_at: string
  readonly previous_target_minor: number
  readonly new_target_minor: number
  readonly previous_expenses_minor: number
  readonly new_expenses_minor: number
  readonly previous_coverage_months: number
  readonly new_coverage_months: number
}

/**
 * Turns a stored row into a {@link Goal}.
 *
 * `source` and `level_key` are asserted rather than parsed: the schema's `CHECK` clauses
 * restrict both to the same sets the union types name, so the constraint is what makes the
 * assertion true. Re-validating here would mean the rule lived in two places, and the copy
 * that drifted would be this one.
 *
 * @param row The row as read.
 * @returns The domain goal.
 * @throws {RangeError} If a stored amount or date is not what the schema promised.
 */
export function toGoal(row: GoalRow): Goal {
  return {
    target: money(row.target_minor),
    source: row.source as TargetSource,
    levelKey: row.level_key as LevelKey,
    coverageMonths: row.coverage_months,
    desiredCompletionDate:
      row.desired_completion_date === null ? null : calendarDate(row.desired_completion_date),
    createdAt: instant(row.created_at),
    updatedAt: instant(row.updated_at),
  }
}

/**
 * Turns a stored row into a {@link GoalChange}.
 *
 * @param row The row as read.
 * @returns The domain revision record.
 * @throws {RangeError} If a stored amount or timestamp is not what the schema promised.
 */
export function toGoalChange(row: GoalChangeRow): GoalChange {
  return {
    id: row.id,
    changedAt: instant(row.changed_at),
    previousTarget: money(row.previous_target_minor),
    newTarget: money(row.new_target_minor),
    previousExpenses: money(row.previous_expenses_minor),
    newExpenses: money(row.new_expenses_minor),
    previousCoverageMonths: row.previous_coverage_months,
    newCoverageMonths: row.new_coverage_months,
  }
}
