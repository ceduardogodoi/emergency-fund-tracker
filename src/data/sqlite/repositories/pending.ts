import { storageError } from '@/domain/errors/app-error'
import type { ReminderRepository } from '@/domain/ports/repositories'
import { err, type Result } from '@/domain/result'

/**
 * A placeholder for the repository whose user story has not been built yet.
 *
 * `Repositories` names every repository, and the unit of work cannot be assembled without
 * them — so the choice is between this and leaving the app unable to persist anything.
 *
 * Every method fails. That is the point: the failure mode worth designing against is not a
 * crash but a *plausible answer*. A ledger stub returning `ok([])` is indistinguishable
 * from a fund with no entries, and the app would render a zero balance as though it were
 * the truth — a wrong number a user would act on. A storage failure surfaces as the error
 * state every view already handles.
 *
 * It is deleted by the task that implements it for real: reminders at T131. The ledger's
 * went at T078 and the milestones' at T100, which is what this is waiting to become.
 */

/** The failure every pending method returns. */
function pending<T>(): Promise<Result<T>> {
  return Promise.resolve(err(storageError('repository.not-implemented')))
}

/** The reminder schedule, until T131. */
export function createPendingReminderRepository(): ReminderRepository {
  return {
    get: pending,
    save: pending,
  }
}
