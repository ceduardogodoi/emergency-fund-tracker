import {
  add,
  compare,
  isNegative,
  isZero,
  money,
  multiply,
  subtract,
  sum,
  zero,
} from '@/domain/money/money'

describe('money', () => {
  describe('construction', () => {
    it('accepts an integer number of minor units', () => {
      expect(money(1_250)).toBe(1_250)
    })

    it('accepts zero and negative values, since a delta may be negative', () => {
      expect(money(0)).toBe(0)
      expect(money(-500)).toBe(-500)
    })

    it('rejects a non-integer, because a fractional cent cannot exist', () => {
      expect(() => money(12.5)).toThrow(/integer minor units/i)
    })

    it('rejects NaN and Infinity', () => {
      expect(() => money(Number.NaN)).toThrow()
      expect(() => money(Number.POSITIVE_INFINITY)).toThrow()
    })

    it('rejects values beyond exact integer precision', () => {
      expect(() => money(Number.MAX_SAFE_INTEGER + 1)).toThrow()
    })
  })

  describe('arithmetic', () => {
    it('adds exactly', () => {
      expect(add(money(1_050), money(2_075))).toBe(3_125)
    })

    it('subtracts exactly', () => {
      expect(subtract(money(3_125), money(2_075))).toBe(1_050)
    })

    it('multiplies by an integer factor', () => {
      expect(multiply(money(200_000), 6)).toBe(1_200_000)
    })

    it('rejects a non-integer multiplication factor', () => {
      expect(() => multiply(money(100), 1.5)).toThrow()
    })

    it('sums a list, returning zero for an empty list', () => {
      expect(sum([])).toBe(0)
      expect(sum([money(100), money(250), money(-50)])).toBe(300)
    })

    it('never drifts across a long sequence of additions', () => {
      // The classic float failure: 0.1 + 0.2 !== 0.3. In minor units it is exact.
      const amounts = Array.from({ length: 10_000 }, () => money(10))
      expect(sum(amounts)).toBe(100_000)
    })

    it('is exact for amounts that would drift as floats', () => {
      const cents = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => money(n * 10 + 7))
      expect(sum(cents)).toBe(cents.reduce((a, b) => a + b, 0))
    })
  })

  describe('predicates', () => {
    it('identifies zero and negative amounts', () => {
      expect(isZero(zero)).toBe(true)
      expect(isZero(money(1))).toBe(false)
      expect(isNegative(money(-1))).toBe(true)
      expect(isNegative(zero)).toBe(false)
    })

    it('compares two amounts', () => {
      expect(compare(money(100), money(200))).toBeLessThan(0)
      expect(compare(money(200), money(100))).toBeGreaterThan(0)
      expect(compare(money(100), money(100))).toBe(0)
    })
  })
})
