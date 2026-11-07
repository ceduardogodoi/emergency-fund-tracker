import type { ReminderRepository } from '@/domain/ports/repositories'
import { DEFAULT_REMINDER_SETTING } from '@/domain/reminders/schedule'
import type { ReminderSetting } from '@/domain/reminders/types'
import type { Result } from '@/domain/result'

import type { SqliteDatabase } from '../driver'
import { toReminderParams, toReminderSetting, type ReminderRow } from '../mappers/reminder'
import { attempt } from './attempt'

const SELECT = `
  SELECT enabled, frequency, day_of_month, day_of_week, time_of_day
  FROM reminder_setting
  WHERE id = 1
`

/**
 * One row, by constraint (`reminder_single_row`), so a second save replaces the first
 * rather than failing on the key.
 */
const UPSERT = `
  INSERT INTO reminder_setting (id, enabled, frequency, day_of_month, day_of_week, time_of_day)
  VALUES (1, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    enabled      = excluded.enabled,
    frequency    = excluded.frequency,
    day_of_month = excluded.day_of_month,
    day_of_week  = excluded.day_of_week,
    time_of_day  = excluded.time_of_day
`

/**
 * Builds the SQLite-backed {@link ReminderRepository}.
 *
 * No row is a first launch, or the moment after an erase (FR-048), and reads as the
 * default — off (FR-034). The default is not written on read, so the store never holds a
 * setting the user did not choose.
 *
 * @param db The connection the current transaction runs on.
 * @returns The repository.
 */
export function createReminderRepository(db: SqliteDatabase): ReminderRepository {
  return {
    async get(): Promise<Result<ReminderSetting>> {
      return attempt('reminders.read-failed', async () => {
        const row = await db.selectOne<ReminderRow>(SELECT)
        return row === null ? DEFAULT_REMINDER_SETTING : toReminderSetting(row)
      })
    },

    async save(setting: ReminderSetting): Promise<Result<ReminderSetting>> {
      return attempt('reminders.save-failed', async () => {
        await db.run(UPSERT, toReminderParams(setting))
        return setting
      })
    },
  }
}
