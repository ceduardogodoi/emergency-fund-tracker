import { calendarDate } from '@/domain/dates/calendar-date'
import { instant } from '@/domain/dates/instant'
import { calculateBalance } from '@/domain/ledger/balance'
import type { EntryType, LedgerEntry } from '@/domain/ledger/types'
import { money, zero } from '@/domain/money/money'

/**
 * The balance is the fund (FR-012). Nothing stores it: it is the sum of the entries every
 * time it is asked for, which is what makes an edit or a deletion correct by construction
 * rather than by remembering to adjust a running total.
 */
const TODAY = calendarDate('2026-08-22')

/** Builds an entry. Only the fields the balance reads are worth naming at a call site. */
function entry(type: EntryType, minorUnits: number, date: string = TODAY): LedgerEntry {
  return {
    id: `entry-${type}-${minorUnits}-${date}`,
    type,
    amount: money(minorUnits),
    date: calendarDate(date),
    note: null,
    withdrawalReason: type === 'withdrawal' ? 'Emergência' : null,
    createdAt: instant('2026-08-22T10:00:00.000Z'),
    updatedAt: instant('2026-08-22T10:00:00.000Z'),
  }
}

describe('calculateBalance', () => {
  it('is zero for a fund with no entries', () => {
    expect(calculateBalance([], TODAY)).toBe(zero)
  })

  // FR-012's definition, and the reason `opening` is an entry rather than a column: every
  // term of the balance lives in the ledger.
  it('adds the opening balance and contributions, and subtracts withdrawals', () => {
    const entries = [
      entry('opening', 100_000),
      entry('contribution', 50_000),
      entry('contribution', 25_000),
      entry('withdrawal', 30_000),
    ]

    expect(calculateBalance(entries, TODAY)).toBe(money(145_000))
  })

  // FR-033. A contribution the user has not made yet is not money they have, and a balance
  // that counted it would overstate the fund on the one screen they trust most.
  it('excludes entries dated after today', () => {
    const entries = [
      entry('contribution', 50_000, '2026-08-22'),
      entry('contribution', 90_000, '2026-08-23'),
    ]

    expect(calculateBalance(entries, TODAY)).toBe(money(50_000))
  })

  // The boundary the exclusion turns on: today is not the future.
  it('includes an entry dated today', () => {
    expect(calculateBalance([entry('contribution', 50_000, '2026-08-22')], TODAY)).toBe(
      money(50_000),
    )
  })

  it('includes entries dated before today', () => {
    expect(calculateBalance([entry('contribution', 50_000, '2026-01-05')], TODAY)).toBe(
      money(50_000),
    )
  })

  // A withdrawal larger than everything saved is a real state — FR-017 warns about it but
  // does not forbid it — and the balance has to report it rather than clamping at zero.
  it('reports a negative balance when withdrawals exceed everything saved', () => {
    const entries = [entry('contribution', 20_000), entry('withdrawal', 50_000)]

    expect(calculateBalance(entries, TODAY)).toBe(money(-30_000))
  })

  // Order is the caller's concern, not the balance's: addition commutes, and a repository
  // that changed its sort must not change the fund.
  it('does not depend on the order entries arrive in', () => {
    const entries = [
      entry('withdrawal', 30_000),
      entry('opening', 100_000),
      entry('contribution', 50_000),
    ]
    const reversed = entries.toReversed()

    expect(calculateBalance(entries, TODAY)).toBe(calculateBalance(reversed, TODAY))
  })
})
