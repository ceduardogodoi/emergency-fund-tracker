import { calendarDate, monthKeysBetween } from '@/domain/dates/calendar-date'
import { instant } from '@/domain/dates/instant'
import type { EntryType, LedgerEntry } from '@/domain/ledger/types'
import { money, zero } from '@/domain/money/money'
import { breakdownByMonth } from '@/domain/statistics/breakdown'

/**
 * The month-by-month breakdown (FR-022): what went in and out each month, and where the
 * balance closed — which is how the statistics view states balance growth (FR-019).
 *
 * Today is the 15th of October. The fund:
 *
 *   May  opening 3 000,00
 *   Jun  contributions 500,00 and 200,00
 *   Jul  nothing
 *   Aug  contribution 700,00, withdrawal 150,00
 *   Sep  contribution 400,00
 *   Oct  contribution 100,00 on the 2nd, and 990,00 dated the 20th — after today
 */
const TODAY = calendarDate('2026-10-15')

let sequence = 0

/** Builds an entry. */
function entry(type: EntryType, minorUnits: number, date: string): LedgerEntry {
  sequence += 1
  return {
    id: `entry-${sequence}`,
    type,
    amount: money(minorUnits),
    date: calendarDate(date),
    note: null,
    withdrawalReason: type === 'withdrawal' ? 'Emergência' : null,
    createdAt: instant('2026-10-01T10:00:00.000Z'),
    updatedAt: instant('2026-10-01T10:00:00.000Z'),
  }
}

/** The fund described above. */
function fund(): readonly LedgerEntry[] {
  return [
    entry('opening', 300_000, '2026-05-10'),
    entry('contribution', 50_000, '2026-06-05'),
    entry('contribution', 20_000, '2026-06-20'),
    entry('contribution', 70_000, '2026-08-05'),
    entry('withdrawal', 15_000, '2026-08-12'),
    entry('contribution', 40_000, '2026-09-03'),
    entry('contribution', 10_000, '2026-10-02'),
    entry('contribution', 99_000, '2026-10-20'),
  ]
}

describe('breakdownByMonth', () => {
  // Every row worked by hand. July has nothing and is still there (FR-022): a month the
  // user saved nothing in is information, not an absence of it. October closes at today,
  // without the 990,00 still to come (FR-033).
  it('gives each month what went in, what went out, and where the balance closed', () => {
    expect(breakdownByMonth(fund(), monthKeysBetween('2026-05', '2026-10'), TODAY)).toEqual([
      { month: '2026-05', contributed: zero, withdrawn: zero, closingBalance: money(300_000) },
      {
        month: '2026-06',
        contributed: money(70_000),
        withdrawn: zero,
        closingBalance: money(370_000),
      },
      { month: '2026-07', contributed: zero, withdrawn: zero, closingBalance: money(370_000) },
      {
        month: '2026-08',
        contributed: money(70_000),
        withdrawn: money(15_000),
        closingBalance: money(425_000),
      },
      {
        month: '2026-09',
        contributed: money(40_000),
        withdrawn: zero,
        closingBalance: money(465_000),
      },
      {
        month: '2026-10',
        contributed: money(10_000),
        withdrawn: zero,
        closingBalance: money(475_000),
      },
    ])
  })

  // The opening balance is where the balance starts, not something contributed.
  it('counts the opening balance in the balance and not in what was contributed', () => {
    const [may] = breakdownByMonth(fund(), ['2026-05'], TODAY)

    expect(may).toEqual({
      month: '2026-05',
      contributed: zero,
      withdrawn: zero,
      closingBalance: money(300_000),
    })
  })

  // Filtered to a period, the balance is still the real one. July closes at 3 700,00
  // because of everything before July, not at zero because the period starts there.
  it('carries the balance in from before the period', () => {
    const rows = breakdownByMonth(fund(), monthKeysBetween('2026-07', '2026-09'), TODAY)

    expect(rows.map((row) => row.closingBalance)).toEqual([
      money(370_000),
      money(425_000),
      money(465_000),
    ])
  })

  // A withdrawal larger than the fund is a real state (FR-017), and the closing balance
  // has to go below zero to show it rather than stopping at nothing.
  it('lets the balance close below zero', () => {
    const entries = [
      entry('contribution', 10_000, '2026-09-01'),
      entry('withdrawal', 25_000, '2026-09-02'),
    ]

    expect(breakdownByMonth(entries, ['2026-09'], TODAY)).toEqual([
      {
        month: '2026-09',
        contributed: money(10_000),
        withdrawn: money(25_000),
        closingBalance: money(-15_000),
      },
    ])
  })

  // A backfilled entry lands in the month its date names, whatever order it was typed in.
  it('does not depend on the order entries arrive in', () => {
    const months = monthKeysBetween('2026-05', '2026-10')

    expect(breakdownByMonth(fund().toReversed(), months, TODAY)).toEqual(
      breakdownByMonth(fund(), months, TODAY),
    )
  })

  it('has no rows for a period with no months', () => {
    expect(breakdownByMonth(fund(), [], TODAY)).toEqual([])
  })
})
