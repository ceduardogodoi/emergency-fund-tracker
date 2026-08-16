import { SystemClock } from '@/platform/clock/system-clock'

/**
 * The clock takes its `Date` source as a constructor dependency so it can be pinned in a
 * test. Dates are built with the local-time constructor, so these assertions hold in any
 * timezone the suite happens to run in — Principle IV forbids a test that depends on the
 * machine's zone.
 */
describe('SystemClock', () => {
  const at = (year: number, monthIndex: number, day: number, hour = 12) =>
    new SystemClock(() => new Date(year, monthIndex, day, hour))

  describe('today', () => {
    it('returns the local calendar date', () => {
      expect(at(2026, 7, 16).today()).toBe('2026-08-16')
    })

    it('zero-pads single-digit months and days', () => {
      expect(at(2026, 0, 5).today()).toBe('2026-01-05')
    })

    it('reports the local date just before midnight, not the following day', () => {
      expect(at(2026, 7, 16, 23).today()).toBe('2026-08-16')
    })

    it('reports the local date just after midnight', () => {
      expect(at(2026, 7, 17, 0).today()).toBe('2026-08-17')
    })

    it('handles a leap day', () => {
      expect(at(2024, 1, 29).today()).toBe('2024-02-29')
    })
  })

  describe('now', () => {
    it('returns a UTC instant', () => {
      const instant = at(2026, 7, 16).now()
      expect(instant).toMatch(/Z$/)
      expect(Number.isNaN(Date.parse(instant))).toBe(false)
    })

    it('preserves the exact moment it was given', () => {
      const moment = new Date(2026, 7, 16, 12, 30, 45)
      const clock = new SystemClock(() => moment)
      expect(Date.parse(clock.now())).toBe(moment.getTime())
    })
  })

  describe('timeZone', () => {
    it('reports an IANA zone id', () => {
      expect(at(2026, 7, 16).timeZone()).toMatch(/^[A-Za-z]+(\/[A-Za-z_+\-0-9]+)*$/)
    })
  })

  describe('default source', () => {
    it('reads the real clock when no source is injected', () => {
      const before = Date.now()
      const observed = Date.parse(new SystemClock().now())
      expect(observed).toBeGreaterThanOrEqual(before)
    })
  })
})
