import { validationError, type AppError, type ValidationError } from '../errors'
import { err, ok, type Result } from '../result'
import type { ReminderSetting } from './types'

/**
 * The last day of the month a monthly reminder may fall on.
 *
 * Every month has a 28th, so a reminder on it can never silently skip February. The schema
 * holds the same bound (`reminder_day_of_month_range`).
 */
export const MAXIMUM_DAY_OF_MONTH = 28

/** The highest day of the week, Saturday, counting Sunday as 0 as `Date` does. */
const MAXIMUM_DAY_OF_WEEK = 6

/** How far one press of the minute stepper moves, in minutes. */
export const MINUTE_STEP = 15

const HOURS_IN_DAY = 24
const MINUTES_IN_HOUR = 60

/** A local time of day on a 24-hour clock. */
export interface TimeOfDay {
  /** 0 to 23. */
  readonly hour: number
  /** 0 to 59. */
  readonly minute: number
}

/** The day of the month the default schedule falls on. See {@link DEFAULT_REMINDER_SETTING}. */
export const DEFAULT_DAY_OF_MONTH = 5

/** The time the default schedule falls at. See {@link DEFAULT_REMINDER_SETTING}. */
export const DEFAULT_TIME_OF_DAY: TimeOfDay = { hour: 9, minute: 0 }

/**
 * The setting a first launch reads: off (FR-034), and the schedule the form starts on when
 * the user turns it on — monthly on the 5th at 09:00, close to a typical payday. Decided
 * with the user on 2026-11-07.
 */
export const DEFAULT_REMINDER_SETTING: ReminderSetting = {
  enabled: false,
  frequency: 'monthly',
  dayOfMonth: DEFAULT_DAY_OF_MONTH,
  dayOfWeek: null,
  timeOfDay: formatTimeOfDay(DEFAULT_TIME_OF_DAY),
}

/** `HH:MM`, two digits each. The ranges are checked after the match. */
const TIME_SHAPE = /^(\d{2}):(\d{2})$/

/**
 * Reads a stored `HH:MM` time.
 *
 * @param value The time as stored.
 * @returns The hour and minute, or null when the value is not a time on a 24-hour clock —
 *   including `24:00`, which the schema's GLOB would let through.
 */
export function parseTimeOfDay(value: string): TimeOfDay | null {
  const match = TIME_SHAPE.exec(value)
  if (match === null) {
    return null
  }
  const hour = Number(match[1])
  const minute = Number(match[2])
  return hour < HOURS_IN_DAY && minute < MINUTES_IN_HOUR ? { hour, minute } : null
}

/**
 * Writes a time the way it is stored and shown: `HH:MM`, two digits each.
 *
 * @param time A time whose fields are in range.
 * @returns The time as text.
 */
export function formatTimeOfDay(time: TimeOfDay): string {
  return `${twoDigits(time.hour)}:${twoDigits(time.minute)}`
}

/** A press of a stepper: up or down. */
export type StepDirection = 1 | -1

/**
 * Moves the hour by one, round the clock: 23 goes to 0 and 0 to 23, so every hour is in
 * reach from every other.
 *
 * @param time The time to move.
 * @param direction Up or down.
 * @returns The time an hour later or earlier, minutes unchanged.
 */
export function stepHour(time: TimeOfDay, direction: StepDirection): TimeOfDay {
  return { ...time, hour: wrap(time.hour + direction, HOURS_IN_DAY) }
}

/**
 * Moves the minutes to the next or previous quarter of an hour, round the hour.
 *
 * The hour is left alone, so 07:45 goes up to 07:00 rather than 08:00: a press of the
 * minute stepper changes the minutes, which is what the user pressed. A time between
 * quarters — from an import, say — lands on the nearest quarter in the direction pressed.
 *
 * @param time The time to move.
 * @param direction Up or down.
 * @returns The time with its minutes on a quarter, hour unchanged.
 */
export function stepMinute(time: TimeOfDay, direction: StepDirection): TimeOfDay {
  const quarters = time.minute / MINUTE_STEP
  const next = direction === 1 ? Math.floor(quarters) + 1 : Math.ceil(quarters) - 1
  return { ...time, minute: wrap(next * MINUTE_STEP, MINUTES_IN_HOUR) }
}

/**
 * Checks a reminder setting is one schedule, and a possible one.
 *
 * The screen only offers valid choices; this is for what reaches storage another way, and
 * it mirrors the schema's constraints so a bad setting is refused with a reason rather
 * than by the database. A disabled setting is checked as strictly as an enabled one,
 * because it is what the form opens on next time.
 *
 * @param setting The setting to check.
 * @returns The setting unchanged, or the first rule it breaks, attached to its field.
 */
export function validateReminderSetting(
  setting: ReminderSetting,
): Result<ReminderSetting, AppError> {
  const dayError =
    setting.frequency === 'monthly'
      ? checkDays(
          setting.dayOfMonth,
          setting.dayOfWeek,
          'dayOfMonth',
          'dayOfWeek',
          1,
          MAXIMUM_DAY_OF_MONTH,
        )
      : checkDays(
          setting.dayOfWeek,
          setting.dayOfMonth,
          'dayOfWeek',
          'dayOfMonth',
          0,
          MAXIMUM_DAY_OF_WEEK,
        )
  if (dayError !== null) {
    return err(dayError)
  }
  if (parseTimeOfDay(setting.timeOfDay) === null) {
    return err(validationError('timeOfDay', 'reminder.time-invalid'))
  }
  return ok(setting)
}

/** The day fields, by the name the validation error attaches to. */
type DayField = 'dayOfMonth' | 'dayOfWeek'

/** The key for a missing or out-of-range day, by field. */
const OUT_OF_RANGE: Readonly<Record<DayField, string>> = {
  dayOfMonth: 'reminder.day-of-month-out-of-range',
  dayOfWeek: 'reminder.day-of-week-out-of-range',
}

/**
 * The frequency's own day has to be a whole number in range; the other frequency's day has
 * to be absent, or the setting is two schedules at once.
 */
function checkDays(
  own: number | null,
  other: number | null,
  ownField: DayField,
  otherField: DayField,
  minimum: number,
  maximum: number,
): ValidationError | null {
  if (own === null || !Number.isInteger(own) || own < minimum || own > maximum) {
    return validationError(ownField, OUT_OF_RANGE[ownField])
  }
  if (other !== null) {
    return validationError(otherField, 'reminder.day-not-for-frequency')
  }
  return null
}

/** `value` brought into `0 ..< size`, from either side. */
function wrap(value: number, size: number): number {
  return ((value % size) + size) % size
}

function twoDigits(value: number): string {
  return String(value).padStart(2, '0')
}
