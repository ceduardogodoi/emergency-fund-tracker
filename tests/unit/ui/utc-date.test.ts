import { calendarDate } from '@/domain/dates/calendar-date'
import { fromUtcDate, toUtcDate } from '@/ui/format'

/**
 * The one place a `CalendarDate` becomes a `Date` and back.
 *
 * A calendar day has no instant, so any `Date` standing for one is a convention. This one
 * is UTC midnight, because that is what the native date pickers were measured returning on
 * both platforms (2026-09-26, Expo Go, UTC−3 devices): a tap on the 15th arrives as
 * `2026-09-15T00:00:00.000Z`. Read back with local getters at UTC−3 that is the 14th — the
 * suite runs in that zone so the mistake shows here rather than on a user's device.
 */
describe('the calendar date boundary', () => {
  it('places a calendar date at UTC midnight', () => {
    expect(toUtcDate(calendarDate('2026-09-15')).toISOString()).toBe('2026-09-15T00:00:00.000Z')
  })

  it('reads UTC midnight back as the same day, west of Greenwich', () => {
    expect(fromUtcDate(new Date('2026-09-15T00:00:00.000Z'))).toBe('2026-09-15')
  })

  // The picker reports whole days, but nothing in the type says so. A time later in the
  // UTC day is still that day; reading it locally would be the 14th until 03:00.
  it('reads any instant by its UTC day, whatever the time', () => {
    expect(fromUtcDate(new Date('2026-09-15T23:59:59.999Z'))).toBe('2026-09-15')
  })

  it('round-trips across a year boundary', () => {
    const date = calendarDate('2026-12-31')

    expect(fromUtcDate(toUtcDate(date))).toBe(date)
  })
})
