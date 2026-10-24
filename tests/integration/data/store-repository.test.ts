import { createGoalRepository } from '@/data/sqlite/repositories/goal-repository'
import { createLedgerRepository } from '@/data/sqlite/repositories/ledger-repository'
import { createProfileRepository } from '@/data/sqlite/repositories/profile-repository'
import { createStoreRepository } from '@/data/sqlite/repositories/store-repository'
import { currencyCode } from '@/domain/money/currency'
import { calendarDate } from '@/domain/dates/calendar-date'
import { money } from '@/domain/money/money'
import { CountingIdGenerator, FakeClock } from '@tests/support/doubles'
import { expectOk } from '@tests/support/expect-result'
import { createMigratedDatabase, type TestDatabase } from '@tests/support/sqlite-harness'

/**
 * Erasing everything (FR-048), as the seed script's reset uses it and T145's flow will.
 *
 * "Everything" is read from the schema rather than listed here. A table added by a later
 * migration and forgotten by the erase would leave the user's data behind after they were
 * told it was gone — so the test asks SQLite which tables exist, fills each one, and
 * checks each one is empty afterwards.
 */
describe('StoreRepository', () => {
  let db: TestDatabase
  let clock: FakeClock
  let ids: CountingIdGenerator

  beforeEach(async () => {
    db = await createMigratedDatabase()
    clock = new FakeClock('2026-08-22')
    ids = new CountingIdGenerator()
  })

  afterEach(async () => {
    await db.close()
  })

  /** Every table the migrations created, read from the schema itself. */
  async function tables(): Promise<readonly string[]> {
    const rows = await db.selectAll<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
    )
    return rows.map((row) => row.name)
  }

  async function rowsIn(table: string): Promise<number> {
    const row = await db.selectOne<{ count: number }>(`SELECT COUNT(*) AS count FROM ${table}`)
    return row?.count ?? 0
  }

  /**
   * A row in every table. Through the repositories where one exists; the reminder and
   * milestone repositories are not built yet, so those two rows are written directly.
   */
  async function fillEveryTable(): Promise<void> {
    expectOk(
      await createProfileRepository(db, clock).save({
        monthlyExpenses: money(200_000),
        currency: currencyCode('BRL'),
      }),
    )
    const goals = createGoalRepository(db, clock, ids)
    expectOk(
      await goals.save({
        target: money(1_200_000),
        source: 'calculated',
        levelKey: 'balanced',
        coverageMonths: 6,
        desiredCompletionDate: null,
      }),
    )
    expectOk(
      await goals.recordChange({
        previousTarget: money(1_200_000),
        newTarget: money(1_800_000),
        previousExpenses: money(200_000),
        newExpenses: money(200_000),
        previousCoverageMonths: 6,
        newCoverageMonths: 9,
      }),
    )
    expectOk(
      await createLedgerRepository(db, clock, ids).add({
        type: 'contribution',
        amount: money(50_000),
        date: calendarDate('2026-08-01'),
        note: null,
        withdrawalReason: null,
      }),
    )
    await db.run(
      "INSERT INTO reminder_setting (id, enabled, frequency, day_of_month, time_of_day) VALUES (1, 1, 'monthly', 5, '09:00')",
    )
    await db.run(
      "INSERT INTO milestone_ack (threshold, acknowledged_at) VALUES (25, '2026-08-22T12:00:00.000Z')",
    )
  }

  it('leaves every table empty, as on first launch', async () => {
    await fillEveryTable()
    // Proves the fixture: an erase that touched nothing would pass on empty tables.
    for (const table of await tables()) {
      expect({ table, rows: await rowsIn(table) }).toEqual({ table, rows: 1 })
    }

    expectOk(await createStoreRepository(db).eraseAll())

    for (const table of await tables()) {
      expect({ table, rows: await rowsIn(table) }).toEqual({ table, rows: 0 })
    }
  })

  // The schema version lives in `PRAGMA user_version`, not in a table. Erasing must not
  // send the next launch back through the migrations onto tables that already exist.
  it('keeps the schema at its version', async () => {
    const before = await db.selectOne<{ user_version: number }>('PRAGMA user_version')

    expectOk(await createStoreRepository(db).eraseAll())

    expect(await db.selectOne('PRAGMA user_version')).toEqual(before)
    expect(before?.user_version).toBeGreaterThan(0)
  })

  it('reports a failure to erase as a storage failure', async () => {
    await db.close()

    const result = await createStoreRepository(db).eraseAll()

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ kind: 'storage', messageKey: 'store.erase-failed' }),
    })
    db = await createMigratedDatabase()
  })
})
