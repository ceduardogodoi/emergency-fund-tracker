import {
  validateCoverageMonths,
  validateMonthlyExpenses,
  validateTarget,
} from '@/domain/goal/validation'
import { money } from '@/domain/money/money'

/**
 * FR-001 and FR-002, at the edge where a number becomes a domain value.
 *
 * Each validator takes a plain `number` of minor units rather than a `Money`, because
 * `money()` throws on a value that is not a whole, safe integer — so a validator taking
 * `Money` could only ever be handed values that had already passed the check it exists to
 * perform. A `Money` is still accepted, since the brand is a `number`.
 *
 * Whole result objects are compared rather than narrowed first, matching
 * `tests/unit/domain/result.test.ts`: assertions inside an `if` silently do not run when
 * the guard is false.
 */
describe('validateMonthlyExpenses', () => {
  it('accepts an amount above zero', () => {
    expect(validateMonthlyExpenses(200_000)).toEqual({ ok: true, value: money(200_000) })
  })

  it('accepts the smallest representable amount', () => {
    expect(validateMonthlyExpenses(1)).toEqual({ ok: true, value: money(1) })
  })

  it('rejects zero', () => {
    expect(validateMonthlyExpenses(0)).toEqual({
      ok: false,
      error: {
        kind: 'validation',
        field: 'monthlyExpenses',
        messageKey: 'goal.expenses-must-be-positive',
      },
    })
  })

  it('rejects a negative amount', () => {
    expect(validateMonthlyExpenses(-1)).toMatchObject({
      ok: false,
      error: { messageKey: 'goal.expenses-must-be-positive' },
    })
  })

  // "Non-numeric input" in FR-001. It cannot arrive through `MoneyInput`, which emits only
  // digits, but it can arrive through an imported file (FR-046), and the two paths must
  // reject it the same way rather than one throwing and the other explaining.
  it('rejects a value that is not a number', () => {
    expect(validateMonthlyExpenses(Number.NaN)).toMatchObject({
      ok: false,
      error: { messageKey: 'goal.expenses-not-a-number' },
    })
  })

  it('rejects an infinite value', () => {
    expect(validateMonthlyExpenses(Number.POSITIVE_INFINITY)).toMatchObject({
      ok: false,
      error: { messageKey: 'goal.expenses-not-a-number' },
    })
  })

  it('rejects a fraction of a minor unit, which the ledger could not store exactly', () => {
    expect(validateMonthlyExpenses(1.5)).toMatchObject({
      ok: false,
      error: { messageKey: 'goal.expenses-not-a-number' },
    })
  })

  it('rejects a value beyond exact integer precision', () => {
    expect(validateMonthlyExpenses(Number.MAX_SAFE_INTEGER + 2)).toMatchObject({
      ok: false,
      error: { messageKey: 'goal.expenses-not-a-number' },
    })
  })
})

describe('validateCoverageMonths', () => {
  it('accepts both ends of the permitted range', () => {
    expect(validateCoverageMonths(1)).toEqual({ ok: true, value: 1 })
    expect(validateCoverageMonths(24)).toEqual({ ok: true, value: 24 })
  })

  it('rejects zero months, which would make the target zero', () => {
    expect(validateCoverageMonths(0)).toEqual({
      ok: false,
      error: {
        kind: 'validation',
        field: 'coverageMonths',
        messageKey: 'goal.coverage-out-of-range',
      },
    })
  })

  it('rejects a duration beyond 24 months', () => {
    expect(validateCoverageMonths(25)).toMatchObject({
      ok: false,
      error: { messageKey: 'goal.coverage-out-of-range' },
    })
  })

  it('rejects a negative duration', () => {
    expect(validateCoverageMonths(-6)).toMatchObject({
      ok: false,
      error: { messageKey: 'goal.coverage-out-of-range' },
    })
  })

  // Half a month has no meaning here, and `calculateTarget` would throw on it rather than
  // explain — so it is caught where there is still a message to give the user.
  it('rejects a fractional number of months', () => {
    expect(validateCoverageMonths(6.5)).toMatchObject({
      ok: false,
      error: { messageKey: 'goal.coverage-not-a-whole-number' },
    })
  })

  it('rejects a value that is not a number', () => {
    expect(validateCoverageMonths(Number.NaN)).toMatchObject({
      ok: false,
      error: { messageKey: 'goal.coverage-not-a-whole-number' },
    })
  })
})

describe('validateTarget', () => {
  it('accepts a target above zero', () => {
    expect(validateTarget(1_200_000)).toEqual({ ok: true, value: money(1_200_000) })
  })

  // FR-005 lets the user override the target by hand, which is the path that can produce
  // a zero — a fund with nothing to reach is not a fund.
  it('rejects a zero target', () => {
    expect(validateTarget(0)).toEqual({
      ok: false,
      error: { kind: 'validation', field: 'target', messageKey: 'goal.target-must-be-positive' },
    })
  })

  it('rejects a negative target', () => {
    expect(validateTarget(-1)).toMatchObject({
      ok: false,
      error: { messageKey: 'goal.target-must-be-positive' },
    })
  })

  it('rejects a target that is not a whole number of minor units', () => {
    expect(validateTarget(1.5)).toMatchObject({
      ok: false,
      error: { messageKey: 'goal.target-not-a-number' },
    })
  })
})
