import type { CalendarDate } from '../dates/calendar-date'
import type { MilestoneRepository, Repositories } from '../ports/repositories'
import { isErr, ok, type Result } from '../result'
import { calculateBalance } from './balance'
import { crossedMilestones } from './milestones'
import { summarizeProgress } from './progress'
import type { MilestoneThreshold, ProgressSummary } from './types'

/**
 * Where the fund stands against its target, as Home shows it — the position a milestone is
 * measured from.
 *
 * Read from storage rather than from a screen's cache, because the save path needs the
 * position on either side of a write, and a cache is only as fresh as its last refetch.
 *
 * @param repositories The repository set for the current transaction.
 * @param today From the `Clock` port. Entries dated after it are not in the balance.
 * @returns The position, or null before setup, when there is no target to measure against.
 */
export async function readProgress(
  repositories: Repositories,
  today: CalendarDate,
): Promise<Result<ProgressSummary | null>> {
  const goal = await repositories.goal.get()
  if (isErr(goal)) {
    return goal
  }
  if (goal.value === null) {
    return ok(null)
  }
  const entries = await repositories.ledger.list()
  if (isErr(entries)) {
    return entries
  }
  return ok(summarizeProgress(calculateBalance(entries.value, today), goal.value.target))
}

/**
 * Records the milestones a write carried the fund past, and forgets the ones it fell back
 * below (FR-024).
 *
 * A crossing already on record is left out, which is what makes a milestone fire once:
 * the save that crosses it is the only one that reports it, and a restart reads nothing new.
 * Forgetting is the other half — the re-crossing rule in data-model. Without it a user who
 * withdraws from 60% to 40% and then recovers would pass 50% with nothing said.
 *
 * @param milestones Where acknowledgements are kept.
 * @param previous The position before the write.
 * @param next The position after it.
 * @returns The milestones newly crossed, ascending — the last is the one to tell the user.
 */
export async function acknowledgeMilestones(
  milestones: MilestoneRepository,
  previous: ProgressSummary,
  next: ProgressSummary,
): Promise<Result<readonly MilestoneThreshold[]>> {
  const acknowledged = await milestones.listAcknowledged()
  if (isErr(acknowledged)) {
    return acknowledged
  }
  const fresh = crossedMilestones(previous, next).filter(
    (threshold) => !acknowledged.value.includes(threshold),
  )
  for (const threshold of fresh) {
    const recorded = await milestones.acknowledge(threshold)
    if (isErr(recorded)) {
      return recorded
    }
  }
  const forgotten = await milestones.clearAbove(next.percentComplete)
  return isErr(forgotten) ? forgotten : ok(fresh)
}

/**
 * Forgets the milestones the fund is now below, after something other than an entry moved
 * it — a revised target (data-model, state transitions).
 *
 * The save path forgets as it writes, but a raised target lowers the percentage with no
 * entry written. Left alone, a fund raised from 60% to 30% would keep 50% on record, and
 * climbing past it again would be filtered out as already acknowledged.
 *
 * @param repositories The repository set for the current transaction.
 * @param today From the `Clock` port.
 * @returns Nothing, or the failure that stopped it. Nothing is forgotten without a goal.
 */
export async function forgetMilestonesAbove(
  repositories: Repositories,
  today: CalendarDate,
): Promise<Result<void>> {
  const progress = await readProgress(repositories, today)
  if (isErr(progress)) {
    return progress
  }
  if (progress.value === null) {
    return ok(undefined)
  }
  return repositories.milestones.clearAbove(progress.value.percentComplete)
}
