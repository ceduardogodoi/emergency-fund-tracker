import { storageError } from '@/domain/errors/app-error'
import { ok, err, type Result } from '@/domain/result'

/**
 * Runs a database call, turning anything it throws into a storage failure.
 *
 * Every repository method goes through this. A driver raises rather than returns — a
 * constraint violation, a closed handle, a corrupt page all arrive as exceptions — and an
 * exception crossing the repository boundary would escape the caller's `Result` handling
 * entirely and reach the user as a crash. Principle II forbids exactly that.
 *
 * The cause is kept rather than flattened to a string, so a developer reading a log still
 * has the engine's own message. It never reaches the user: the UI renders copy chosen from
 * `messageKey`, and `AppError.cause` is typed `unknown` so nothing can render it by
 * accident.
 *
 * @param messageKey Which failure this is, in the form `entity.operation-failed`.
 * @param work The database call.
 * @returns The value, or a storage failure carrying the original cause.
 */
export async function attempt<T>(messageKey: string, work: () => Promise<T>): Promise<Result<T>> {
  try {
    return ok(await work())
  } catch (cause) {
    return err(storageError(messageKey, cause))
  }
}
