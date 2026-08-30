import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite'

import type { SqliteDatabase, SqlRunResult, SqlValue } from './driver'

/**
 * The database file on the device.
 *
 * Named rather than defaulted so the name is a decision recorded in one place — it is what
 * a user's fund is stored under, and changing it silently would orphan every existing
 * install's data.
 */
export const DATABASE_NAME = 'emergency-fund.db'

/**
 * Opens the device database and adapts it to the {@link SqliteDatabase} port.
 *
 * The other implementation of this port is the `better-sqlite3` wrapper in
 * `tests/support/sqlite-harness.ts`. Both are SQLite, so the SQL, the constraints, and the
 * transaction semantics are the engine's own on either — only the binding differs. That is
 * the fidelity gap research decision D-006 accepts, and this file is the whole of it, which
 * is why it holds no logic beyond renaming methods.
 *
 * Not unit-tested: `expo-sqlite` is a native module and cannot load in the Node test
 * process. The on-device smoke flow is what covers it.
 *
 * @returns The adapted database, migrations not yet applied — call `bootstrapDatabase`.
 */
export async function openDeviceDatabase(): Promise<SqliteDatabase> {
  return adapt(await openDatabaseAsync(DATABASE_NAME))
}

/**
 * Wraps the Expo driver in the app's interface.
 *
 * The read methods are declared as generic methods rather than arrow properties: an arrow
 * property cannot carry a type parameter, so contextual typing would collapse `TRow` and
 * every caller would silently get back `unknown`.
 */
function adapt(db: SQLiteDatabase): SqliteDatabase {
  return {
    async execute(sql: string): Promise<void> {
      await db.execAsync(sql)
    },

    async run(sql: string, params?: readonly SqlValue[]): Promise<SqlRunResult> {
      const result = await db.runAsync(sql, bind(params))
      return { changes: result.changes, lastInsertRowId: result.lastInsertRowId }
    },

    async selectAll<TRow>(sql: string, params?: readonly SqlValue[]): Promise<readonly TRow[]> {
      return db.getAllAsync<TRow>(sql, bind(params))
    },

    async selectOne<TRow>(sql: string, params?: readonly SqlValue[]): Promise<TRow | null> {
      return db.getFirstAsync<TRow>(sql, bind(params))
    },

    async close(): Promise<void> {
      await db.closeAsync()
    },
  }
}

/** The driver takes a mutable array and rejects an `undefined` list where the app omits it. */
function bind(params?: readonly SqlValue[]): SqlValue[] {
  return params === undefined ? [] : [...params]
}
