import { calendarDate } from '@/domain/dates/calendar-date'
import { storageError } from '@/domain/errors/app-error'
import { MAXIMUM_NOTE_LENGTH } from '@/domain/ledger/entry'
import { reviseEntry } from '@/domain/ledger/revise-entry'
import type { LedgerEntry, LedgerEntryInput } from '@/domain/ledger/types'
import { money } from '@/domain/money/money'
import type { Repositories } from '@/domain/ports/repositories'
import { err } from '@/domain/result'
import { CountingIdGenerator, FakeClock, createInMemoryRepositories } from '@tests/support/doubles'
import { expectErr, expectOk } from '@tests/support/expect-result'

/**
 * Correcting an entry already in the ledger (FR-011).
 *
 * An edit is held to the rules a new entry is (FR-008, FR-009): a correction that could set
 * an amount to zero or a date to next week would be a way around them that every form
 * offers. What is checked is the entry as it would be stored — the patch laid over what is
 * there — because a patch on its own is a fragment, and a fragment has no date to be late.
 */
const TODAY = calendarDate('2026-10-01')

let repositories: Repositories

beforeEach(() => {
  repositories = createInMemoryRepositories(new FakeClock(TODAY), new CountingIdGenerator())
})

/** Stores an entry directly, past the rules, the way an import or an old clock could. */
async function stored(overrides: Partial<LedgerEntryInput> = {}): Promise<LedgerEntry> {
  return expectOk(
    await repositories.ledger.add({
      type: 'contribution',
      amount: money(50_000),
      date: calendarDate('2026-09-15'),
      note: 'Décimo terceiro',
      withdrawalReason: null,
      ...overrides,
    }),
  )
}

async function readBack(id: string): Promise<LedgerEntry | null> {
  return expectOk(await repositories.ledger.getById(id))
}

describe('reviseEntry', () => {
  it('changes what the patch names and leaves the rest as it was', async () => {
    const entry = await stored()

    const revised = expectOk(
      await reviseEntry(repositories, entry.id, { amount: money(70_000) }, TODAY),
    )

    expect(revised).toMatchObject({
      id: entry.id,
      type: 'contribution',
      amount: money(70_000),
      date: entry.date,
      note: 'Décimo terceiro',
    })
    expect(await readBack(entry.id)).toEqual(revised)
  })

  it('clears a note that is set to null', async () => {
    const entry = await stored()

    expectOk(await reviseEntry(repositories, entry.id, { note: null }, TODAY))

    expect(await readBack(entry.id)).toMatchObject({ note: null })
  })

  it('refuses an amount of zero, naming the amount, and changes nothing', async () => {
    const entry = await stored()

    const failure = expectErr(
      await reviseEntry(repositories, entry.id, { amount: money(0) }, TODAY),
    )

    expect(failure).toMatchObject({ kind: 'validation', field: 'amount' })
    expect(await readBack(entry.id)).toEqual(entry)
  })

  it('refuses a date after today, and changes nothing', async () => {
    const entry = await stored()

    const failure = expectErr(
      await reviseEntry(repositories, entry.id, { date: calendarDate('2026-10-02') }, TODAY),
    )

    expect(failure).toMatchObject({ kind: 'validation', field: 'date' })
    expect(await readBack(entry.id)).toEqual(entry)
  })

  it('refuses a note over the limit', async () => {
    const entry = await stored()

    const failure = expectErr(
      await reviseEntry(
        repositories,
        entry.id,
        { note: 'x'.repeat(MAXIMUM_NOTE_LENGTH + 1) },
        TODAY,
      ),
    )

    expect(failure).toMatchObject({ kind: 'validation', field: 'note' })
  })

  // A note longer than the form allows can only have come from an import, and the way to
  // be rid of it is to clear it. Null is a value here, not an absence: read as "left
  // alone", the stored note would be checked instead and the clearing refused for it.
  it('lets a note that is too long be cleared', async () => {
    const entry = await stored({ note: 'x'.repeat(MAXIMUM_NOTE_LENGTH + 1) })

    expectOk(await reviseEntry(repositories, entry.id, { note: null }, TODAY))

    expect(await readBack(entry.id)).toMatchObject({ note: null })
  })

  // The patch says nothing about the date, and the date is still what is wrong. FR-033
  // asks for an entry like this one to be corrected, and an edit that left it dated ahead
  // would have corrected something else.
  it('checks the fields the patch leaves alone, as they are stored', async () => {
    const ahead = await stored({ date: calendarDate('2026-10-05') })

    const failure = expectErr(
      await reviseEntry(repositories, ahead.id, { amount: money(70_000) }, TODAY),
    )

    expect(failure).toMatchObject({ kind: 'validation', field: 'date' })
  })

  it('lets a future-dated entry be brought back to a day that has happened', async () => {
    const ahead = await stored({ date: calendarDate('2026-10-05') })

    expectOk(await reviseEntry(repositories, ahead.id, { date: TODAY }, TODAY))

    expect(await readBack(ahead.id)).toMatchObject({ date: TODAY })
  })

  // The rule against a second opening balance is about adding one. The one being edited is
  // the one that exists.
  it('lets the opening balance be corrected', async () => {
    const opening = await stored({ type: 'opening', note: null })

    expectOk(await reviseEntry(repositories, opening.id, { amount: money(300_000) }, TODAY))

    expect(await readBack(opening.id)).toMatchObject({ type: 'opening', amount: money(300_000) })
  })

  it('reports an entry that is not there', async () => {
    const failure = expectErr(
      await reviseEntry(repositories, 'no-such-entry', { amount: money(1) }, TODAY),
    )

    expect(failure).toMatchObject({ kind: 'not-found' })
  })

  it('reports a ledger it cannot read as the storage failure it is', async () => {
    const entry = await stored()
    jest
      .spyOn(repositories.ledger, 'getById')
      .mockResolvedValue(err(storageError('ledger.read-failed')))

    const failure = expectErr(
      await reviseEntry(repositories, entry.id, { amount: money(70_000) }, TODAY),
    )

    expect(failure).toMatchObject({ kind: 'storage' })
  })
})
