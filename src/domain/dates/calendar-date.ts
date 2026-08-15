/**
 * Calendar dates with no time and no timezone.
 *
 * An entry belongs to the date the user picked, and must stay there regardless of where
 * the device travels — the spec's timezone edge case requires exactly this, and a
 * timestamp cannot guarantee it. Every operation here works in UTC internally so that
 * the host machine's zone can never shift a date across a boundary.
 *
 * ISO-8601 date strings sort lexicographically, which is why comparison and ordering
 * need no parsing at all.
 */

/** An ISO-8601 calendar date, `YYYY-MM-DD`. Construct through {@link calendarDate}. */
export type CalendarDate = string & { readonly __brand: 'CalendarDate' }

/**
 * A year-and-month bucket key, `YYYY-MM`. Deliberately a plain `string`: month keys are
 * derived, compared, and written as literals throughout, and a brand would add friction
 * without preventing a real error.
 */
export type MonthKey = string

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const MONTH_PATTERN = /^\d{4}-\d{2}$/

/**
 * Number of days in a month, via UTC so the host timezone cannot shift the answer.
 *
 * @param year Four-digit year.
 * @param month One-based month, 1–12.
 */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/**
 * Splits a validated month key into its numeric parts.
 *
 * @throws {RangeError} If the key is not `YYYY-MM`.
 */
function partsOfMonth(key: MonthKey): { year: number; month: number } {
  if (!MONTH_PATTERN.test(key)) {
    throw new RangeError(`Expected a month key of the form YYYY-MM, received "${key}"`)
  }
  return { year: Number(key.slice(0, 4)), month: Number(key.slice(5, 7)) }
}

/**
 * Validates and brands a calendar date.
 *
 * Rejects dates that do not exist — `2026-02-30` and `2026-02-29` are both refused,
 * while `2024-02-29` is accepted — because silently rolling an impossible date forward
 * would misfile an entry into the wrong month and corrupt every statistic built on it.
 *
 * @param value A string in `YYYY-MM-DD` form.
 * @throws {RangeError} If malformed, or if the date is not a real calendar date.
 */
export function calendarDate(value: string): CalendarDate {
  if (!DATE_PATTERN.test(value)) {
    throw new RangeError(`Expected a date of the form YYYY-MM-DD, received "${value}"`)
  }
  const year = Number(value.slice(0, 4))
  const month = Number(value.slice(5, 7))
  const day = Number(value.slice(8, 10))

  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw new RangeError(`"${value}" is not a real calendar date`)
  }
  return value as CalendarDate
}

/**
 * Orders two dates chronologically, in the shape `Array.prototype.sort` expects.
 *
 * @returns Negative when `a` is earlier, positive when later, zero when the same day.
 */
export function compareDates(a: CalendarDate, b: CalendarDate): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** True when `a` falls strictly after `b`. Used to reject future-dated entries (FR-009). */
export function isAfter(a: CalendarDate, b: CalendarDate): boolean {
  return compareDates(a, b) > 0
}

/** True when `a` falls strictly before `b`. */
export function isBefore(a: CalendarDate, b: CalendarDate): boolean {
  return compareDates(a, b) < 0
}

/** The month bucket a date belongs to — the grouping key for statistics and pace. */
export function monthKey(date: CalendarDate): MonthKey {
  return date.slice(0, 7)
}

/**
 * Shifts a date by whole months, clamping the day when the target month is shorter.
 *
 * Clamping matters for projection: adding one month to 31 January yields 28 February
 * rather than rolling into March, so a projected date never lands in the wrong month.
 *
 * @param months May be negative to move backward.
 */
export function addMonths(date: CalendarDate, months: number): CalendarDate {
  const year = Number(date.slice(0, 4))
  const month = Number(date.slice(5, 7))
  const day = Number(date.slice(8, 10))

  const zeroBased = year * 12 + (month - 1) + months
  const targetYear = Math.floor(zeroBased / 12)
  const targetMonth = (zeroBased % 12) + 1
  const targetDay = Math.min(day, daysInMonth(targetYear, targetMonth))

  return calendarDate(`${pad(targetYear, 4)}-${pad(targetMonth, 2)}-${pad(targetDay, 2)}`)
}

/**
 * The final day of a month — the date a projection resolves to, since reaching a target
 * "in N months" means by the end of that month.
 */
export function lastDayOfMonth(key: MonthKey): CalendarDate {
  const { year, month } = partsOfMonth(key)
  return calendarDate(`${key}-${pad(daysInMonth(year, month), 2)}`)
}

/** The first day of a month. */
export function firstDayOfMonth(key: MonthKey): CalendarDate {
  return calendarDate(`${key}-01`)
}

/** The month immediately before the given one, crossing the year boundary correctly. */
export function previousMonth(key: MonthKey): MonthKey {
  const { year, month } = partsOfMonth(key)
  return month === 1 ? `${pad(year - 1, 4)}-12` : `${key.slice(0, 4)}-${pad(month - 1, 2)}`
}

/**
 * Every month key from `from` to `to` inclusive, in ascending order.
 *
 * Months with no activity are included, because FR-022 requires the breakdown to show
 * the gaps — a month the user saved nothing is information, not an absence of it.
 *
 * @returns An empty list when the range is inverted.
 */
export function monthKeysBetween(from: MonthKey, to: MonthKey): readonly MonthKey[] {
  if (from > to) {
    return []
  }
  const keys: MonthKey[] = []
  let cursor = from
  while (cursor <= to) {
    keys.push(cursor)
    cursor = nextMonth(cursor)
  }
  return keys
}

/** The month immediately after the given one, crossing the year boundary correctly. */
export function nextMonth(key: MonthKey): MonthKey {
  const { year, month } = partsOfMonth(key)
  return month === 12 ? `${pad(year + 1, 4)}-01` : `${key.slice(0, 4)}-${pad(month + 1, 2)}`
}

/**
 * The most recent *complete* calendar months before today, ascending.
 *
 * The in-progress month is always excluded (research D-017): including it would drag the
 * saving pace down purely because the month has not finished, showing every user a
 * pessimistic projection that improves on the last day of each month for no real reason.
 * This holds even on the last day of a month — that month is still in progress.
 *
 * @param today The current date, from the injected `Clock` — never `new Date()`.
 * @param count How many complete months to return, at most.
 */
export function completeMonthKeysBefore(today: CalendarDate, count: number): readonly MonthKey[] {
  if (count <= 0) {
    return []
  }
  const lastComplete = previousMonth(monthKey(today))
  const keys: MonthKey[] = []
  let cursor = lastComplete
  for (let i = 0; i < count; i += 1) {
    keys.unshift(cursor)
    cursor = previousMonth(cursor)
  }
  return keys
}

/**
 * Left-pads a number with zeros to a fixed width.
 *
 * @param width Total digits in the result.
 */
function pad(value: number, width: number): string {
  return String(value).padStart(width, '0')
}
