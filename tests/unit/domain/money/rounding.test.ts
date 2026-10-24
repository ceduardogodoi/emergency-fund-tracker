import { money } from '@/domain/money/money'
import {
  divideToAmount,
  divideToWholeMonths,
  percentOf,
  wholeMonthsCovered,
} from '@/domain/money/rounding'

/**
 * The constitution requires one rounding policy with one home. These tests are that
 * policy's specification:
 *   - amounts derived by division round DOWN, so the app never overstates saving
 *   - month counts still to save round UP, so it never promises an early date
 *   - month counts already saved round DOWN, so it never claims cover the fund lacks
 */
describe('rounding policy', () => {
  describe('divideToAmount — rounds down', () => {
    it('divides evenly when it can', () => {
      expect(divideToAmount(money(60_000), 6)).toBe(10_000)
    })

    it('rounds down rather than to nearest', () => {
      // 1_999 / 2 = 999.5 — nearest would give 1_000, floor gives 999.
      expect(divideToAmount(money(1_999), 2)).toBe(999)
    })

    it('rounds down for negative results too, never toward zero', () => {
      expect(divideToAmount(money(-1_999), 2)).toBe(-1_000)
    })

    it('returns zero when the numerator is zero', () => {
      expect(divideToAmount(money(0), 6)).toBe(0)
    })

    it('rejects division by zero', () => {
      expect(() => divideToAmount(money(100), 0)).toThrow()
    })

    it('rejects a fractional divisor, which no count of months or entries can be', () => {
      expect(() => divideToAmount(money(100), 2.5)).toThrow(RangeError)
    })
  })

  describe('divideToWholeMonths — rounds up', () => {
    it('returns the exact count when it divides evenly', () => {
      expect(divideToWholeMonths(money(5_000), money(500))).toBe(10)
    })

    it('rounds up on any remainder, because a partial month still needs saving', () => {
      expect(divideToWholeMonths(money(5_001), money(500))).toBe(11)
    })

    it('returns zero when nothing remains', () => {
      expect(divideToWholeMonths(money(0), money(500))).toBe(0)
    })

    it('rejects a pace of zero or less — no date is projectable', () => {
      expect(() => divideToWholeMonths(money(5_000), money(0))).toThrow()
      expect(() => divideToWholeMonths(money(5_000), money(-100))).toThrow()
    })
  })

  describe('wholeMonthsCovered — rounds down', () => {
    it('returns the exact count when it divides evenly', () => {
      expect(wholeMonthsCovered(money(600_000), money(200_000))).toBe(3)
    })

    // 2,95 months. To nearest that is three, and a fund that cannot pay the third month
    // does not cover it.
    it('rounds down on any remainder, because a partial month is not covered', () => {
      expect(wholeMonthsCovered(money(590_000), money(200_000))).toBe(2)
    })

    it('covers nothing until a whole month is saved', () => {
      expect(wholeMonthsCovered(money(199_999), money(200_000))).toBe(0)
    })

    // An overdrawn fund covers nothing. Floor alone would say minus one month.
    it('covers nothing when the balance is negative, rather than a negative count', () => {
      expect(wholeMonthsCovered(money(-50_000), money(200_000))).toBe(0)
    })

    it('rejects monthly expenses of zero or less — no cover is measurable', () => {
      expect(() => wholeMonthsCovered(money(100), money(0))).toThrow(RangeError)
      expect(() => wholeMonthsCovered(money(100), money(-1))).toThrow(RangeError)
    })
  })

  describe('percentOf — presentation only', () => {
    // The spec's own example (User Story 2, scenario 1): 500 of 12 000 shows 4,17%.
    it('computes a percentage to two decimals, rounded to nearest', () => {
      expect(percentOf(money(500), money(12_000))).toBe(4.17)
    })

    // 99,99991… rounded to nearest is 100, which is "reached" in every reader's eyes and in
    // the 100% milestone's (FR-024) — for a fund one unit short. 100 is kept for what FR-015
    // calls reached: the balance meets the target. Below it, the figure stops at 99,99.
    it('never reaches 100 while any of the target remains', () => {
      expect(percentOf(money(1_199_999), money(1_200_000))).toBe(99.99)
    })

    it('returns 100 when the parts are equal', () => {
      expect(percentOf(money(12_000), money(12_000))).toBe(100)
    })

    it('clamps above 100 so a surplus never renders as 130%', () => {
      expect(percentOf(money(15_600), money(12_000))).toBe(100)
    })

    it('returns zero when the whole is zero, rather than NaN', () => {
      expect(percentOf(money(500), money(0))).toBe(0)
    })
  })
})
