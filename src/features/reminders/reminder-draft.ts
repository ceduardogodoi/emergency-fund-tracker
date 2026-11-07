import {
  DEFAULT_DAY_OF_MONTH,
  DEFAULT_TIME_OF_DAY,
  formatTimeOfDay,
  parseTimeOfDay,
  type TimeOfDay,
} from '@/domain/reminders/schedule'
import type { ReminderFrequency, ReminderSetting } from '@/domain/reminders/types'

/** The weekday a weekly schedule starts on when nothing was stored for it: Monday. */
export const DEFAULT_DAY_OF_WEEK = 1

/**
 * The form as the user has it.
 *
 * Both days are always held, unlike the stored setting, which keeps only the frequency's
 * own: moving from monthly to weekly and back returns to the day the user had chosen.
 */
export interface ReminderDraft {
  readonly enabled: boolean
  readonly frequency: ReminderFrequency
  /** 1 to 28. */
  readonly dayOfMonth: number
  /** 0, Sunday, to 6. */
  readonly dayOfWeek: number
  readonly time: TimeOfDay
}

/**
 * The form a stored setting opens as.
 *
 * @param setting The setting as stored.
 * @returns The draft, with the other frequency's day filled in from the defaults.
 */
export function draftFromSetting(setting: ReminderSetting): ReminderDraft {
  return {
    enabled: setting.enabled,
    frequency: setting.frequency,
    dayOfMonth: setting.dayOfMonth ?? DEFAULT_DAY_OF_MONTH,
    dayOfWeek: setting.dayOfWeek ?? DEFAULT_DAY_OF_WEEK,
    // A stored time that is not one would have been refused on the way in, by the domain
    // and the schema both; the default is what the form falls back to rather than nothing.
    time: parseTimeOfDay(setting.timeOfDay) ?? DEFAULT_TIME_OF_DAY,
  }
}

/**
 * The setting a draft saves as: only the frequency's own day, as the schema requires.
 *
 * @param draft The form as the user has it.
 * @returns The setting to save.
 */
export function settingFromDraft(draft: ReminderDraft): ReminderSetting {
  return {
    enabled: draft.enabled,
    frequency: draft.frequency,
    dayOfMonth: draft.frequency === 'monthly' ? draft.dayOfMonth : null,
    dayOfWeek: draft.frequency === 'weekly' ? draft.dayOfWeek : null,
    timeOfDay: formatTimeOfDay(draft.time),
  }
}
