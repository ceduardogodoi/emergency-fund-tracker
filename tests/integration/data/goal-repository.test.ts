import { createGoalRepository } from '@/data/sqlite/repositories/goal-repository'
import { calendarDate } from '@/domain/dates/calendar-date'
import type { GoalChangeInput, GoalInput } from '@/domain/goal/types'
import { money } from '@/domain/money/money'
import type { GoalRepository } from '@/domain/ports/repositories'
import { CountingIdGenerator, FakeClock } from '@tests/support/doubles'
import { expectOk } from '@tests/support/expect-result'
import { createMigratedDatabase, type TestDatabase } from '@tests/support/sqlite-harness'

/** The goal under test, so each case states only the field it is about. */
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

/** One recorded revision, defaulting to a rise in coverage. */
function changeInput(overrides: Partial<GoalChangeInput> = {}): GoalChangeInput {
  return {
    previousTarget: money(1_200_000),
    newTarget: money(1_800_000),
    previousExpenses: money(200_000),
    newExpenses: money(200_000),
    previousCoverageMonths: 6,
    newCoverageMonths: 9,
    ...overrides,
  }
}

describe('GoalRepository', () => {
  let db: TestDatabase
  let clock: FakeClock
  let ids: CountingIdGenerator
  let repository: GoalRepository

  beforeEach(async () => {
    db = await createMigratedDatabase()
    clock = new FakeClock('2026-08-22')
    ids = new CountingIdGenerator()
    repository = createGoalRepository(db, clock, ids)
  })

  afterEach(async () => {
    await db.close()
  })

  describe('the active goal', () => {
    it('reports no goal before onboarding has written one', async () => {
      expect(await repository.get()).toEqual({ ok: true, value: null })
    })

    it('saves a goal and stamps its audit fields from the clock', async () => {
      expect(await repository.save(goalInput())).toEqual({
        ok: true,
        value: { ...goalInput(), createdAt: clock.now(), updatedAt: clock.now() },
      })
    })

    it('round-trips an absent completion date as null rather than as a missing field', async () => {
      await repository.save(goalInput())
      expect(expectOk(await repository.get())).toMatchObject({ desiredCompletionDate: null })
    })

    it('round-trips a completion date the user set (FR-031)', async () => {
      await repository.save(goalInput({ desiredCompletionDate: calendarDate('2027-03-31') }))
      expect(expectOk(await repository.get())).toMatchObject({
        desiredCompletionDate: calendarDate('2027-03-31'),
      })
    })

    // FR-005: switching back to a calculated target restores the level the user chose, so
    // the coverage has to survive a period spent user-defined.
    it('keeps coverageMonths on a user-defined target', async () => {
      await repository.save(
        goalInput({ source: 'user_defined', levelKey: 'custom', target: money(999_999) }),
      )
      expect(expectOk(await repository.get())).toMatchObject({
        source: 'user_defined',
        coverageMonths: 6,
      })
    })

    // `createdAt` is when the goal was first set. An update that reset it would silently
    // rewrite that history.
    it('keeps the original createdAt when the goal is revised, and moves updatedAt', async () => {
      const created = expectOk(await repository.save(goalInput()))
      clock.setToday('2026-09-01')
      const revised = expectOk(await repository.save(goalInput({ target: money(1_800_000) })))

      expect(revised).toEqual({
        ...goalInput({ target: money(1_800_000) }),
        createdAt: created.createdAt,
        updatedAt: clock.now(),
      })
      expect(revised.updatedAt).not.toBe(created.updatedAt)
    })

    it('replaces the goal rather than accumulating rows', async () => {
      await repository.save(goalInput())
      await repository.save(goalInput({ target: money(1_800_000) }))

      const rows = await db.selectAll<{ readonly count: number }>(
        'SELECT COUNT(*) AS count FROM goal',
      )
      expect(rows).toEqual([{ count: 1 }])
    })

    // Principle II: no swallowed failures. A repository that let a constraint violation
    // throw would escape every caller's Result handling and reach the user as a crash.
    it('returns a storage failure when the schema rejects the write', async () => {
      expect(await repository.save(goalInput({ coverageMonths: 99 }))).toEqual({
        ok: false,
        error: expect.objectContaining({ kind: 'storage', messageKey: 'goal.save-failed' }),
      })
    })
  })

  describe('the change log', () => {
    it('records nothing until a revision is reported', async () => {
      await repository.save(goalInput())
      expect(await repository.listChanges()).toEqual({ ok: true, value: [] })
    })

    // The port separates the two so a first-time goal does not manufacture a revision
    // record for a change that never happened.
    it('does not write a change row when the goal is merely saved', async () => {
      await repository.save(goalInput())
      await repository.save(goalInput({ target: money(1_800_000) }))
      expect(await repository.listChanges()).toEqual({ ok: true, value: [] })
    })

    it('appends a revision with an id and timestamp it generates itself', async () => {
      expect(await repository.recordChange(changeInput())).toEqual({ ok: true, value: undefined })
      expect(await repository.listChanges()).toEqual({
        ok: true,
        value: [{ ...changeInput(), id: 'id-1', changedAt: clock.now() }],
      })
    })

    it('returns revisions oldest first, which is the order they are read in', async () => {
      await repository.recordChange(changeInput({ newCoverageMonths: 9 }))
      clock.setToday('2026-09-01')
      await repository.recordChange(changeInput({ newCoverageMonths: 12 }))

      const changes = expectOk(await repository.listChanges())
      expect(changes.map((change) => change.newCoverageMonths)).toEqual([9, 12])
    })

    // The contract the goal-history screen depends on: revisions written in the same
    // millisecond still come back in the order they were made.
    //
    // Worth knowing that this test passes with or without the query's `rowid` tiebreak —
    // today's engine returns these rows in insertion order anyway. It is asserting the
    // contract, not proving the mechanism, because SQLite specifies the order of
    // otherwise-equal rows as arbitrary and there is no way to make it choose another one
    // from out here. The tiebreak is what stops a future index from changing the answer.
    it('orders revisions sharing a timestamp by the order they were written', async () => {
      await repository.recordChange(changeInput({ newCoverageMonths: 9 }))
      await repository.recordChange(changeInput({ newCoverageMonths: 12 }))
      await repository.recordChange(changeInput({ newCoverageMonths: 3 }))

      const changes = expectOk(await repository.listChanges())
      expect(changes.map((change) => change.id)).toEqual(['id-1', 'id-2', 'id-3'])
      expect(changes.map((change) => change.newCoverageMonths)).toEqual([9, 12, 3])
    })

    it('returns a storage failure rather than throwing when the database is gone', async () => {
      await db.close()
      expect(await repository.listChanges()).toEqual({
        ok: false,
        error: expect.objectContaining({ kind: 'storage', messageKey: 'goal.changes-read-failed' }),
      })
    })
  })
})
