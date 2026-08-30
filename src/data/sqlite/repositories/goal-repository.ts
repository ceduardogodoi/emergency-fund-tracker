import { instant } from '@/domain/dates/instant'
import type { Goal, GoalChange, GoalChangeInput, GoalInput } from '@/domain/goal/types'
import type { Clock } from '@/domain/ports/clock'
import type { IdGenerator } from '@/domain/ports/id-generator'
import type { GoalRepository } from '@/domain/ports/repositories'
import type { Result } from '@/domain/result'

import type { SqliteDatabase } from '../driver'
import { toGoal, toGoalChange, type GoalChangeRow, type GoalRow } from '../mappers/goal'
import { attempt } from './attempt'

/*
 * Unqualified names — COLUMNS, SELECT, UPSERT — belong to the goal itself, the entity this
 * file is named for, matching `profile-repository.ts`. The change log is the secondary
 * entity here, so its statements carry the suffix.
 */

/** Every column the goal mapper needs, named so the row shape cannot drift from the query. */
const COLUMNS = `
  target_minor, source, level_key, coverage_months, desired_completion_date,
  created_at, updated_at
`

/** The single goal row, addressed by its fixed id. See the `goal_single_row` CHECK. */
const SELECT = `SELECT ${COLUMNS} FROM goal WHERE id = 1`

/**
 * Creates the goal or replaces the fields that can change.
 *
 * `created_at` is absent from the update because an update has no business touching it.
 * That omission is not what preserves it, though — `excluded.created_at` already holds the
 * original, read before the write. `save` is what keeps it correct; this only makes the
 * statement say so.
 */
const UPSERT = `
  INSERT INTO goal (
    id, target_minor, source, level_key, coverage_months, desired_completion_date,
    created_at, updated_at
  )
  VALUES (1, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    target_minor            = excluded.target_minor,
    source                  = excluded.source,
    level_key               = excluded.level_key,
    coverage_months         = excluded.coverage_months,
    desired_completion_date = excluded.desired_completion_date,
    updated_at              = excluded.updated_at
`

/** Every column the change mapper needs. */
const CHANGE_COLUMNS = `
  id, changed_at, previous_target_minor, new_target_minor,
  previous_expenses_minor, new_expenses_minor,
  previous_coverage_months, new_coverage_months
`

/**
 * Every revision, oldest first.
 *
 * `rowid` breaks ties. Two revisions can share a `changed_at` — the clock has millisecond
 * resolution and a test clock has none at all — and `rowid` is insertion order, which is
 * what "oldest first" means when the timestamps cannot tell them apart.
 *
 * Today's engine happens to return these rows in insertion order without the tiebreak, so
 * removing it breaks no test. That is not a guarantee: SQLite specifies the order of
 * otherwise-equal rows as arbitrary, and it changes with the query plan — adding an index
 * on `changed_at` would be enough. The clause is what turns the accident into a promise.
 */
const SELECT_CHANGES = `
  SELECT ${CHANGE_COLUMNS} FROM goal_change ORDER BY changed_at ASC, rowid ASC
`

/** Appends one revision. The log is append-only; there is no update and no delete. */
const INSERT_CHANGE = `
  INSERT INTO goal_change (
    id, changed_at, previous_target_minor, new_target_minor,
    previous_expenses_minor, new_expenses_minor,
    previous_coverage_months, new_coverage_months
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`

/**
 * Builds the SQLite-backed {@link GoalRepository}.
 *
 * @param db The open database.
 * @param clock Supplies the audit timestamps, never taken from the caller.
 * @param ids Supplies the revision identifiers, which travel in the export document.
 * @returns The repository.
 */
export function createGoalRepository(
  db: SqliteDatabase,
  clock: Clock,
  ids: IdGenerator,
): GoalRepository {
  return { ...createGoalRecord(db, clock), ...createChangeLog(db, clock, ids) }
}

/**
 * The active goal: the single row and the two operations on it.
 *
 * Split from the change log because the port carries two entities, and one factory holding
 * all four methods is long enough that the boundary between them stops being visible.
 */
function createGoalRecord(db: SqliteDatabase, clock: Clock): Pick<GoalRepository, 'get' | 'save'> {
  return {
    async get(): Promise<Result<Goal | null>> {
      return attempt('goal.read-failed', async () => {
        const row = await db.selectOne<GoalRow>(SELECT)
        return row === null ? null : toGoal(row)
      })
    },

    async save(goal: GoalInput): Promise<Result<Goal>> {
      return attempt('goal.save-failed', async () => {
        // Read before writing, as in `profile-repository.ts`: the original `created_at` is
        // the one thing the caller cannot know, and having it in hand means the returned
        // goal is built from known values rather than read back from the write.
        const existing = await db.selectOne<GoalRow>(SELECT)
        const now = clock.now()
        const createdAt = existing === null ? now : instant(existing.created_at)

        await db.run(UPSERT, [
          goal.target,
          goal.source,
          goal.levelKey,
          goal.coverageMonths,
          goal.desiredCompletionDate,
          createdAt,
          now,
        ])
        return { ...goal, createdAt, updatedAt: now }
      })
    },
  }
}

/**
 * The append-only revision log: the two operations that write and read it.
 *
 * Takes the id generator, which the goal row itself has no use for — its identity is the
 * fixed `id = 1`, while every revision needs one that survives export and import.
 */
function createChangeLog(
  db: SqliteDatabase,
  clock: Clock,
  ids: IdGenerator,
): Pick<GoalRepository, 'recordChange' | 'listChanges'> {
  return {
    async recordChange(change: GoalChangeInput): Promise<Result<void>> {
      return attempt('goal.change-save-failed', async () => {
        await db.run(INSERT_CHANGE, [
          ids.uuid(),
          clock.now(),
          change.previousTarget,
          change.newTarget,
          change.previousExpenses,
          change.newExpenses,
          change.previousCoverageMonths,
          change.newCoverageMonths,
        ])
      })
    },

    async listChanges(): Promise<Result<readonly GoalChange[]>> {
      return attempt('goal.changes-read-failed', async () => {
        const rows = await db.selectAll<GoalChangeRow>(SELECT_CHANGES)
        return rows.map(toGoalChange)
      })
    },
  }
}
