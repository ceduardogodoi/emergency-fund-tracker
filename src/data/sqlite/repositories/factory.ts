import type { Clock } from '@/domain/ports/clock'
import type { IdGenerator } from '@/domain/ports/id-generator'

import type { RepositoriesFactory } from '../database'
import { createGoalRepository } from './goal-repository'
import {
  createPendingLedgerRepository,
  createPendingMilestoneRepository,
  createPendingReminderRepository,
} from './pending'
import { createProfileRepository } from './profile-repository'

/**
 * Builds the repository set for whichever database handle a transaction is running on.
 *
 * Two-stage on purpose. The clock and the id generator are decided once, at startup; the
 * database handle is not — `createUnitOfWork` calls the inner function per transaction so
 * that every repository inside one is bound to the same connection. A set built once and
 * shared would hold a handle from outside the transaction, and its writes would land
 * outside it too, surviving a rollback that was supposed to undo them.
 *
 * @param clock Supplies every audit timestamp.
 * @param ids Supplies every generated identifier.
 * @returns A factory the unit of work calls per transaction.
 */
export function createRepositoriesFactory(clock: Clock, ids: IdGenerator): RepositoriesFactory {
  return (db) => ({
    profile: createProfileRepository(db, clock),
    goal: createGoalRepository(db, clock, ids),
    // Not implemented yet, and failing rather than answering. See `pending.ts`.
    ledger: createPendingLedgerRepository(),
    reminders: createPendingReminderRepository(),
    milestones: createPendingMilestoneRepository(),
  })
}
