import {
  COVERAGE_MONTHS,
  LEVELS,
  MAXIMUM_COVERAGE_MONTHS,
  MINIMUM_COVERAGE_MONTHS,
  levelForCoverageMonths,
} from '@/domain/goal/levels'
import { calculateTarget, validateCalculatedTarget } from '@/domain/goal/target'
import type { GoalInput } from '@/domain/goal/types'
import { money } from '@/domain/money/money'

/**
 * FR-002 and FR-004. Amounts are minor units throughout, so the spec's "2,000" is
 * `money(200_000)` and its target of "12,000" is `money(1_200_000)`.
 */

/** A goal fixture, so each test states only the field it is about. */
function goalInput(overrides: Partial<GoalInput> = {}): GoalInput {
  return {
    target: money(1_200_000),
    source: 'calculated',
    levelKey: 'balanced',
    coverageMonths: 6,
    desiredCompletionDate: null,
    ...overrides,
  }
}

describe('levels', () => {
  // FR-002 names these four and their durations. Pinned individually rather than by
  // iterating the table, because the table is what is under test.
  it('offers the four named levels at 3, 6, 9, and 12 months', () => {
    expect(COVERAGE_MONTHS).toEqual({ lean: 3, balanced: 6, cautious: 9, maximum: 12 })
  })

  it('orders the levels from least to most cautious, which is the order they are shown in', () => {
    expect(LEVELS.map((level) => level.key)).toEqual(['lean', 'balanced', 'cautious', 'maximum'])
    const months = LEVELS.map((level) => level.coverageMonths)
    expect(months).toEqual([...months].sort((left, right) => left - right))
  })

  it('allows a custom duration between 1 and 24 months', () => {
    expect(MINIMUM_COVERAGE_MONTHS).toBe(1)
    expect(MAXIMUM_COVERAGE_MONTHS).toBe(24)
  })

  it('names the level a duration corresponds to, so a stored goal reopens on its own level', () => {
    expect(levelForCoverageMonths(3)).toBe('lean')
    expect(levelForCoverageMonths(6)).toBe('balanced')
    expect(levelForCoverageMonths(9)).toBe('cautious')
    expect(levelForCoverageMonths(12)).toBe('maximum')
  })

  it('calls any other duration custom, including ones inside the preset range', () => {
    expect(levelForCoverageMonths(7)).toBe('custom')
    expect(levelForCoverageMonths(1)).toBe('custom')
    expect(levelForCoverageMonths(24)).toBe('custom')
  })
})

describe('calculateTarget', () => {
  // Spec acceptance scenario 1: expenses 2,000 at Balanced (6 months) gives 12,000.
  it('multiplies monthly expenses by the months of coverage', () => {
    expect(calculateTarget(money(200_000), 6)).toBe(money(1_200_000))
  })

  // Spec acceptance scenario 2: switching Balanced to Cautious gives 18,000 without the
  // expense figure being re-entered.
  it('recalculates from the same expenses when the coverage changes', () => {
    const expenses = money(200_000)
    expect(calculateTarget(expenses, 6)).toBe(money(1_200_000))
    expect(calculateTarget(expenses, 9)).toBe(money(1_800_000))
  })

  it('stays exact on an amount that is not a round number of units (FR-038)', () => {
    expect(calculateTarget(money(133_333), 3)).toBe(money(399_999))
  })

  it('refuses a fractional coverage, which would reintroduce the rounding FR-038 forbids', () => {
    expect(() => calculateTarget(money(200_000), 6.5)).toThrow(RangeError)
  })

  // Arithmetic only. Whether zero months is a legal choice is `validateCoverageMonths`'s
  // question, and answering it in two places is how the two answers start to differ.
  it('computes rather than validates, so zero months is zero and not an error', () => {
    expect(calculateTarget(money(200_000), 0)).toBe(money(0))
  })
})

describe('validateCalculatedTarget', () => {
  it('accepts a calculated target equal to expenses times coverage', () => {
    const input = goalInput()
    expect(validateCalculatedTarget(input, money(200_000))).toEqual({ ok: true, value: input })
  })

  // fund-export-v1: a mismatch is rejected rather than recalculated. Guessing which of the
  // two figures the hand-editor meant would be a fabrication.
  it('rejects a calculated target that does not match, rather than recomputing it', () => {
    const result = validateCalculatedTarget(goalInput({ target: money(999) }), money(200_000))
    expect(result).toEqual({
      ok: false,
      error: { kind: 'validation', field: 'target', messageKey: 'goal.target-does-not-match' },
    })
  })

  // FR-005: an overridden target is by definition not the product, so the invariant does
  // not apply to it. Applying it anyway would make manual override impossible.
  it('leaves a user-defined target alone even when it does not match', () => {
    const input = goalInput({ source: 'user_defined', target: money(999) })
    expect(validateCalculatedTarget(input, money(200_000))).toEqual({ ok: true, value: input })
  })
})
