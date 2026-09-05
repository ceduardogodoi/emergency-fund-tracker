import type { CurrencyCode } from '../money/currency'
import type { Money } from '../money/money'
import type { Repositories } from '../ports/repositories'
import type { Profile } from '../profile/types'
import { isErr, ok, type Result } from '../result'
import { validateCalculatedTarget } from './target'
import type { Goal, GoalInput } from './types'

/** Everything the user decided, in one submission. */
export interface GoalSubmission {
  /** The average monthly essential expenses the target is derived from (FR-001). */
  readonly monthlyExpenses: Money
  /** The goal itself, calculated or overridden. */
  readonly goal: GoalInput
  /**
   * The currency to use if this is the first submission.
   *
   * Ignored once a profile exists: FR-039 fixes the currency at setup, and changing it
   * would reinterpret every stored amount as a different unit of money without altering a
   * single number.
   */
  readonly currency: CurrencyCode
}

/** What was stored before this submission, which is what makes a revision detectable. */
interface StoredState {
  readonly profile: Profile | null
  readonly goal: Goal | null
}

/**
 * Saves the expenses and the goal together, recording the revision when there was one.
 *
 * One operation rather than two repository calls at the call site, because the interesting
 * parts are decisions about the *transition* between two stored states — whether this is a
 * revision worth recording (FR-006), and whether the currency may change (FR-039) — and
 * neither is visible from a single `save`.
 *
 * The caller is expected to run this inside a `UnitOfWork` transaction. It performs up to
 * three writes, and a partial application would leave a profile describing expenses that
 * the stored target no longer derives from.
 *
 * @param repositories The repository set for the current transaction.
 * @param submission What the user decided.
 * @returns The saved goal, or the first failure, having written nothing after it.
 */
export async function submitGoal(
  repositories: Repositories,
  submission: GoalSubmission,
): Promise<Result<Goal>> {
  const validated = validateCalculatedTarget(submission.goal, submission.monthlyExpenses)
  if (isErr(validated)) {
    return validated
  }

  const before = await readStoredState(repositories)
  if (isErr(before)) {
    return before
  }

  const savedProfile = await repositories.profile.save({
    monthlyExpenses: submission.monthlyExpenses,
    currency: before.value.profile?.currency ?? submission.currency,
  })
  if (isErr(savedProfile)) {
    return savedProfile
  }

  const savedGoal = await repositories.goal.save(submission.goal)
  if (isErr(savedGoal)) {
    return savedGoal
  }

  return recordRevision(repositories, before.value, submission, savedGoal.value)
}

/** Reads both rows as they stand, so the submission can be compared against them. */
async function readStoredState(repositories: Repositories): Promise<Result<StoredState>> {
  const profile = await repositories.profile.get()
  if (isErr(profile)) {
    return profile
  }
  const goal = await repositories.goal.get()
  if (isErr(goal)) {
    return goal
  }
  return ok({ profile: profile.value, goal: goal.value })
}

/**
 * Appends the audit row when this submission actually changed something.
 *
 * Nothing is recorded on a first goal — the port keeps `save` and `recordChange` apart so a
 * first-time goal does not manufacture a record of a revision that never happened — nor
 * when the same figures are submitted again, which would fill the history FR-035 shows the
 * user with rows they cannot tell apart.
 *
 * @returns The saved goal, so the caller's happy path stays a single expression.
 */
async function recordRevision(
  repositories: Repositories,
  before: StoredState,
  submission: GoalSubmission,
  saved: Goal,
): Promise<Result<Goal>> {
  const { profile, goal } = before
  if (profile === null || goal === null || !isRevision(goal, profile, submission)) {
    return ok(saved)
  }

  const recorded = await repositories.goal.recordChange({
    previousTarget: goal.target,
    newTarget: saved.target,
    previousExpenses: profile.monthlyExpenses,
    newExpenses: submission.monthlyExpenses,
    previousCoverageMonths: goal.coverageMonths,
    newCoverageMonths: saved.coverageMonths,
  })
  return isErr(recorded) ? recorded : ok(saved)
}

/** Whether this submission changed any of the three figures the log records. */
function isRevision(before: Goal, profile: Profile, submission: GoalSubmission): boolean {
  return (
    before.target !== submission.goal.target ||
    before.coverageMonths !== submission.goal.coverageMonths ||
    profile.monthlyExpenses !== submission.monthlyExpenses
  )
}
