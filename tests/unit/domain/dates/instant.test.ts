import { instant } from '@/domain/dates/instant'

/**
 * Instants are audit timestamps — when a row was written. Distinct from CalendarDate,
 * which is the day a user assigned to an entry and must never shift with a timezone.
 */
describe('instant', () => {
  it('accepts an ISO 8601 UTC timestamp', () => {
    expect(instant('2026-08-15T09:30:00.000Z')).toBe('2026-08-15T09:30:00.000Z')
  })

  it('accepts second precision without milliseconds', () => {
    expect(instant('2026-08-15T09:30:00Z')).toBe('2026-08-15T09:30:00Z')
  })

  it('rejects a local offset, so audit rows stay comparable across zones', () => {
    expect(() => instant('2026-08-15T09:30:00-03:00')).toThrow(/utc/i)
  })

  it('rejects a bare calendar date, which is a different type entirely', () => {
    expect(() => instant('2026-08-15')).toThrow()
  })

  it('rejects an unparseable string', () => {
    expect(() => instant('yesterday')).toThrow()
    expect(() => instant('')).toThrow()
  })
})
