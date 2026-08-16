import type { CalendarDate } from '../dates/calendar-date'
import type { Instant } from '../dates/instant'

/**
 * The only source of "now" in the codebase.
 *
 * Streaks, pace windows, projections, and the future-date rule are all functions of
 * today's date, and none of them is deterministically testable if the implementation
 * reaches for `new Date()` directly. Principle IV forbids tests that depend on wall-clock
 * time or timezone, so this port is what makes that rule satisfiable rather than
 * aspirational — tests inject a fixed clock and assert exact dates.
 */
export interface Clock {
  /** Today in the device's local zone — the date an entry defaults to. */
  today(): CalendarDate

  /** The current instant in UTC, for audit fields. */
  now(): Instant

  /**
   * The device's IANA timezone id, used only to resolve which calendar day it is.
   *
   * Never stored on an entry: once a user assigns a date, that date is theirs regardless
   * of where the device later travels.
   */
  timeZone(): string
}
