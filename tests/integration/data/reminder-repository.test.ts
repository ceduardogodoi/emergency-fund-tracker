import { createReminderRepository } from '@/data/sqlite/repositories/reminder-repository'
import type { ReminderRepository } from '@/domain/ports/repositories'
import { DEFAULT_REMINDER_SETTING } from '@/domain/reminders/schedule'
import type { ReminderSetting } from '@/domain/reminders/types'
import { expectErr, expectOk } from '@tests/support/expect-result'
import { createMigratedDatabase, type TestDatabase } from '@tests/support/sqlite-harness'

/**
 * The reminder setting, against real SQL (research decision D-006).
 *
 * One row or none. None is a first launch, or the moment after an erase (FR-048), and reads
 * as the default — off (FR-034). The fixtures differ from that default in every field, so a
 * read that fell back to it, or a save that dropped a column, would show (AP-002).
 */
const MONTHLY: ReminderSetting = {
  enabled: true,
  frequency: 'monthly',
  dayOfMonth: 17,
  dayOfWeek: null,
  timeOfDay: '20:30',
}

const WEEKLY: ReminderSetting = {
  enabled: true,
  frequency: 'weekly',
  dayOfMonth: null,
  dayOfWeek: 4,
  timeOfDay: '07:45',
}

describe('ReminderRepository', () => {
  let db: TestDatabase
  let repository: ReminderRepository

  beforeEach(async () => {
    db = await createMigratedDatabase()
    repository = createReminderRepository(db)
  })

  afterEach(async () => {
    await db.close()
  })

  /** The rows as stored, read past the repository so its own reads are not the witness. */
  async function storedRows(): Promise<readonly unknown[]> {
    return db.selectAll(
      'SELECT id, enabled, frequency, day_of_month, day_of_week, time_of_day FROM reminder_setting',
    )
  }

  // FR-034: off by default. Nothing is written for the default, so a first launch stores
  // no setting the user never chose.
  it('reads the default on a fresh store, without writing it', async () => {
    expect(expectOk(await repository.get())).toEqual(DEFAULT_REMINDER_SETTING)
    expect(await storedRows()).toEqual([])
  })

  it('stores a monthly setting and reads it back', async () => {
    expect(expectOk(await repository.save(MONTHLY))).toEqual(MONTHLY)

    expect(await storedRows()).toEqual([
      {
        id: 1,
        enabled: 1,
        frequency: 'monthly',
        day_of_month: 17,
        day_of_week: null,
        time_of_day: '20:30',
      },
    ])
    expect(expectOk(await repository.get())).toEqual(MONTHLY)
  })

  it('stores a weekly setting and reads it back', async () => {
    expectOk(await repository.save(WEEKLY))

    expect(expectOk(await repository.get())).toEqual(WEEKLY)
  })

  // `enabled` is an INTEGER in SQLite and a boolean in the domain. Both directions are
  // mapped; a read that treated 0 as truthy, or a write of `false` as anything but 0,
  // would turn a disabled reminder back on.
  it('stores a disabled setting as off', async () => {
    expectOk(await repository.save({ ...WEEKLY, enabled: false }))

    expect(await storedRows()).toEqual([expect.objectContaining({ enabled: 0 })])
    expect(expectOk(await repository.get())).toEqual({ ...WEEKLY, enabled: false })
  })

  // The table holds one row by constraint; a second save replaces it rather than failing
  // on the key or adding a row.
  it('replaces the setting on a second save', async () => {
    expectOk(await repository.save(MONTHLY))
    expectOk(await repository.save(WEEKLY))

    expect(await storedRows()).toHaveLength(1)
    expect(expectOk(await repository.get())).toEqual(WEEKLY)
  })

  // An erase deletes the row (FR-048), and what is read after it is a first launch's.
  it('reads the default again once the row is gone', async () => {
    expectOk(await repository.save(MONTHLY))
    await db.run('DELETE FROM reminder_setting')

    expect(expectOk(await repository.get())).toEqual(DEFAULT_REMINDER_SETTING)
  })

  // The schema refuses what the domain would have refused. Reaching it means a caller went
  // around the validation, and the refusal surfaces as a failure, not a throw.
  it('reports a write the schema refuses as a storage failure, leaving the row as it was', async () => {
    expectOk(await repository.save(MONTHLY))

    const error = expectErr(await repository.save({ ...MONTHLY, dayOfMonth: 29 }))

    expect(error).toEqual(
      expect.objectContaining({ kind: 'storage', messageKey: 'reminders.save-failed' }),
    )
    expect(expectOk(await repository.get())).toEqual(MONTHLY)
  })

  it('reports a read that fails as a storage failure', async () => {
    await db.close()

    expect(expectErr(await repository.get())).toEqual(
      expect.objectContaining({ kind: 'storage', messageKey: 'reminders.read-failed' }),
    )

    // `afterEach` closes it again; reopen so that close has something to close.
    db = await createMigratedDatabase()
  })
})
