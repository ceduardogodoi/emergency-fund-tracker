import type { ReminderFrequency, ReminderSetting } from '@/domain/reminders/types'

import type { SqlValue } from '../driver'

/** The `reminder_setting` row as SQLite hands it back. */
export interface ReminderRow {
  /** 0 or 1. SQLite has no boolean. */
  readonly enabled: number
  readonly frequency: string
  readonly day_of_month: number | null
  readonly day_of_week: number | null
  readonly time_of_day: string
}

/**
 * Turns the stored row into a {@link ReminderSetting}.
 *
 * `enabled` is compared with 1 rather than read for truthiness, so the one value meaning
 * "on" is the one the schema writes for it.
 *
 * @param row The row as read.
 * @returns The domain setting.
 */
export function toReminderSetting(row: ReminderRow): ReminderSetting {
  return {
    enabled: row.enabled === 1,
    // The schema's CHECK admits 'weekly' and 'monthly' alone. The cast states that;
    // re-validating would test SQLite.
    frequency: row.frequency as ReminderFrequency,
    dayOfMonth: row.day_of_month,
    dayOfWeek: row.day_of_week,
    timeOfDay: row.time_of_day,
  }
}

/**
 * The setting as the upsert's parameters, in column order: `enabled`, `frequency`,
 * `day_of_month`, `day_of_week`, `time_of_day`.
 *
 * @param setting The setting to store.
 * @returns The parameters.
 */
export function toReminderParams(setting: ReminderSetting): readonly SqlValue[] {
  return [
    setting.enabled ? 1 : 0,
    setting.frequency,
    setting.dayOfMonth,
    setting.dayOfWeek,
    setting.timeOfDay,
  ]
}
