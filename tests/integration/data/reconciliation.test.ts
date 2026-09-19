import { createLedgerRepository } from '@/data/sqlite/repositories/ledger-repository'
import { calendarDate, type CalendarDate } from '@/domain/dates/calendar-date'
import { calculateBalance } from '@/domain/ledger/balance'
import type { EntryType, LedgerEntryInput } from '@/domain/ledger/types'
import { money } from '@/domain/money/money'
import type { LedgerRepository } from '@/domain/ports/repositories'
import { CountingIdGenerator, FakeClock } from '@tests/support/doubles'
import { expectOk } from '@tests/support/expect-result'
import { createMigratedDatabase, type TestDatabase } from '@tests/support/sqlite-harness'

/**
 * SC-007: across at least a thousand randomised entry sequences, the reported balance
 * matches the exact sum of the entries, with zero rounding discrepancies.
 *
 * This is the test the branded `Money` type exists for. A fund is an integer count of
 * centavos precisely so that no sequence of additions can drift, and the claim is only
 * worth anything if something tries hard to break it.
 *
 * Two choices make it a real check rather than a restatement:
 *
 * The expected figure is summed in `BigInt`, which cannot lose precision at any magnitude.
 * Comparing a `number` balance against it is what would catch drift — recomputing the
 * expectation with the same arithmetic the code uses would agree with itself no matter how
 * wrong both were.
 *
 * Every sequence goes through SQLite and is read back before being summed, so the round
 * trip is inside the claim. An integer that survives addition but is stored as a float, or
 * bound through a driver that widens it, would fail here and nowhere else.
 */
const TODAY = '2026-08-22'

/** Enough sequences to satisfy SC-007, which asks for at least a thousand. */
const SEQUENCES = 1_000

/** Entries per sequence. Long enough for drift to accumulate if it were going to. */
const MAXIMUM_ENTRIES = 12

/**
 * Amounts spanning the range a fund actually sees, up to about ten million reais.
 *
 * Deliberately not round numbers: a sum of values ending in zeros would hide exactly the
 * low-order loss this test is looking for.
 */
const MAXIMUM_AMOUNT_MINOR_UNITS = 999_999_937

/**
 * A seeded generator, so a failure is reproducible.
 *
 * `Math.random` would make this test a lottery: the sequence that broke it would be gone
 * the moment it reported, and the failure would be unreproducible on the machine that has
 * to fix it. Mulberry32 — small, fast, and good enough for choosing amounts and dates.
 *
 * @param seed Any 32-bit integer.
 * @returns A function producing the next value in [0, 1).
 */
function seededRandom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let drifted = Math.imul(state ^ (state >>> 15), 1 | state)
    drifted = (drifted + Math.imul(drifted ^ (drifted >>> 7), 61 | drifted)) ^ drifted
    return ((drifted ^ (drifted >>> 14)) >>> 0) / 4_294_967_296
  }
}

/** A whole number in [0, bound). */
function randomInt(random: () => number, bound: number): number {
  return Math.floor(random() * bound)
}

/**
 * A date near today, sometimes ahead of it.
 *
 * Future dates are generated on purpose: FR-033 excludes them from the balance, so a
 * sequence containing them is the one that proves the exclusion survives the round trip
 * rather than being a property of the in-memory array.
 */
function randomDate(random: () => number): CalendarDate {
  const day = 10 + randomInt(random, 20)
  return calendarDate(`2026-08-${String(day).padStart(2, '0')}`)
}

/** One entry, valid against every constraint the schema enforces. */
function randomEntry(random: () => number, allowOpening: boolean): LedgerEntryInput {
  const types: readonly EntryType[] = allowOpening
    ? ['opening', 'contribution', 'withdrawal']
    : ['contribution', 'withdrawal']
  const type = types[randomInt(random, types.length)] ?? 'contribution'
  return {
    type,
    amount: money(1 + randomInt(random, MAXIMUM_AMOUNT_MINOR_UNITS)),
    date: randomDate(random),
    note: null,
    withdrawalReason: type === 'withdrawal' ? 'Emergência' : null,
  }
}

/**
 * The balance the entries add up to, computed independently and exactly.
 *
 * `BigInt` rather than `number`, and the FR-033 exclusion applied by hand, so this owes
 * nothing to the code under test.
 */
function exactBalance(entries: readonly LedgerEntryInput[], today: CalendarDate): bigint {
  return entries.reduce<bigint>((total, entry) => {
    if (entry.date > today) {
      return total
    }
    const amount = BigInt(entry.amount)
    return entry.type === 'withdrawal' ? total - amount : total + amount
  }, 0n)
}

describe('balance reconciliation (SC-007)', () => {
  let db: TestDatabase
  let repository: LedgerRepository

  beforeEach(async () => {
    db = await createMigratedDatabase()
    repository = createLedgerRepository(db, new FakeClock(TODAY), new CountingIdGenerator())
  })

  afterEach(async () => {
    await db.close()
  })

  it(`reports the exact sum across ${SEQUENCES} randomised sequences`, async () => {
    const random = seededRandom(20_260_822)
    const today = calendarDate(TODAY)
    // One database reused across sequences, cleared between them: a thousand migrations
    // would dominate the runtime and prove nothing beyond the first.
    for (let sequence = 0; sequence < SEQUENCES; sequence += 1) {
      await db.execute('DELETE FROM ledger_entry')

      const written: LedgerEntryInput[] = []
      // At most one opening per sequence — the partial unique index enforces it, and a
      // rejected insert would silently shorten the sequence being measured.
      let openingUsed = randomInt(random, 2) === 0
      for (let index = 0; index < 1 + randomInt(random, MAXIMUM_ENTRIES); index += 1) {
        const entry = randomEntry(random, !openingUsed)
        openingUsed = openingUsed || entry.type === 'opening'
        expectOk(await repository.add(entry))
        written.push(entry)
      }

      const storedEntries = expectOk(await repository.list())
      expect(storedEntries).toHaveLength(written.length)
      expect(BigInt(calculateBalance(storedEntries, today))).toBe(exactBalance(written, today))
    }
  })
})
