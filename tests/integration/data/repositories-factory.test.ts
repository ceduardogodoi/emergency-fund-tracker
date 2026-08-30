import { createRepositoriesFactory } from '@/data/sqlite/repositories/factory'
import { calendarDate } from '@/domain/dates/calendar-date'
import { money } from '@/domain/money/money'
import { currencyCode } from '@/domain/money/currency'
import type { Repositories } from '@/domain/ports/repositories'
import type { Result } from '@/domain/result'
import { CountingIdGenerator, FakeClock } from '@tests/support/doubles'
import { expectErr, expectOk } from '@tests/support/expect-result'
import { createMigratedDatabase, type TestDatabase } from '@tests/support/sqlite-harness'

/**
 * The factory the composition root hands to the unit of work.
 *
 * Two of the five repositories are implemented; the rest arrive with their own user
 * stories. What matters here is that the unimplemented three fail loudly — a stub that
 * returned an empty list would be indistinguishable from a fund with no entries, and the
 * app would render a zero balance as though it were the truth.
 */
describe('the repository set', () => {
  let db: TestDatabase
  let repositories: Repositories

  beforeEach(async () => {
    db = await createMigratedDatabase()
    repositories = createRepositoriesFactory(
      new FakeClock('2026-08-22'),
      new CountingIdGenerator(),
    )(db)
  })

  afterEach(async () => {
    await db.close()
  })

  describe('what is implemented', () => {
    it('binds the profile repository to the database it was given', async () => {
      await repositories.profile.save({
        monthlyExpenses: money(200_000),
        currency: currencyCode('BRL'),
      })
      expect(expectOk(await repositories.profile.get())).toMatchObject({
        monthlyExpenses: money(200_000),
      })
    })

    it('binds the goal repository to the database it was given', async () => {
      await repositories.goal.save({
        target: money(1_200_000),
        source: 'calculated',
        levelKey: 'balanced',
        coverageMonths: 6,
        desiredCompletionDate: null,
      })
      expect(expectOk(await repositories.goal.get())).toMatchObject({ target: money(1_200_000) })
    })
  })

  describe('what is not implemented yet', () => {
    /**
     * Every call that must fail rather than answer.
     *
     * Typed as returning `Result<unknown>` rather than `Promise<unknown>` so the list
     * cannot accidentally hold a call that does not return a result at all — which would
     * make `expectErr` unable to see what it was given.
     */
    const pendingCalls: readonly (readonly [
      string,
      (repos: Repositories) => Promise<Result<unknown>>,
    ])[] = [
      [
        'ledger.add',
        (repos) =>
          repos.ledger.add({
            type: 'contribution',
            amount: money(1),
            date: calendarDate('2026-08-22'),
            note: null,
            withdrawalReason: null,
          }),
      ],
      ['ledger.list', (repos) => repos.ledger.list()],
      ['ledger.getById', (repos) => repos.ledger.getById('id-1')],
      [
        'ledger.listFutureDated',
        (repos) => repos.ledger.listFutureDated(calendarDate('2026-08-22')),
      ],
      ['ledger.update', (repos) => repos.ledger.update('id-1', {})],
      ['ledger.remove', (repos) => repos.ledger.remove('id-1')],
      ['reminders.get', (repos) => repos.reminders.get()],
      [
        'reminders.save',
        (repos) =>
          repos.reminders.save({
            enabled: false,
            frequency: 'monthly',
            dayOfMonth: 1,
            dayOfWeek: null,
            timeOfDay: '09:00',
          }),
      ],
      ['milestones.listAcknowledged', (repos) => repos.milestones.listAcknowledged()],
      ['milestones.acknowledge', (repos) => repos.milestones.acknowledge(50)],
      ['milestones.clearAbove', (repos) => repos.milestones.clearAbove(50)],
    ]

    // The dangerous failure is not a crash but a plausible answer: `ok([])` from the ledger
    // reads as "this fund has no entries", and the balance would render as zero.
    it.each(pendingCalls)(
      '%s reports that it is unimplemented rather than answering',
      async (_name, call) => {
        expect(expectErr(await call(repositories))).toMatchObject({
          kind: 'storage',
          messageKey: 'repository.not-implemented',
        })
      },
    )
  })
})
