import type { StoreRepository } from '@/domain/ports/repositories'

import type { SqliteDatabase } from '../driver'
import { attempt } from './attempt'

/**
 * Every table that holds the user's data, in the order they are emptied.
 *
 * Listed, so what an erase deletes can be read here. The integration test reads the schema
 * instead, so a table a later migration adds and this list forgets fails there rather than
 * surviving an erase the user was told was complete. No table references another, so the
 * order is free.
 */
const TABLES = [
  'ledger_entry',
  'goal_change',
  'goal',
  'profile',
  'reminder_setting',
  'milestone_ack',
] as const

/**
 * The store as a whole, over the connection the current transaction runs on.
 *
 * @param db The connection.
 * @returns The repository.
 */
export function createStoreRepository(db: SqliteDatabase): StoreRepository {
  return {
    eraseAll: async () =>
      attempt('store.erase-failed', async () => {
        await db.execute(TABLES.map((table) => `DELETE FROM ${table};`).join('\n'))
      }),
  }
}
