import { calendarDate } from '@/domain/dates/calendar-date'
import { instant } from '@/domain/dates/instant'
import type { EntryType, LedgerEntry } from '@/domain/ledger/types'
import { money, zero } from '@/domain/money/money'
import { periodMonths, type Period } from '@/domain/statistics/period'
import { summarize, type SavingStatistics } from '@/domain/statistics/summary'

/**
 * The statistics view's figures (FR-020, FR-023), checked against a hand calculation of one
 * small fund.
 *
 * Today is the 15th of October, so October is in progress. A recent period is made of
 * complete months only, the way the forecast's pace window is: "last 3 months" is July,
 * August, and September, and October appears under all time alone.
 *
 * The fund, month by month:
 *
 *   May  opening 3 000,00
 *   Jun  contributions 500,00 and 200,00
 *   Jul  nothing
 *   Aug  contribution 700,00, withdrawal 150,00
 *   Sep  contribution 400,00
 *   Oct  contribution 100,00 on the 2nd, and 990,00 dated the 20th — after today
 */
const TODAY = calendarDate('2026-10-15')

const LAST_3: Period = { kind: 'recent', months: 3 }
const LAST_6: Period = { kind: 'recent', months: 6 }
const LAST_12: Period = { kind: 'recent', months: 12 }
const ALL_TIME: Period = { kind: 'all-time' }

let sequence = 0

/** Builds an entry. Only the fields the statistics read are worth naming at a call site. */
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

/** The fund described above, in the order it happened. */
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

describe('periodMonths', () => {
  // The user's choice: a recent period is complete months, so a figure under "last 3
  // months" never moves as the current month fills.
  it('makes a recent period of the complete months before today', () => {
    expect(periodMonths(fund(), LAST_3, TODAY)).toEqual(['2026-07', '2026-08', '2026-09'])
  })

  // All time is the only period that shows the month in progress.
  it('runs all time from the month of the first entry to the current month', () => {
    expect(periodMonths(fund(), ALL_TIME, TODAY)).toEqual([
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
    ])
  })

  // Months before the fund existed are not months the user saved nothing in. Counting them
  // would show empty bars for a time the app was not installed and divide the average by
  // them, which understates it.
  it('starts a recent period no earlier than the first entry', () => {
    expect(periodMonths(fund(), LAST_6, TODAY)).toEqual([
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
    ])
  })

  // FR-033. An entry dated after today has not happened, so a fund holding nothing else
  // has no history yet — not a window that starts next month.
  it('has no months for a fund whose only entry is dated after today', () => {
    const entries = [entry('contribution', 10_000, '2026-11-01')]

    expect(periodMonths(entries, ALL_TIME, TODAY)).toEqual([])
    expect(periodMonths(entries, LAST_3, TODAY)).toEqual([])
  })

  it('has no months for a fund with no entries', () => {
    expect(periodMonths([], ALL_TIME, TODAY)).toEqual([])
    expect(periodMonths([], LAST_3, TODAY)).toEqual([])
  })

  // History that began this month has no complete month yet.
  it('has no months in a recent period while history is younger than a month', () => {
    expect(periodMonths([entry('contribution', 10_000, '2026-10-01')], LAST_3, TODAY)).toEqual([])
  })
})

describe('summarize', () => {
  describe('over all time', () => {
    const statistics = (): SavingStatistics => summarize(fund(), ALL_TIME, TODAY)

    // The opening is money already set aside, not a contribution — counting it would make
    // a user who started with 3 000,00 look like a prolific saver on day one.
    it('totals contributions without the opening balance', () => {
      expect(statistics().totalContributed).toBe(money(190_000))
    })

    it('counts contributions without the opening balance', () => {
      expect(statistics().contributionCount).toBe(5)
    })

    it('totals withdrawals', () => {
      expect(statistics().totalWithdrawn).toBe(money(15_000))
    })

    it('nets contributions against withdrawals', () => {
      expect(statistics().netSaved).toBe(money(175_000))
    })

    it('finds the largest single contribution', () => {
      expect(statistics().largestContribution).toBe(money(70_000))
    })

    // Five complete months, May to September, holding 1 800,00 between them. October's
    // 100,00 is in the total above but not here: a month half over would drag the average
    // down today and push it up on the 31st, for no change in how the user saves.
    it('averages contributions over the complete months only', () => {
      expect(statistics().completeMonths).toBe(5)
      expect(statistics().averageMonthlyContribution).toBe(money(36_000))
    })

    it('reports the months it covers', () => {
      expect(statistics().months).toEqual([
        '2026-05',
        '2026-06',
        '2026-07',
        '2026-08',
        '2026-09',
        '2026-10',
      ])
    })

    // FR-033: 990,00 dated the 20th has not happened yet, and every figure above leaves it
    // out. Asserted on its own so a regression names the rule it broke.
    it('leaves out the entry dated after today', () => {
      const withoutIt = summarize(fund().slice(0, -1), ALL_TIME, TODAY)

      expect(statistics()).toEqual(withoutIt)
    })
  })

  describe('over the last 3 months', () => {
    const statistics = (): SavingStatistics => summarize(fund(), LAST_3, TODAY)

    // July, August, and September. June's two and October's one are outside it.
    it('counts only what falls inside the period', () => {
      expect(statistics()).toMatchObject({
        totalContributed: money(110_000),
        totalWithdrawn: money(15_000),
        netSaved: money(95_000),
        contributionCount: 2,
        largestContribution: money(70_000),
      })
    })

    // 1 100,00 over three months is 366,666… — rounded down, so the app never says the
    // user saves more than they do (data-model, rounding policy).
    it('rounds the average down to the minor unit', () => {
      expect(statistics().completeMonths).toBe(3)
      expect(statistics().averageMonthlyContribution).toBe(money(36_666))
    })

    // July is in the period with nothing in it, and it counts: a month the user saved
    // nothing is part of how much they save in a month.
    it('divides by the empty month too', () => {
      expect(statistics().months).toContain('2026-07')
    })
  })

  // Twelve months asked for, five available: the period is clipped to where history
  // starts, so the average divides by five rather than twelve.
  it('averages a long period over the months the fund has existed', () => {
    expect(summarize(fund(), LAST_12, TODAY)).toMatchObject({
      completeMonths: 5,
      averageMonthlyContribution: money(36_000),
    })
  })

  // A period with no complete month has no average to give. Null rather than zero, which
  // would read as "you save nothing" — the screen says instead when one will appear.
  it('has no average while there is no complete month', () => {
    const statistics = summarize([entry('contribution', 10_000, '2026-10-01')], ALL_TIME, TODAY)

    expect(statistics.completeMonths).toBe(0)
    expect(statistics.averageMonthlyContribution).toBeNull()
  })

  // Null, not zero: "your largest contribution was R$ 0,00" is a sentence about nothing.
  it('has no largest contribution when the period holds none', () => {
    const statistics = summarize(
      [entry('opening', 300_000, '2026-05-10'), entry('withdrawal', 15_000, '2026-08-12')],
      ALL_TIME,
      TODAY,
    )

    expect(statistics.largestContribution).toBeNull()
    expect(statistics.contributionCount).toBe(0)
    expect(statistics.netSaved).toBe(money(-15_000))
  })

  it('reports nothing at all for a fund with no entries', () => {
    expect(summarize([], ALL_TIME, TODAY)).toEqual({
      period: ALL_TIME,
      months: [],
      totalContributed: zero,
      totalWithdrawn: zero,
      netSaved: zero,
      contributionCount: 0,
      largestContribution: null,
      averageMonthlyContribution: null,
      completeMonths: 0,
      currentStreak: 0,
      longestStreak: 0,
      breakdown: [],
    })
  })

  // A backfilled month must land where its date says, not where it was typed (spec edge
  // case on out-of-order entries).
  it('does not depend on the order entries arrive in', () => {
    expect(summarize(fund().toReversed(), LAST_3, TODAY)).toEqual(summarize(fund(), LAST_3, TODAY))
  })

  // The streaks and the breakdown are part of the same view and follow the same filter
  // (FR-023). Their own rules are tested beside them; this pins that they are wired in.
  it('carries the period, its streaks, and its breakdown', () => {
    const statistics = summarize(fund(), LAST_3, TODAY)

    expect(statistics.period).toEqual(LAST_3)
    expect(statistics.currentStreak).toBe(2)
    expect(statistics.longestStreak).toBe(2)
    expect(statistics.breakdown.map((month) => month.month)).toEqual([
      '2026-07',
      '2026-08',
      '2026-09',
    ])
  })
})
