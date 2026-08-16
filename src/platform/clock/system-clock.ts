import { calendarDate, type CalendarDate } from '@/domain/dates/calendar-date'
import { instant, type Instant } from '@/domain/dates/instant'
import type { Clock } from '@/domain/ports/clock'

/** Supplies the current moment. Swapped in tests so assertions can name exact dates. */
export type NowSource = () => Date

/**
 * The real clock, reading the device's time and zone.
 *
 * Takes its `Date` source as a constructor dependency rather than calling `new Date()`
 * inline. That keeps this adapter itself deterministically testable, and means nothing in
 * the codebase — adapter included — reads the wall clock without going through a seam.
 */
export class SystemClock implements Clock {
  /**
   * @param nowSource Where the current moment comes from. Defaults to the real clock;
   *   inject a fixed source in tests.
   */
  constructor(private readonly nowSource: NowSource = () => new Date()) {}

  /**
   * Today in the device's local zone.
   *
   * Uses local-time getters deliberately: the user's "today" is the date on the wall
   * behind them, not the UTC date, and near midnight those differ.
   */
  today(): CalendarDate {
    const now = this.nowSource()
    const year = String(now.getFullYear()).padStart(4, '0')
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return calendarDate(`${year}-${month}-${day}`)
  }

  /** The current instant in UTC, for audit fields. */
  now(): Instant {
    return instant(this.nowSource().toISOString())
  }

  /** The device's IANA zone id, used only to resolve which calendar day it is. */
  timeZone(): string {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  }
}
