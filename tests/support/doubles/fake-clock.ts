import { calendarDate, type CalendarDate } from '@/domain/dates/calendar-date'
import { instant, type Instant } from '@/domain/dates/instant'
import type { Clock } from '@/domain/ports/clock'

/** How a {@link FakeClock} reports the moment and place, when the defaults will not do. */
export interface FakeClockOptions {
  /** The UTC instant for audit fields. Defaults to midday on the given day. */
  readonly instant?: string
  /** The IANA zone id to report. Defaults to UTC. */
  readonly timeZone?: string
}

/**
 * A clock that only moves when a test moves it.
 *
 * Principle IV forbids a test that depends on wall-clock time or timezone. Streaks, the
 * pace window, the future-date rule, and every projection are functions of today's date,
 * so without this they could only be asserted approximately — and a test that asserts
 * approximately is a test that has stopped catching the off-by-one.
 */
export class FakeClock implements Clock {
  private currentDate: CalendarDate
  private currentInstant: Instant
  private readonly options: FakeClockOptions

  /**
   * @param today The date to report, `YYYY-MM-DD`.
   * @param options Overrides for the instant and zone. The instant defaults to midday, so
   *   a test that shifts by a few hours does not accidentally change the date as well.
   */
  public constructor(today = '2026-08-22', options: FakeClockOptions = {}) {
    this.currentDate = calendarDate(today)
    this.currentInstant = instant(options.instant ?? `${today}T12:00:00.000Z`)
    this.options = options
  }

  /** @returns The fixed date this clock was last set to. */
  public today(): CalendarDate {
    return this.currentDate
  }

  /** @returns The fixed audit instant this clock was last set to. */
  public now(): Instant {
    return this.currentInstant
  }

  /** @returns The configured zone id, UTC unless a test asked for another. */
  public timeZone(): string {
    return this.options.timeZone ?? 'UTC'
  }

  /**
   * Moves the clock to a new day, keeping the instant consistent with it.
   *
   * @param date The new today, `YYYY-MM-DD`.
   */
  public setToday(date: string): void {
    this.currentDate = calendarDate(date)
    this.currentInstant = instant(`${date}T12:00:00.000Z`)
  }

  /**
   * Sets the audit instant alone, leaving today's date where it is.
   *
   * Use when two writes on the same day have to be distinguishable by timestamp.
   *
   * @param value An ISO 8601 UTC instant ending in `Z`.
   */
  public setNow(value: string): void {
    this.currentInstant = instant(value)
  }
}
