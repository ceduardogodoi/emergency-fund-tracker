import { storageError } from '@/domain/errors/app-error'
import type { MilestoneRepository, ReminderRepository } from '@/domain/ports/repositories'
import { err, type Result } from '@/domain/result'

/**
 * Placeholders for the repositories whose user stories have not been built yet.
 *
 * `Repositories` names all five, and the unit of work cannot be assembled without them —
 * so the choice is between these and leaving the app unable to persist anything at all.
 *
 * Every method fails. That is the point: the failure mode worth designing against is not a
 * crash but a *plausible answer*. A ledger stub returning `ok([])` is indistinguishable
 * from a fund with no entries, and the app would render a zero balance as though it were
 * the truth — a wrong number a user would act on. A storage failure surfaces as the error
 * state every view already handles.
 *
 * Each of these is deleted by the task that implements it for real: milestones at T100,
 * reminders at T131. The ledger's went at T078, which is what these are waiting to become.
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

/** The milestone acknowledgements, until T100. */
export function createPendingMilestoneRepository(): MilestoneRepository {
  return {
    listAcknowledged: pending,
    acknowledge: pending,
    clearAbove: pending,
  }
}
