import { storageError } from '@/domain/errors'
import type { GoalInput } from '@/domain/goal/types'
import { submitGoal, type GoalSubmission } from '@/domain/goal/submit-goal'
import { currencyCode } from '@/domain/money/currency'
import { money } from '@/domain/money/money'
import type { Repositories } from '@/domain/ports/repositories'
import { err } from '@/domain/result'
import { CountingIdGenerator, FakeClock, createInMemoryRepositories } from '@tests/support/doubles'
import { expectErr, expectOk } from '@tests/support/expect-result'

/**
 * Saving a goal is more than a repository write: FR-006 requires that a revision be
 * recorded, and FR-039 that the currency chosen at setup never change afterwards. Both are
 * decisions about the transition between two stored states, which is why they live in one
 * operation rather than being left to whichever screen happens to call `save`.
 *
 * Against the in-memory doubles, because none of this is about SQL.
 */
const BRL = currencyCode('BRL')

/** A submission, so each case states only the part it is about. */
function submission(overrides: Partial<GoalSubmission> = {}): GoalSubmission {
  return {
    monthlyExpenses: money(200_000),
    currency: BRL,
    goal: goalInput(),
    ...overrides,
  }
}

/** The goal half of a submission. */
function goalInput(overrides: Partial<GoalInput> = {}): GoalInput {
  return {
    target: money(1_200_000),
    source: 'calculated',
    levelKey: 'balanced',
    coverageMonths: 6,
    desiredCompletionDate: null,
    ...overrides,
  }
}

/** The failure the broken repositories below return, identical in every case. */
const storageFailure = storageError('storage.unavailable')

/** One storage call replaced by a failure, so its branch can be reached. */
interface StorageFailureCase {
  /** Which call fails, phrased to complete "reports the failure when …". */
  readonly whichCall: string
  /** Breaks that one call on an otherwise working repository set. */
  readonly breaking: (repositories: Repositories) => void
}

/**
 * Every storage call `submitGoal` makes on the path to a first goal.
 *
 * One case per call rather than one representative case: each is a separate early return,
 * and a missed one does not fail loudly — it carries on and reports success, which is
 * exactly the swallowed failure Principle II exists to prevent.
 *
 * A spy on the double rather than a hand-written failing repository, because the double's
 * state is private: replacing one method by spreading the object would drop the rest, and
 * a whole second implementation would only be a working repository with one method
 * changed. The spy is still checked against the port — its return type is the method's.
 */
const storageFailureCases: readonly StorageFailureCase[] = [
  {
    whichCall: 'the stored profile cannot be read',
    breaking: (repositories) => {
      jest.spyOn(repositories.profile, 'get').mockResolvedValue(err(storageFailure))
    },
  },
  {
    whichCall: 'the stored goal cannot be read',
    breaking: (repositories) => {
      jest.spyOn(repositories.goal, 'get').mockResolvedValue(err(storageFailure))
    },
  },
  {
    whichCall: 'the profile cannot be written',
    breaking: (repositories) => {
      jest.spyOn(repositories.profile, 'save').mockResolvedValue(err(storageFailure))
    },
  },
  {
    whichCall: 'the goal cannot be written',
    breaking: (repositories) => {
      jest.spyOn(repositories.goal, 'save').mockResolvedValue(err(storageFailure))
    },
  },
]

describe('submitGoal', () => {
  let repositories: Repositories
  let clock: FakeClock

  beforeEach(() => {
    clock = new FakeClock('2026-08-22')
    repositories = createInMemoryRepositories(clock, new CountingIdGenerator())
  })

  describe('the first goal', () => {
    it('writes the profile and the goal together', async () => {
      expect(expectOk(await submitGoal(repositories, submission()))).toMatchObject({
        target: money(1_200_000),
        coverageMonths: 6,
      })
      expect(expectOk(await repositories.profile.get())).toMatchObject({
        monthlyExpenses: money(200_000),
        currency: BRL,
      })
    })

    // The port keeps `save` and `recordChange` separate so that a first goal does not
    // manufacture a revision record for a change that never happened.
    it('records no revision, because nothing was revised', async () => {
      await submitGoal(repositories, submission())
      expect(await repositories.goal.listChanges()).toEqual({ ok: true, value: [] })
    })
  })

  describe('a revision', () => {
    beforeEach(async () => {
      await submitGoal(repositories, submission())
      clock.setToday('2026-09-01')
    })

    it('records what changed, in both directions (FR-006)', async () => {
      await submitGoal(
        repositories,
        submission({
          monthlyExpenses: money(300_000),
          goal: goalInput({ target: money(2_700_000), levelKey: 'cautious', coverageMonths: 9 }),
        }),
      )

      expect(expectOk(await repositories.goal.listChanges())).toEqual([
        {
          id: 'id-1',
          changedAt: clock.now(),
          previousTarget: money(1_200_000),
          newTarget: money(2_700_000),
          previousExpenses: money(200_000),
          newExpenses: money(300_000),
          previousCoverageMonths: 6,
          newCoverageMonths: 9,
        },
      ])
    })

    // Saving the same figures again is not a revision. Without this, every visit to the
    // goal screen that ended in "save" would add a row saying nothing changed, and the
    // history FR-035 shows the user would fill with noise.
    it('records nothing when the figures are unchanged', async () => {
      await submitGoal(repositories, submission())
      expect(await repositories.goal.listChanges()).toEqual({ ok: true, value: [] })
    })

    it('records a coverage change even when the expenses stayed the same', async () => {
      await submitGoal(
        repositories,
        submission({ goal: goalInput({ target: money(1_800_000), coverageMonths: 9 }) }),
      )
      expect(expectOk(await repositories.goal.listChanges())).toHaveLength(1)
    })

    it('records an override even when expenses and coverage stayed the same (FR-005)', async () => {
      await submitGoal(
        repositories,
        submission({ goal: goalInput({ source: 'user_defined', target: money(999_999) }) }),
      )
      expect(expectOk(await repositories.goal.listChanges())).toMatchObject([
        { previousTarget: money(1_200_000), newTarget: money(999_999) },
      ])
    })
  })

  describe('what it refuses', () => {
    // fund-export-v1's rule, applied to the write path too: a calculated target that does
    // not match its inputs is rejected rather than recomputed, because guessing which of
    // the two figures was meant would present a fabrication as the user's own number.
    it('rejects a calculated target that does not match the expenses and coverage', async () => {
      expect(
        expectErr(
          await submitGoal(repositories, submission({ goal: goalInput({ target: money(1) }) })),
        ),
      ).toMatchObject({
        kind: 'validation',
        field: 'target',
      })
    })

    it('writes nothing at all when the target is rejected', async () => {
      await submitGoal(repositories, submission({ goal: goalInput({ target: money(1) }) }))
      expect(await repositories.profile.get()).toEqual({ ok: true, value: null })
      expect(await repositories.goal.get()).toEqual({ ok: true, value: null })
    })

    // FR-039: the currency is fixed at setup. A later submission naming a different one is
    // a bug or a tampered import, and honouring it would reinterpret every stored amount
    // as a different unit of money without touching a single number.
    it('keeps the currency chosen at setup, ignoring a later one', async () => {
      await submitGoal(repositories, submission())
      await submitGoal(repositories, submission({ currency: currencyCode('USD') }))
      expect(expectOk(await repositories.profile.get())).toMatchObject({ currency: BRL })
    })
  })

  /*
   * Principle II. A submission that reported success after a failed write would tell the
   * user their target was saved when it was not — and the next screen, reading the same
   * storage, would show the previous figures with nothing to explain the difference.
   */
  describe('when storage fails', () => {
    it.each(storageFailureCases)('reports the failure when $whichCall', async ({ breaking }) => {
      breaking(repositories)
      expect(expectErr(await submitGoal(repositories, submission()))).toBe(storageFailure)
    })

    it('stops before writing the goal when the profile write fails', async () => {
      const saveGoal = jest.spyOn(repositories.goal, 'save')
      jest.spyOn(repositories.profile, 'save').mockResolvedValue(err(storageFailure))

      await submitGoal(repositories, submission())

      expect(saveGoal).not.toHaveBeenCalled()
    })

    // The revision record is the last write, and the easiest one to lose quietly: the goal
    // itself has already been stored by the time it fails, so the operation looks done.
    // FR-035 shows the user this history, and a gap in it is indistinguishable from a
    // change they never made.
    it('reports the failure when the revision cannot be recorded', async () => {
      await submitGoal(repositories, submission())
      jest.spyOn(repositories.goal, 'recordChange').mockResolvedValue(err(storageFailure))

      const revised = await submitGoal(
        repositories,
        submission({
          monthlyExpenses: money(300_000),
          goal: goalInput({ target: money(1_800_000) }),
        }),
      )

      expect(expectErr(revised)).toBe(storageFailure)
    })
  })
})
