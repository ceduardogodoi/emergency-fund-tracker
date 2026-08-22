import { storageError } from '@/domain/errors/app-error'
import { err, ok, type Result } from '@/domain/result'

import type { SqliteDatabase } from '../driver'

/**
 * One numbered, forward-only schema step.
 *
 * A migration is never edited once it has shipped — a device in the field has already
 * applied it, and rewriting history here would leave that device on a schema no code
 * describes. Changing the schema means adding the next number.
 */
export interface Migration {
  /** Positive integer, unique across the set. Becomes `PRAGMA user_version` once applied. */
  readonly version: number
  /** Human label for logs and test failures. Carries no behaviour. */
  readonly name: string
  /**
   * Performs the schema change.
   *
   * Runs inside a transaction the runner owns; must not issue `BEGIN`, `COMMIT`, or
   * `ROLLBACK` of its own, and must not set `user_version` — the runner does that last.
   */
  apply(db: SqliteDatabase): Promise<void>
}

/** A step that ran, recorded so a boot log can say what changed. */
export interface AppliedMigration {
  readonly version: number
  readonly name: string
}

/** What one `migrate` call did. */
export interface MigrationReport {
  /** Schema version found on entry. Zero on a database that has never been migrated. */
  readonly from: number
  /** Schema version on exit. Equals `from` when nothing was pending. */
  readonly to: number
  /** Steps applied, in the order they ran. Empty when the schema was already current. */
  readonly applied: readonly AppliedMigration[]
}

/**
 * Brings a database up to the newest known schema version.
 *
 * Each pending step runs in its own transaction with the version bump as its last
 * statement, so an interrupted upgrade leaves the database at the last version that fully
 * committed rather than in a half-described state. FR-043 promises data survives app
 * updates, and that promise is only as good as this property.
 *
 * @param migrations The full set, in any order. Sorted here; the caller's order is not
 *   trusted, because a list assembled by hand eventually stops being sorted.
 * @returns What changed, or a storage failure that leaves the database as it was found.
 */
export async function migrate(
  db: SqliteDatabase,
  migrations: readonly Migration[],
): Promise<Result<MigrationReport>> {
  const ordered = [...migrations].sort((left, right) => left.version - right.version)
  if (!isWellFormed(ordered)) {
    return err(storageError('storage.migrations-invalid'))
  }

  const from = await readVersion(db)
  const newest = ordered.length === 0 ? 0 : (ordered[ordered.length - 1] as Migration).version
  if (from > newest) {
    return err(storageError('storage.schema-ahead'))
  }

  const applied: AppliedMigration[] = []
  for (const migration of ordered.filter((candidate) => candidate.version > from)) {
    const step = await applyStep(db, migration)
    if (!step.ok) {
      return step
    }
    applied.push({ version: migration.version, name: migration.name })
  }

  return ok({ from, to: applied.length === 0 ? from : newest, applied })
}

/**
 * Rejects a set that could not be applied unambiguously.
 *
 * Version 0 is refused because it is the value a never-migrated database already
 * reports, so a step numbered 0 could never be detected as pending.
 */
function isWellFormed(ordered: readonly Migration[]): boolean {
  const versions = ordered.map((migration) => migration.version)
  const numbered = versions.every((version) => Number.isInteger(version) && version > 0)
  return numbered && new Set(versions).size === versions.length
}

/** Reads `PRAGMA user_version`, treating a driver that returns nothing as version 0. */
async function readVersion(db: SqliteDatabase): Promise<number> {
  const row = await db.selectOne<{ user_version: number }>('PRAGMA user_version')
  return row === null ? 0 : row.user_version
}

/** Applies one step atomically, bumping the version as the final statement. */
async function applyStep(db: SqliteDatabase, migration: Migration): Promise<Result<void>> {
  await db.execute('BEGIN')
  try {
    await migration.apply(db)
    // Not parameterizable: SQLite pragmas take literals only. Safe because
    // isWellFormed has already established this is a positive integer.
    await db.execute(`PRAGMA user_version = ${migration.version}`)
    await db.execute('COMMIT')
    return ok(undefined)
  } catch (cause) {
    await rollbackQuietly(db)
    return err(storageError('storage.migration-failed', cause))
  }
}

/**
 * Undoes the open step without masking why it failed.
 *
 * SQLite rolls back on its own for some constraint violations, which makes an explicit
 * `ROLLBACK` fail with "no transaction is active". That secondary error is noise; the
 * original cause is the one worth returning.
 */
async function rollbackQuietly(db: SqliteDatabase): Promise<void> {
  try {
    await db.execute('ROLLBACK')
  } catch {
    // Already rolled back by the driver. Nothing left to undo.
  }
}
