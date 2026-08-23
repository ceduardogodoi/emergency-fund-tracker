import {
  addMonths,
  calendarDate,
  compareDates,
  completeMonthKeysBefore,
  firstDayOfMonth,
  isAfter,
  isBefore,
  lastDayOfMonth,
  monthKey,
  monthKeysBetween,
  nextMonth,
  previousMonth,
} from '@/domain/dates/calendar-date'

/**
 * Entry dates are calendar dates with no time and no timezone. The spec's timezone
 * edge case requires an entry to stay on the date the user picked regardless of where
 * the device travels, which a timestamp cannot guarantee and a date string can.
 */
describe('calendarDate', () => {
  describe('construction', () => {
    it('accepts a well-formed date', () => {
      expect(calendarDate('2026-08-15')).toBe('2026-08-15')
    })

    it('rejects a malformed string', () => {
      expect(() => calendarDate('15/08/2026')).toThrow()
      expect(() => calendarDate('2026-8-15')).toThrow()
      expect(() => calendarDate('not a date')).toThrow()
    })

    it('rejects a date that does not exist on the calendar', () => {
      expect(() => calendarDate('2026-02-30')).toThrow()
      expect(() => calendarDate('2026-13-01')).toThrow()
    })

    it('accepts a real leap day and rejects a fake one', () => {
      expect(calendarDate('2024-02-29')).toBe('2024-02-29')
      expect(() => calendarDate('2026-02-29')).toThrow()
    })

    it('carries no time component, so two entries on a day are the same date', () => {
      expect(calendarDate('2026-08-15')).toBe(calendarDate('2026-08-15'))
    })
  })

  describe('comparison', () => {
    it('orders dates chronologically', () => {
      expect(compareDates(calendarDate('2026-01-01'), calendarDate('2026-02-01'))).toBeLessThan(0)
      expect(compareDates(calendarDate('2026-02-01'), calendarDate('2026-01-01'))).toBeGreaterThan(
        0,
      )
      expect(compareDates(calendarDate('2026-01-01'), calendarDate('2026-01-01'))).toBe(0)
    })

    it('detects a future date, which entries may not have', () => {
      expect(isAfter(calendarDate('2026-08-16'), calendarDate('2026-08-15'))).toBe(true)
      expect(isAfter(calendarDate('2026-08-15'), calendarDate('2026-08-15'))).toBe(false)
    })

    it('detects a past date, treating an equal date as neither before nor after', () => {
      expect([
        isBefore(calendarDate('2026-08-14'), calendarDate('2026-08-15')),
        isBefore(calendarDate('2026-08-15'), calendarDate('2026-08-15')),
        isBefore(calendarDate('2026-08-16'), calendarDate('2026-08-15')),
      ]).toEqual([true, false, false])
    })
  })

  describe('month arithmetic', () => {
    it('derives the month key used for bucketing', () => {
      expect(monthKey(calendarDate('2026-08-15'))).toBe('2026-08')
    })

    it('adds months across a year boundary', () => {
      expect(addMonths(calendarDate('2026-11-15'), 3)).toBe('2027-02-15')
    })

    it('clamps to the last valid day when the target month is shorter', () => {
      expect(addMonths(calendarDate('2026-01-31'), 1)).toBe('2026-02-28')
    })

    it('returns the last day of a month, including February in a leap year', () => {
      expect(lastDayOfMonth('2026-02')).toBe('2026-02-28')
      expect(lastDayOfMonth('2024-02')).toBe('2024-02-29')
      expect(lastDayOfMonth('2026-08')).toBe('2026-08-31')
    })

    it('steps back a month, rolling into December of the previous year', () => {
      expect([previousMonth('2026-03'), previousMonth('2026-01')]).toEqual(['2026-02', '2025-12'])
    })

    it('steps forward a month, rolling into January of the next year', () => {
      expect([nextMonth('2026-03'), nextMonth('2026-12')]).toEqual(['2026-04', '2027-01'])
    })
  })

  describe('month ranges', () => {
    it('lists every month key in a range inclusively, including empty ones', () => {
      expect(monthKeysBetween('2026-01', '2026-04')).toEqual([
        '2026-01',
        '2026-02',
        '2026-03',
        '2026-04',
      ])
    })

    it('lists a single month when both bounds match', () => {
      expect(monthKeysBetween('2026-01', '2026-01')).toEqual(['2026-01'])
    })

    it('returns an empty list when the range is inverted', () => {
      expect(monthKeysBetween('2026-04', '2026-01')).toEqual([])
    })

    it('excludes the in-progress month when listing complete months', () => {
      // Research D-017: a month that has not finished would understate the pace.
      const complete = completeMonthKeysBefore(calendarDate('2026-08-15'), 6)
      expect(complete).toEqual(['2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07'])
      expect(complete).not.toContain('2026-08')
    })

    it('returns fewer months when less history is requested', () => {
      expect(completeMonthKeysBefore(calendarDate('2026-08-01'), 2)).toEqual(['2026-06', '2026-07'])
    })

    it('treats the last day of a month as still in progress', () => {
      expect(completeMonthKeysBefore(calendarDate('2026-08-31'), 1)).toEqual(['2026-07'])
    })

    it.each([0, -1])('returns nothing when %i months are asked for', (count) => {
      expect(completeMonthKeysBefore(calendarDate('2026-08-15'), count)).toEqual([])
    })
  })

  describe('month boundaries', () => {
    it('finds the first day of a month, which anchors a period range', () => {
      expect(firstDayOfMonth('2026-03')).toBe('2026-03-01')
    })

    it('rejects a malformed month key rather than deriving a date from nonsense', () => {
      expect(() => lastDayOfMonth('2026-3')).toThrow(RangeError)
    })
  })
})
