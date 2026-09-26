import { calendarDate, type CalendarDate } from '@/domain/dates/calendar-date'

/**
 * The one place a calendar date becomes a `Date`, and the one place it comes back.
 *
 * A calendar day has no instant, so any `Date` standing for one is a convention, and every
 * API that needs one has to agree on it. This one is UTC midnight. The formatters render
 * with `timeZone: 'UTC'` for that reason, and it is what the native date pickers return:
 * measured on 2026-09-26 in Expo Go on an Android emulator and an iOS simulator, both at
 * UTC−3, a tap on the 15th arrived as `2026-09-15T00:00:00.000Z` on each — Android natively,
 * iOS once told to draw its calendar in UTC, which `DatePicker` does. Local getters read that
 * as the 14th, which is why the way back reads UTC too.
 */

/**
 * Builds a `Date` fixed at UTC midnight on the given calendar day.
 *
 * Reads the digits by position instead of handing the string to the `Date` constructor.
 * The parse would happen to work for this format today, but it is the same call that
 * silently accepts a dozen other shapes and resolves several of them in local time.
 *
 * @param value A `YYYY-MM-DD` date. Its shape is guaranteed by the `CalendarDate` brand.
 * @returns UTC midnight at the start of that day.
 */
export function toUtcDate(value: string): Date {
  const year = Number(value.slice(0, 4))
  const month = Number(value.slice(5, 7))
  const day = Number(value.slice(8, 10))
  return new Date(Date.UTC(year, month - 1, day))
}

/**
 * The calendar day a `Date` falls on in UTC.
 *
 * Any time within the UTC day reads as that day, not only midnight: the pickers report
 * whole days, but nothing in the `Date` type promises it.
 *
 * @param value An instant produced under the UTC-midnight convention.
 * @returns The day it stands for.
 */
export function fromUtcDate(value: Date): CalendarDate {
  const year = String(value.getUTCFullYear()).padStart(4, '0')
  const month = String(value.getUTCMonth() + 1).padStart(2, '0')
  const day = String(value.getUTCDate()).padStart(2, '0')
  return calendarDate(`${year}-${month}-${day}`)
}
