import { allOk, err, isErr, isOk, mapResult, ok, unwrapOr } from '@/domain/result'
import { validationError } from '@/domain/errors/app-error'

/**
 * Assertions here compare whole result objects rather than narrowing first. A
 * `if (isOk(result)) { expect(...) }` would type-check, but the assertions inside would
 * silently not run when the guard is false — a test that passes without testing.
 */
describe('Result', () => {
  describe('construction', () => {
    it('wraps a value as a success', () => {
      expect(ok(42)).toEqual({ ok: true, value: 42 })
    })

    it('wraps a failure', () => {
      const failure = validationError('amount', 'amount.required')
      expect(err(failure)).toEqual({ ok: false, error: failure })
    })

    it('carries undefined as a success value for operations with no result', () => {
      expect(ok(undefined)).toEqual({ ok: true, value: undefined })
    })
  })

  describe('narrowing predicates', () => {
    it('identifies a success', () => {
      expect(isOk(ok(42))).toBe(true)
      expect(isErr(ok(42))).toBe(false)
    })

    it('identifies a failure', () => {
      const failure = err(validationError('date', 'date.future'))
      expect(isErr(failure)).toBe(true)
      expect(isOk(failure)).toBe(false)
    })

    it('treats a falsy value as a success, since a balance of zero is a real answer', () => {
      expect(isOk(ok(0))).toBe(true)
      expect(isErr(ok(0))).toBe(false)
    })
  })

  describe('mapResult', () => {
    it('transforms a success', () => {
      expect(mapResult(ok(2), (n) => n * 10)).toEqual({ ok: true, value: 20 })
    })

    it('leaves a failure untouched and does not run the transform', () => {
      const transform = jest.fn()
      const failure = err(validationError('date', 'date.future'))
      expect(mapResult(failure, transform)).toBe(failure)
      expect(transform).not.toHaveBeenCalled()
    })
  })

  describe('unwrapOr', () => {
    it('reads the value of a success', () => {
      expect(unwrapOr(ok('saved'), 'fallback')).toBe('saved')
    })

    it('returns the fallback for a failure', () => {
      expect(unwrapOr(err(validationError('a', 'b')), 'fallback')).toBe('fallback')
    })
  })

  describe('allOk', () => {
    it('collects successes into a list', () => {
      expect(allOk([ok(1), ok(2), ok(3)])).toEqual({ ok: true, value: [1, 2, 3] })
    })

    it('returns an empty list for no results', () => {
      expect(allOk([])).toEqual({ ok: true, value: [] })
    })

    it('fails on the first failure, so a batch is all or nothing', () => {
      const first = validationError('entries[1]', 'amount.invalid')
      const second = validationError('entries[2]', 'date.invalid')
      expect(allOk([ok(1), err(first), err(second)])).toEqual({ ok: false, error: first })
    })
  })
})
