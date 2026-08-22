import Database from 'better-sqlite3'

import { bootstrapDatabase } from '@/data/sqlite/database'
import type { SqliteDatabase, SqlRunResult, SqlValue } from '@/data/sqlite/driver'
import { isErr } from '@/domain/result'

/**
 * A real SQLite database, in memory, speaking the same interface the app uses on device.
 *
 * Research D-006 accepts one deliberate fidelity gap: the driver here is
 * `better-sqlite3` rather than `expo-sqlite`. Both are SQLite, so the SQL, the
 * constraints, and the transaction semantics under test are the engine's own — only the
 * binding differs, and the on-device smoke flow covers that.
 */
export type TestDatabase = SqliteDatabase

/**
 * Opens an empty in-memory database with no schema and no migrations applied.
 *
 * Use this only to test the migration machinery itself. Everything else wants
 * {@link createMigratedDatabase}, which arrives at the state the app actually boots into.
 *
 * @returns A fresh database. Close it in `afterEach` so a suite cannot leak handles.
 */
export function createTestDatabase(): TestDatabase {
  return adapt(new Database(':memory:'))
}

/**
 * Opens a fresh in-memory database at the newest schema version.
 *
 * Boots through the same {@link bootstrapDatabase} the app uses rather than executing the
 * schema directly, so a repository test runs against the pragmas and migrations a device
 * would have — a test passing on a schema the app never produces proves nothing.
 *
 * @throws {Error} If migrations fail, since every test built on this would otherwise fail
 *   later with a confusing missing-table error instead of the real cause.
 */
export async function createMigratedDatabase(): Promise<TestDatabase> {
  const db = adapt(new Database(':memory:'))
  const result = await bootstrapDatabase(db)
  if (isErr(result)) {
    throw new Error(`Test database failed to migrate: ${JSON.stringify(result.error)}`)
  }
  return db
}

/**
 * Wraps the synchronous driver in the app's asynchronous interface.
 *
 * The read methods are declared as generic methods rather than arrow properties: an
 * arrow property cannot carry a type parameter, so contextual typing would silently
 * collapse `TRow` and every caller would get back `unknown`.
 */
function adapt(db: Database.Database): TestDatabase {
  return {
    async execute(sql: string): Promise<void> {
      db.exec(sql)
    },

    async run(sql: string, params?: readonly SqlValue[]): Promise<SqlRunResult> {
      return toRunResult(db.prepare(sql).run(...bind(params)))
    },

    async selectAll<TRow>(sql: string, params?: readonly SqlValue[]): Promise<readonly TRow[]> {
      return db.prepare(sql).all(...bind(params)) as TRow[]
    },

    async selectOne<TRow>(sql: string, params?: readonly SqlValue[]): Promise<TRow | null> {
      return (db.prepare(sql).get(...bind(params)) as TRow | undefined) ?? null
    },

    async close(): Promise<void> {
      db.close()
    },
  }
}

/** `better-sqlite3` rejects an `undefined` argument list where the app omits it. */
function bind(params?: readonly SqlValue[]): SqlValue[] {
  return params === undefined ? [] : [...params]
}

/** Normalises the driver's result shape, including its bigint rowid, to the app's. */
function toRunResult(result: Database.RunResult): SqlRunResult {
  return { changes: result.changes, lastInsertRowId: Number(result.lastInsertRowid) }
}
