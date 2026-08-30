import type { Result } from '@/domain/result'

/**
 * Unwraps a `Result` for the assertions that follow, failing if it is not a success.
 *
 * A helper rather than an `if` or a `&&` in the test body. A conditional would let the
 * assertions inside it be skipped while the test still reported success; `result.ok &&
 * result.value` does fail, but reports "expected false to equal [...]", which says nothing
 * about why the operation failed. This reports the actual error and stops there.
 *
 * Simple cases still read better as a whole-object comparison —
 * `expect(result).toEqual({ ok: true, value: 3 })` — which is what
 * `tests/unit/domain/result.test.ts` does. Reach for this only when the value has to be
 * pulled out and used.
 *
 * @param result The result under test.
 * @returns The success value.
 */
export function expectOk<T, E>(result: Result<T, E>): T {
  // `toMatchObject` rather than a whole-object comparison, because the value is not being
  // asserted here and may legitimately be `null` — `ProfileRepository.get()` returns
  // `ok(null)` before onboarding — or `undefined`, which `expect.anything()` rejects.
  // A failed result still prints in full, so the reported error is the real one.
  expect(result).toMatchObject({ ok: true })
  // Unreachable when the assertion above fails: Jest throws out of the test first.
  return (result as { readonly ok: true; readonly value: T }).value
}

/**
 * Unwraps a `Result`'s error for the assertions that follow, failing if it succeeded.
 *
 * The mirror of {@link expectOk}, for cases where the failure itself is what is being
 * inspected — a validation error's field, or an error carrying a cause worth checking.
 *
 * @param result The result under test.
 * @returns The failure.
 */
export function expectErr<T, E>(result: Result<T, E>): E {
  expect(result).toMatchObject({ ok: false })
  return (result as { readonly ok: false; readonly error: E }).error
}
