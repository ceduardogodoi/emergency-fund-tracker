import { createLedgerRepository } from '@/data/sqlite/repositories/ledger-repository'
import { calendarDate } from '@/domain/dates/calendar-date'
import type { LedgerEntryInput } from '@/domain/ledger/types'
import { money } from '@/domain/money/money'
import type { LedgerRepository } from '@/domain/ports/repositories'
import { CountingIdGenerator, FakeClock } from '@tests/support/doubles'
import { expectErr, expectOk } from '@tests/support/expect-result'
import { createMigratedDatabase, type TestDatabase } from '@tests/support/sqlite-harness'

/**
 * The ledger against real SQL (research decision D-006).
 *
 * The balance is derived from these rows and nothing else, so what is worth testing here is
 * not the arithmetic — `calculateBalance` owns that — but that a row survives the round trip
 * unchanged, that an edit reaches the right row, and that the order entries come back in is
 * the order the history has to show them in.
 */
const TODAY = '2026-08-22'

/**
 * The same database, but every single-row read raises.
 *
 * A spy rather than a doubled repository: what is under test is how this repository reacts
 * to the driver failing, so the driver is the only thing worth replacing.
 */
function failingReadsOn(db: TestDatabase): TestDatabase {
  return {
    ...db,
    async selectOne() {
      throw new Error('disk I/O error')
    },
  }
}

/** The entry under test, so each case states only the field it is about. */
function entryInput(overrides: Partial<LedgerEntryInput> = {}): LedgerEntryInput {
  return {
    type: 'contribution',
    amount: money(50_000),
    date: calendarDate(TODAY),
    note: null,
    withdrawalReason: null,
    ...overrides,
  }
}

describe('LedgerRepository', () => {
  let db: TestDatabase
  let clock: FakeClock
  let ids: CountingIdGenerator
  let repository: LedgerRepository

  beforeEach(async () => {
    db = await createMigratedDatabase()
    clock = new FakeClock(TODAY)
    ids = new CountingIdGenerator()
    repository = createLedgerRepository(db, clock, ids)
  })

  afterEach(async () => {
    await db.close()
  })

  describe('adding', () => {
    it('stamps the id and the audit times, and returns the stored entry', async () => {
      const stored = expectOk(await repository.add(entryInput({ note: 'Bônus' })))

      expect(stored).toMatchObject({
        id: expect.any(String),
        type: 'contribution',
        amount: money(50_000),
        date: calendarDate(TODAY),
        note: 'Bônus',
        withdrawalReason: null,
      })
      expect(stored.createdAt).toBe(clock.now())
      expect(stored.updatedAt).toBe(stored.createdAt)
    })

    it('reads back exactly what it stored', async () => {
      const stored = expectOk(await repository.add(entryInput()))

      expect(expectOk(await repository.getById(stored.id))).toEqual(stored)
    })

    it('keeps the reason a withdrawal is required to carry', async () => {
      const stored = expectOk(
        await repository.add(
          entryInput({ type: 'withdrawal', withdrawalReason: 'Conserto do carro' }),
        ),
      )

      expect(stored.withdrawalReason).toBe('Conserto do carro')
    })

    // The partial unique index in the migration, which is the rule's real home: a CHECK can
    // only see the row in front of it, and this one is about the table as a whole.
    it('refuses a second opening balance', async () => {
      expectOk(await repository.add(entryInput({ type: 'opening' })))

      const failure = expectErr(await repository.add(entryInput({ type: 'opening' })))

      expect(failure).toMatchObject({ kind: 'storage' })
    })
  })

  describe('reading one', () => {
    it('answers null for an id that was never stored', async () => {
      expect(expectOk(await repository.getById('nobody'))).toBeNull()
    })
  })

  describe('editing', () => {
    it('applies only the fields the patch carries', async () => {
      const stored = expectOk(await repository.add(entryInput({ note: 'Original' })))

      const updated = expectOk(await repository.update(stored.id, { amount: money(75_000) }))

      expect(updated).toMatchObject({ amount: money(75_000), note: 'Original', id: stored.id })
    })

    it('moves the updated time without touching the created time', async () => {
      const stored = expectOk(await repository.add(entryInput()))
      clock.setNow('2026-08-23T11:00:00.000Z')

      const updated = expectOk(await repository.update(stored.id, { amount: money(75_000) }))

      expect(updated.createdAt).toBe(stored.createdAt)
      expect(updated.updatedAt).not.toBe(stored.updatedAt)
    })

    it('clears a note when the patch sets it to null', async () => {
      const stored = expectOk(await repository.add(entryInput({ note: 'Original' })))

      expect(expectOk(await repository.update(stored.id, { note: null })).note).toBeNull()
    })

    it('moves the date when the patch carries one', async () => {
      const stored = expectOk(await repository.add(entryInput()))

      const updated = expectOk(
        await repository.update(stored.id, { date: calendarDate('2026-07-04') }),
      )

      expect(updated.date).toBe(calendarDate('2026-07-04'))
    })

    it('rewrites the reason on a withdrawal', async () => {
      const stored = expectOk(
        await repository.add(entryInput({ type: 'withdrawal', withdrawalReason: 'Dentista' })),
      )

      const updated = expectOk(
        await repository.update(stored.id, { withdrawalReason: 'Consulta médica' }),
      )

      expect(updated.withdrawalReason).toBe('Consulta médica')
    })

    // A not-found rather than a storage failure: the id is the caller's mistake, and the
    // screen's answer to it — the entry was deleted elsewhere — is not "try again".
    it('reports a missing entry as not found', async () => {
      const failure = expectErr(await repository.update('nobody', { amount: money(1) }))

      expect(failure).toMatchObject({ kind: 'not-found' })
    })

    // The distinction that matters when the disk is the problem: a read that fails is not a
    // row that is absent. Reporting not-found here would tell the user their entry had been
    // deleted, and the screen would offer them nothing to retry.
    it('reports a failed read as a storage failure, not as a missing entry', async () => {
      const stored = expectOk(await repository.add(entryInput()))
      const failing = failingReadsOn(db)

      const failure = expectErr(
        await createLedgerRepository(failing, clock, ids).update(stored.id, { amount: money(1) }),
      )

      expect(failure).toMatchObject({ kind: 'storage' })
    })
  })

  describe('deleting', () => {
    it('removes the entry', async () => {
      const stored = expectOk(await repository.add(entryInput()))

      expectOk(await repository.remove(stored.id))

      expect(expectOk(await repository.getById(stored.id))).toBeNull()
    })

    it('reports a missing entry as not found', async () => {
      expect(expectErr(await repository.remove('nobody'))).toMatchObject({ kind: 'not-found' })
    })

    // FR-011 allows any entry to be deleted, including the opening — and doing so has to
    // free the slot, or a user who corrected a mistaken opening could never enter the right one.
    it('frees the opening slot when the opening is deleted', async () => {
      const opening = expectOk(await repository.add(entryInput({ type: 'opening' })))

      expectOk(await repository.remove(opening.id))

      expect(expectOk(await repository.add(entryInput({ type: 'opening' })))).toBeTruthy()
    })
  })

  describe('listing', () => {
    it('is empty for a fund with no entries', async () => {
      expect(expectOk(await repository.list())).toEqual([])
    })

    // FR-014's chronological history.
    it('orders by entry date', async () => {
      const second = expectOk(await repository.add(entryInput({ date: calendarDate(TODAY) })))
      const first = expectOk(await repository.add(entryInput({ date: calendarDate('2026-01-05') })))

      const listed = expectOk(await repository.list())

      expect(listed.map((entry) => entry.id)).toEqual([first.id, second.id])
    })

    // Creation time breaks the tie between entries sharing a date, and this inserts them in
    // the opposite order to prove it. SQLite happens to return rows in insertion order when
    // nothing tells it otherwise, so a test whose two orders agree passes whether the
    // `ORDER BY` is there or not — which is what the equivalent test in `goal-repository`
    // warns about. Written this way, deleting the tiebreak fails it.
    it('breaks a shared date by when the entry was created, not by when it was inserted', async () => {
      clock.setNow('2026-08-22T18:00:00.000Z')
      const later = expectOk(await repository.add(entryInput({ date: calendarDate(TODAY) })))
      clock.setNow('2026-08-22T09:00:00.000Z')
      const earlier = expectOk(await repository.add(entryInput({ date: calendarDate(TODAY) })))

      const listed = expectOk(await repository.list())

      expect(listed.map((entry) => entry.id)).toEqual([earlier.id, later.id])
    })

    it('scopes to an inclusive range at both ends (FR-023)', async () => {
      const before = expectOk(
        await repository.add(entryInput({ date: calendarDate('2026-07-31') })),
      )
      const onFrom = expectOk(
        await repository.add(entryInput({ date: calendarDate('2026-08-01') })),
      )
      const onTo = expectOk(await repository.add(entryInput({ date: calendarDate('2026-08-31') })))
      const after = expectOk(await repository.add(entryInput({ date: calendarDate('2026-09-01') })))

      const listed = expectOk(
        await repository.list({ from: calendarDate('2026-08-01'), to: calendarDate('2026-08-31') }),
      )

      expect(listed.map((entry) => entry.id)).toEqual([onFrom.id, onTo.id])
      expect(listed.map((entry) => entry.id)).not.toContain(before.id)
      expect(listed.map((entry) => entry.id)).not.toContain(after.id)
    })
  })

  describe('the future-dated query', () => {
    // FR-033. These are excluded from every calculation, so the app needs them on their own
    // to put in front of the user for correction.
    it('returns entries dated after today, and only those', async () => {
      expectOk(await repository.add(entryInput({ date: calendarDate('2026-08-21') })))
      expectOk(await repository.add(entryInput({ date: calendarDate(TODAY) })))
      const tomorrow = expectOk(
        await repository.add(entryInput({ date: calendarDate('2026-08-23') })),
      )

      const listed = expectOk(await repository.listFutureDated(calendarDate(TODAY)))

      expect(listed.map((entry) => entry.id)).toEqual([tomorrow.id])
    })

    it('is empty when nothing is dated ahead', async () => {
      expectOk(await repository.add(entryInput({ date: calendarDate(TODAY) })))

      expect(expectOk(await repository.listFutureDated(calendarDate(TODAY)))).toEqual([])
    })
  })
})
