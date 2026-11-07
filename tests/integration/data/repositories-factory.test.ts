import { createRepositoriesFactory } from '@/data/sqlite/repositories/factory'
import { calendarDate } from '@/domain/dates/calendar-date'
import { money } from '@/domain/money/money'
import { currencyCode } from '@/domain/money/currency'
import type { Repositories } from '@/domain/ports/repositories'
import { CountingIdGenerator, FakeClock } from '@tests/support/doubles'
import { expectOk } from '@tests/support/expect-result'
import { createMigratedDatabase, type TestDatabase } from '@tests/support/sqlite-harness'

/**
 * The factory the composition root hands to the unit of work.
 *
 * Each repository is bound to the database handle the factory was given, which is what keeps
 * a write inside the transaction it was made in. Every one is implemented since T131, when
 * the last placeholder — the reminders', which failed every call — was deleted.
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

    it('binds the ledger repository to the database it was given', async () => {
      await repositories.ledger.add({
        type: 'contribution',
        amount: money(50_000),
        date: calendarDate('2026-08-22'),
        note: null,
        withdrawalReason: null,
      })
      expect(expectOk(await repositories.ledger.list())).toMatchObject([{ amount: money(50_000) }])
    })

    it('binds the milestone repository to the database it was given', async () => {
      expectOk(await repositories.milestones.acknowledge(50))

      expect(expectOk(await repositories.milestones.listAcknowledged())).toEqual([50])
    })

    it('binds the reminder repository to the database it was given', async () => {
      expectOk(
        await repositories.reminders.save({
          enabled: true,
          frequency: 'weekly',
          dayOfMonth: null,
          dayOfWeek: 4,
          timeOfDay: '07:45',
        }),
      )

      expect(await db.selectAll('SELECT day_of_week FROM reminder_setting')).toEqual([
        { day_of_week: 4 },
      ])
    })
  })
})
