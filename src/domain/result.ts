import type { AppError } from './errors/app-error'

/**
 * The outcome of an operation that can fail for a reason the caller should handle.
 *
 * This is a control-flow primitive, not part of the error taxonomy — which is why it
 * sits beside `money` and `dates` rather than inside `errors/`. `errors/` answers what
 * can go wrong in this app; this answers how any outcome is carried. The `AppError`
 * default is a type-only import, so there is no runtime coupling in either direction.
 *
 * Constitution Principle II forbids swallowed failures and Principle V requires exactly
 * one error strategy. Returning a result rather than throwing is what makes exhaustive
 * handling checkable: TypeScript cannot type what a function throws, so a throws-based
 * design leaves "did every caller handle this?" permanently unanswerable.
 *
 * Exceptions stay reserved for programmer errors — a fractional cent passed to `money`,
 * say — which no caller should be writing recovery code for.
 */
export type Result<T, E = AppError> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E }

/**
 * Wraps a value as a success.
 *
 * @param value The produced value. Use `ok(undefined)` for operations with no result.
 */
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value }
}

/**
 * Wraps a failure.
 *
 * @param error Why the operation failed, in a shape the UI can turn into a message.
 */
export function err<E>(error: E): Result<never, E> {
  return { ok: false, error }
}

/**
 * Narrows a result to its success branch.
 *
 * @returns True when the operation succeeded, narrowing `value` for the caller.
 */
export function isOk<T, E>(
  result: Result<T, E>,
): result is { readonly ok: true; readonly value: T } {
  return result.ok
}

/**
 * Narrows a result to its failure branch.
 *
 * @returns True when the operation failed, narrowing `error` for the caller.
 */
export function isErr<T, E>(
  result: Result<T, E>,
): result is { readonly ok: false; readonly error: E } {
  return !result.ok
}

/**
 * Transforms the value of a success, leaving a failure untouched.
 *
 * @param transform Applied only when `result` succeeded — never called on a failure.
 */
export function mapResult<T, U, E>(result: Result<T, E>, transform: (value: T) => U): Result<U, E> {
  return result.ok ? ok(transform(result.value)) : result
}

/**
 * Reads the value of a success, or a fallback when it failed.
 *
 * Use only where a failure genuinely has a sensible default. Reaching for this to avoid
 * handling an error is how a failure becomes invisible, which Principle II forbids.
 *
 * @param fallback Returned when `result` is a failure.
 */
export function unwrapOr<T, E>(result: Result<T, E>, fallback: T): T {
  return result.ok ? result.value : fallback
}

/**
 * Collects a list of results into a result of a list, stopping at the first failure.
 *
 * Used where a batch must be all-or-nothing — importing a document's entries above all,
 * where FR-046 forbids ever applying a partial result.
 *
 * @returns The collected values, or the first failure encountered.
 */
export function allOk<T, E>(results: readonly Result<T, E>[]): Result<readonly T[], E> {
  const values: T[] = []
  for (const result of results) {
    if (!result.ok) {
      return result
    }
    values.push(result.value)
  }
  return ok(values)
}
