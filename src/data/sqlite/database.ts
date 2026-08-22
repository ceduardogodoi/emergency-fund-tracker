import { storageError } from '@/domain/errors/app-error'
import type { Repositories } from '@/domain/ports/repositories'
import type { UnitOfWork } from '@/domain/ports/unit-of-work'
import { err, type Result } from '@/domain/result'

import type { SqliteDatabase } from './driver'
import { MIGRATIONS } from './migrations'
import { migrate, type Migration, type MigrationReport } from './migrations/runner'

/**
 * Prepares an opened database for use: pragmas first, then migrations.
 *
 * Foreign key enforcement is off by default in SQLite and must be turned on per
 * connection — a default that silently turns a declared relationship into a comment.
 * It is set here rather than inside a migration because pragmas cannot be changed from
 * within a transaction, which is where every migration runs.
 *
 * @param migrations Overridable so a migration test can boot an older schema on purpose.
 * @returns What the upgrade did, or a storage failure leaving the database as it was.
 */
export async function bootstrapDatabase(
  db: SqliteDatabase,
  migrations: readonly Migration[] = MIGRATIONS,
): Promise<Result<MigrationReport>> {
  await db.execute('PRAGMA foreign_keys = ON')
  return migrate(db, migrations)
}

/**
 * Builds the repository set bound to a particular database handle.
 *
 * Taken as a parameter rather than imported so this module stays unaware of which
 * repositories exist — the composition root owns that list, and this owns the
 * transaction.
 */
export type RepositoriesFactory = (db: SqliteDatabase) => Repositories

/**
 * Creates the transaction wrapper every multi-write operation runs inside.
 *
 * Uses savepoints rather than `BEGIN`/`COMMIT`. A savepoint opened outside a transaction
 * starts one, so the same three statements serve both the outer and any nested call, and
 * an import that happens to run inside an erase does not fail with "cannot start a
 * transaction within a transaction".
 *
 * Overlapping top-level calls are queued rather than allowed to interleave. On an async
 * driver two unawaited calls would otherwise nest by accident, and one rolling back would
 * silently discard the other's writes.
 */
export function createUnitOfWork(
  db: SqliteDatabase,
  buildRepositories: RepositoriesFactory,
): UnitOfWork {
  let depth = 0
  let queue: Promise<unknown> = Promise.resolve()

  async function runInSavepoint<T>(
    work: (repos: Repositories) => Promise<Result<T>>,
  ): Promise<Result<T>> {
    const name = `uow_${depth}`
    depth += 1
    await db.execute(`SAVEPOINT ${name}`)
    try {
      const result = await work(buildRepositories(db))
      await db.execute(result.ok ? `RELEASE ${name}` : `ROLLBACK TO ${name}; RELEASE ${name}`)
      return result
    } catch (cause) {
      await rollbackQuietly(db, name)
      return err(storageError('storage.transaction-failed', cause))
    } finally {
      depth -= 1
    }
  }

  return {
    run: (work) => {
      // A nested call is already inside the queued outer transaction; queueing it again
      // would make it wait on the transaction it is running in, which never completes.
      if (depth > 0) {
        return runInSavepoint(work)
      }
      const next = queue.then(() => runInSavepoint(work))
      queue = next.catch(() => undefined)
      return next
    },
  }
}

/**
 * Undoes the open savepoint without masking why the work failed.
 *
 * Some constraint violations make SQLite roll back on its own, which leaves nothing for
 * `ROLLBACK TO` to find. That secondary error is noise; the original cause is the one the
 * caller needs.
 */
async function rollbackQuietly(db: SqliteDatabase, name: string): Promise<void> {
  try {
    await db.execute(`ROLLBACK TO ${name}; RELEASE ${name}`)
  } catch {
    // Already unwound by the driver. Nothing left to undo.
  }
}
