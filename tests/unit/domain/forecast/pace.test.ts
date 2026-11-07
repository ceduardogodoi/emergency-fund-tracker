import { calendarDate } from '@/domain/dates/calendar-date'
import { instant } from '@/domain/dates/instant'
import {
  calculateContributionPace,
  calculatePace,
  MINIMUM_PACE_MONTHS,
  PACE_WINDOW_MONTHS,
} from '@/domain/forecast/pace'
import type { EntryType, LedgerEntry } from '@/domain/ledger/types'
import { money } from '@/domain/money/money'

/**
 * The saving pace (FR-026, FR-029): net saved over the most recent complete calendar months,
 * up to six of them, per month (research D-017).
 *
 * Today is the 15th of October, so October is in progress and September is the last
 * complete month. Six complete months back is April.
 */
const TODAY = calendarDate('2026-10-15')

let sequence = 0

/** Builds an entry. The pace reads only the type, the amount, and the date. */
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

/** One contribution of `minorUnits` on the 5th of each named month, `YYYY-MM`. */
function contributionsIn(minorUnits: number, ...months: string[]): LedgerEntry[] {
  return months.map((month) => entry('contribution', minorUnits, `${month}-05`))
}

/** April to September, the six complete months before today. */
const WINDOW = ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']

describe('calculatePace', () => {
  it('states the window and the minimum the spec sets', () => {
    expect(PACE_WINDOW_MONTHS).toBe(6)
    expect(MINIMUM_PACE_MONTHS).toBe(3)
  })

  // Spec, Story 4 scenario 1: six months averaging 500 a month.
  it('averages the net saved over the six complete months before today', () => {
    expect(calculatePace(contributionsIn(50_000, ...WINDOW), TODAY)).toEqual({
      kind: 'measured',
      pace: 50_000,
      months: WINDOW,
    })
  })

  // D-017: the month in progress is left out, however much it already holds. Counted, the
  // 900_000 here would lift the pace to (300_000 + 900_000) / 7.
  it('leaves out the month in progress', () => {
    const entries = [
      ...contributionsIn(50_000, ...WINDOW),
      entry('contribution', 900_000, '2026-10-02'),
    ]
    expect(calculatePace(entries, TODAY)).toMatchObject({ kind: 'measured', pace: 50_000 })
  })

  // Even on the last day of a month, that month is still in progress.
  it('leaves out the month in progress on its last day', () => {
    const entries = [
      ...contributionsIn(50_000, ...WINDOW),
      entry('contribution', 900_000, '2026-10-02'),
    ]
    expect(calculatePace(entries, calendarDate('2026-10-31'))).toMatchObject({
      kind: 'measured',
      pace: 50_000,
    })
  })

  it('reads no further back than six complete months', () => {
    const entries = [
      ...contributionsIn(800_000, '2026-01', '2026-02', '2026-03'),
      ...contributionsIn(50_000, ...WINDOW),
    ]
    expect(calculatePace(entries, TODAY)).toEqual({
      kind: 'measured',
      pace: 50_000,
      months: WINDOW,
    })
  })

  // FR-026: contributions minus withdrawals. 6 × 50_000 − 120_000 = 180_000, over six.
  it('subtracts withdrawals', () => {
    const entries = [
      ...contributionsIn(50_000, ...WINDOW),
      entry('withdrawal', 120_000, '2026-07-20'),
    ]
    expect(calculatePace(entries, TODAY)).toMatchObject({ kind: 'measured', pace: 30_000 })
  })

  // The opening balance was set aside before the app, and is not saving done in the window.
  // Counted, the 600_000 here would read as a pace of 110_000.
  it('does not count the opening balance as saving', () => {
    const entries = [entry('opening', 600_000, '2026-04-02'), ...contributionsIn(10_000, ...WINDOW)]
    expect(calculatePace(entries, TODAY)).toMatchObject({ kind: 'measured', pace: 10_000 })
  })

  // A month with nothing in it is a month the user saved nothing in, once the fund exists.
  it('counts a month with no activity as a month of no saving', () => {
    const entries = [
      entry('opening', 100_000, '2026-04-02'),
      entry('contribution', 60_000, '2026-09-10'),
    ]
    expect(calculatePace(entries, TODAY)).toEqual({
      kind: 'measured',
      pace: 10_000,
      months: WINDOW,
    })
  })

  // Data model, rounding policy: an amount derived by division rounds down.
  // 200_000 over three is 66_666.67, which to nearest would be 66_667.
  it('rounds the pace down to the minor unit', () => {
    const entries = [
      entry('opening', 100_000, '2026-07-01'),
      entry('contribution', 200_000, '2026-09-05'),
    ]
    expect(calculatePace(entries, TODAY)).toMatchObject({ kind: 'measured', pace: 66_666 })
  })

  // FR-030 needs the sign kept: a pace that went backwards is not a pace of zero.
  it('keeps a negative pace when more left than came in', () => {
    const entries = [
      entry('opening', 500_000, '2026-07-01'),
      entry('withdrawal', 100_000, '2026-08-10'),
    ]
    expect(calculatePace(entries, TODAY)).toMatchObject({ kind: 'measured', pace: -33_334 })
  })

  // Out of order is how a backfilled month arrives (spec edge cases).
  it('reaches the same pace whatever order the entries arrive in', () => {
    const entries = [
      ...contributionsIn(50_000, ...WINDOW),
      entry('withdrawal', 120_000, '2026-07-20'),
    ]
    expect(calculatePace(entries.toReversed(), TODAY)).toEqual(calculatePace(entries, TODAY))
  })

  describe('history shorter than the minimum (FR-029)', () => {
    // The months before the fund existed are not months the user saved nothing in. From
    // July there are three complete months, which is enough, and the pace divides by three.
    it('starts the window at the month of the first entry', () => {
      const entries = contributionsIn(30_000, '2026-07', '2026-08', '2026-09')
      expect(calculatePace(entries, TODAY)).toEqual({
        kind: 'measured',
        pace: 30_000,
        months: ['2026-07', '2026-08', '2026-09'],
      })
    })

    it('says how many complete months there are and how many more are needed', () => {
      const entries = contributionsIn(30_000, '2026-08', '2026-09')
      expect(calculatePace(entries, TODAY)).toEqual({
        kind: 'insufficient-history',
        monthsAvailable: 2,
        monthsNeeded: 1,
      })
    })

    // An opening balance alone starts the fund, so its month counts as history.
    it('counts the month of an opening balance as history', () => {
      const entries = [entry('opening', 300_000, '2026-08-20')]
      expect(calculatePace(entries, TODAY)).toEqual({
        kind: 'insufficient-history',
        monthsAvailable: 2,
        monthsNeeded: 1,
      })
    })

    // A fund begun this month has no complete month at all, however much it holds.
    it('counts no history for a fund begun this month', () => {
      const entries = [
        entry('opening', 300_000, '2026-10-01'),
        entry('contribution', 50_000, '2026-10-10'),
      ]
      expect(calculatePace(entries, TODAY)).toEqual({
        kind: 'insufficient-history',
        monthsAvailable: 0,
        monthsNeeded: 3,
      })
    })

    it('counts no history for an empty fund', () => {
      expect(calculatePace([], TODAY)).toEqual({
        kind: 'insufficient-history',
        monthsAvailable: 0,
        monthsNeeded: 3,
      })
    })

    // FR-033: an entry dated after today has not happened, and does not start the fund.
    it('does not let an entry dated after today start the history', () => {
      const entries = [entry('contribution', 50_000, '2026-11-05')]
      expect(calculatePace(entries, TODAY)).toEqual({
        kind: 'insufficient-history',
        monthsAvailable: 0,
        monthsNeeded: 3,
      })
    })
  })
})

/**
 * The pace a recovery is estimated at (FR-018): what goes in each month, over the same
 * window, with withdrawals left out — decided with the user on 2026-11-01. A withdrawal
 * does not slow down how fast the fund refills, and counted, one large one would leave no
 * estimate at all for the six months it stays in the window.
 */
describe('calculateContributionPace', () => {
  // Net, this is (300_000 − 120_000) / 6 = 30_000.
  it('averages the contributions alone, leaving withdrawals out', () => {
    const entries = [
      ...contributionsIn(50_000, ...WINDOW),
      entry('withdrawal', 120_000, '2026-07-20'),
    ]
    expect(calculateContributionPace(entries, TODAY)).toEqual({
      kind: 'measured',
      pace: 50_000,
      months: WINDOW,
    })
  })

  it('leaves the opening balance out, as the net pace does', () => {
    const entries = [entry('opening', 900_000, '2026-04-01'), ...contributionsIn(50_000, ...WINDOW)]
    expect(calculateContributionPace(entries, TODAY)).toMatchObject({ pace: 50_000 })
  })

  it('reads the same window, and leaves out the month in progress', () => {
    const entries = [
      ...contributionsIn(800_000, '2026-01', '2026-02', '2026-03'),
      ...contributionsIn(50_000, ...WINDOW),
      entry('contribution', 900_000, '2026-10-02'),
    ]
    expect(calculateContributionPace(entries, TODAY)).toEqual({
      kind: 'measured',
      pace: 50_000,
      months: WINDOW,
    })
  })

  it('needs the same history before it is stated', () => {
    expect(calculateContributionPace(contributionsIn(50_000, '2026-08', '2026-09'), TODAY)).toEqual(
      {
        kind: 'insufficient-history',
        monthsAvailable: 2,
        monthsNeeded: 1,
      },
    )
  })
})
