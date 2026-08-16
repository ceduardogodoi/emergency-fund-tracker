import {
  assertNever,
  conflictError,
  notFoundError,
  storageError,
  validationError,
  type AppError,
} from '@/domain/errors/app-error'

describe('AppError', () => {
  describe('builders', () => {
    it('builds a validation failure carrying the field to attach it to', () => {
      expect(validationError('monthlyExpenses', 'expenses.mustBePositive')).toEqual({
        kind: 'validation',
        field: 'monthlyExpenses',
        messageKey: 'expenses.mustBePositive',
      })
    })

    it('builds a not-found failure naming the entity', () => {
      expect(notFoundError('goal')).toEqual({ kind: 'not-found', entity: 'goal' })
    })

    it('builds a conflict failure', () => {
      expect(conflictError('ledger.openingAlreadyExists')).toEqual({
        kind: 'conflict',
        messageKey: 'ledger.openingAlreadyExists',
      })
    })

    it('builds a storage failure with an underlying cause', () => {
      const cause = new Error('database is locked')
      expect(storageError('storage.writeFailed', cause)).toEqual({
        kind: 'storage',
        messageKey: 'storage.writeFailed',
        cause,
      })
    })

    it('omits the cause key entirely when there is none', () => {
      // exactOptionalPropertyTypes means an absent cause must be absent, not undefined.
      const error = storageError('storage.readFailed')
      expect(error).toEqual({ kind: 'storage', messageKey: 'storage.readFailed' })
      expect('cause' in error).toBe(false)
    })
  })

  describe('messages are keys, never prose', () => {
    it('carries no user-facing sentences, so copy stays in the strings module', () => {
      const error = validationError('amount', 'amount.mustBePositive')
      expect(error.messageKey).not.toMatch(/\s/)
    })
  })

  describe('assertNever', () => {
    it('throws when reached, which only happens if a case went unhandled', () => {
      const unreachable = { kind: 'invented' } as unknown as never
      expect(() => assertNever(unreachable)).toThrow(/unhandled case/i)
    })

    it('lets an exhaustive switch compile and return for every kind', () => {
      const describeError = (error: AppError): string => {
        switch (error.kind) {
          case 'validation':
            return `validation:${error.field}`
          case 'not-found':
            return `not-found:${error.entity}`
          case 'conflict':
            return 'conflict'
          case 'storage':
            return 'storage'
          case 'import-invalid':
            return `import-invalid:${error.problems.length}`
          case 'import-unsupported-version':
            return `unsupported:${error.found}`
          case 'permission-denied':
            return `denied:${error.capability}`
          case 'cancelled':
            return 'cancelled'
          default:
            return assertNever(error)
        }
      }

      expect(describeError(validationError('amount', 'a'))).toBe('validation:amount')
      expect(describeError({ kind: 'cancelled' })).toBe('cancelled')
      expect(describeError({ kind: 'permission-denied', capability: 'notifications' })).toBe(
        'denied:notifications',
      )
      expect(describeError({ kind: 'import-unsupported-version', found: 2, supported: 1 })).toBe(
        'unsupported:2',
      )
      expect(
        describeError({
          kind: 'import-invalid',
          problems: [{ path: 'entries[0]', messageKey: 'x' }],
        }),
      ).toBe('import-invalid:1')
    })
  })
})
