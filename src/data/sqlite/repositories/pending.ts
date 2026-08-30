import { storageError } from '@/domain/errors/app-error'
import type {
  LedgerRepository,
  MilestoneRepository,
  ReminderRepository,
} from '@/domain/ports/repositories'
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
 * Each of these is deleted by the task that implements it for real: the ledger at T078,
 * milestones at T100, reminders at T131. Nothing in User Story 1 calls any of them.
 */

/** The failure every pending method returns. */
function pending<T>(): Promise<Result<T>> {
  return Promise.resolve(err(storageError('repository.not-implemented')))
}

/** The ledger, until T078. */
export function createPendingLedgerRepository(): LedgerRepository {
  return {
    add: pending,
    update: pending,
    remove: pending,
    getById: pending,
    list: pending,
    listFutureDated: pending,
  }
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
