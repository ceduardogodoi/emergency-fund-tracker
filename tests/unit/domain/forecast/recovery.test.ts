import { calendarDate } from '@/domain/dates/calendar-date'
import { instant } from '@/domain/dates/instant'
import { calculateShortfall, estimateRecovery } from '@/domain/forecast/recovery'
import type { EntryType, LedgerEntry } from '@/domain/ledger/types'
import { money } from '@/domain/money/money'

/**
 * What a withdrawal leaves to restore, and how long restoring it takes (FR-018).
 *
 * The shortfall is the drop from the highest balance the fund has reached, capped at the
 * target — decided with the user on 2026-11-01. The estimate is the forecast's projection
 * applied to it, at the pace of contributions alone: a withdrawal does not slow down how
 * fast the fund refills.
 *
 * Today is the 15th of October, so September is the last complete month.
 */
const TODAY = calendarDate('2026-10-15')
const TARGET = money(1_200_000)

let sequence = 0

/** Builds an entry. These rules read only the type, the amount, and the date. */
function entry(type: EntryType, minorUnits: number, date: string): LedgerEntry {
  sequence += 1
  return {
    id: `entry-${sequence}`,
    type,
    amount: money(minorUnits),
    date: calendarDate(date),
    note: null,
    withdrawalReason: type === 'withdrawal' ? 'medical' : null,
    createdAt: instant('2026-10-01T10:00:00.000Z'),
    updatedAt: instant('2026-10-01T10:00:00.000Z'),
  }
}

describe('calculateShortfall', () => {
  it('is zero for a fund that has never been withdrawn from', () => {
    const entries = [
      entry('opening', 200_000, '2026-01-04'),
      entry('contribution', 50_000, '2026-02-05'),
    ]
    expect(calculateShortfall(entries, TARGET, TODAY)).toBe(0)
  })

  // Spec, Story 5 scenario 1: 8,000, then a withdrawal of 3,000.
  it('is what a withdrawal took from the highest balance reached', () => {
    const entries = [
      entry('contribution', 800_000, '2026-08-05'),
      entry('withdrawal', 300_000, '2026-09-10'),
    ]
    expect(calculateShortfall(entries, TARGET, TODAY)).toBe(300_000)
  })

  it('shrinks as contributions refill it', () => {
    const entries = [
      entry('contribution', 800_000, '2026-08-05'),
      entry('withdrawal', 300_000, '2026-09-10'),
      entry('contribution', 100_000, '2026-10-05'),
    ]
    expect(calculateShortfall(entries, TARGET, TODAY)).toBe(200_000)
  })

  // Back to the old high and past it: the new high is where the fund stands.
  it('is gone once the balance is back, and stays gone above it', () => {
    const back = [
      entry('contribution', 800_000, '2026-08-05'),
      entry('withdrawal', 300_000, '2026-09-10'),
      entry('contribution', 300_000, '2026-10-05'),
    ]
    expect(calculateShortfall(back, TARGET, TODAY)).toBe(0)
    expect(
      calculateShortfall([...back, entry('contribution', 1, '2026-10-06')], TARGET, TODAY),
    ).toBe(0)
  })

  it('adds up a run of withdrawals from the same high', () => {
    const entries = [
      entry('contribution', 800_000, '2026-07-05'),
      entry('withdrawal', 100_000, '2026-08-10'),
      entry('withdrawal', 150_000, '2026-09-10'),
    ]
    expect(calculateShortfall(entries, TARGET, TODAY)).toBe(250_000)
  })

  // FR-018 is a shortfall against the target: a surplus spent is not a debt to the fund.
  it('restores no further than the target', () => {
    const entries = [
      entry('contribution', 1_300_000, '2026-08-05'),
      entry('withdrawal', 200_000, '2026-09-10'),
    ]
    expect(calculateShortfall(entries, TARGET, TODAY)).toBe(100_000)
  })

  // Above the target, the capped high is below the balance, and the difference would be
  // negative: 1_200_000 − 1_250_000. At exactly the target it is zero either way, so that
  // case alone could not tell the floor from no floor.
  it('is zero while the balance stays at or above the target', () => {
    const above = [
      entry('contribution', 1_300_000, '2026-08-05'),
      entry('withdrawal', 50_000, '2026-09-10'),
    ]
    expect(calculateShortfall(above, TARGET, TODAY)).toBe(0)
    const at = [
      entry('contribution', 1_300_000, '2026-08-05'),
      entry('withdrawal', 100_000, '2026-09-10'),
    ]
    expect(calculateShortfall(at, TARGET, TODAY)).toBe(0)
  })

  // An overdrawn fund has the drop below zero to restore too.
  it('counts down past zero when the fund is overdrawn', () => {
    const entries = [
      entry('contribution', 100_000, '2026-08-05'),
      entry('withdrawal', 150_000, '2026-09-10'),
    ]
    expect(calculateShortfall(entries, TARGET, TODAY)).toBe(150_000)
  })

  // Measured at the end of each day, so the order entries were recorded in within a day
  // cannot raise the high: read entry by entry, the contribution first, it would reach
  // 800_000 for a moment and report 300_000 missing from a fund that ended the day whole.
  it('reads a day as a whole, whatever order its entries came in', () => {
    const entries = [
      entry('contribution', 500_000, '2026-08-05'),
      entry('contribution', 300_000, '2026-09-10'),
      entry('withdrawal', 300_000, '2026-09-10'),
    ]
    expect(calculateShortfall(entries, TARGET, TODAY)).toBe(0)
  })

  // The entries arrive in any order, as they do for the balance.
  it('does not depend on the order it is given the entries in', () => {
    const entries = [
      entry('withdrawal', 300_000, '2026-09-10'),
      entry('contribution', 800_000, '2026-08-05'),
    ]
    expect(calculateShortfall(entries, TARGET, TODAY)).toBe(300_000)
  })

  // FR-033: entries dated after today are in no calculation. Counted, the contribution
  // would raise the high to 1_000_000, and the withdrawal would lower the balance.
  it('leaves out entries dated after today', () => {
    const entries = [
      entry('contribution', 800_000, '2026-08-05'),
      entry('withdrawal', 300_000, '2026-09-10'),
      entry('contribution', 500_000, '2026-10-20'),
      entry('withdrawal', 100_000, '2026-10-21'),
    ]
    expect(calculateShortfall(entries, TARGET, TODAY)).toBe(300_000)
  })
})

describe('estimateRecovery', () => {
  it('has nothing to estimate when nothing is missing', () => {
    const entries = [entry('contribution', 800_000, '2026-08-05')]
    expect(estimateRecovery(entries, TARGET, TODAY)).toEqual({ kind: 'none' })
  })

  // Four complete months, June to September, of 100_000 each, and 250_000 withdrawn in
  // September. At the contribution pace of 100_000 that is three months from the end of
  // October: January. At the net pace, (400_000 − 250_000) / 4 = 37_500, it would be seven,
  // and over a six-month window the pace would be wrong too — so this fixture tells all
  // three apart.
  it('projects the shortfall at the pace of contributions alone', () => {
    const entries = [
      entry('contribution', 100_000, '2026-06-05'),
      entry('contribution', 100_000, '2026-07-05'),
      entry('contribution', 100_000, '2026-08-05'),
      entry('contribution', 100_000, '2026-09-05'),
      entry('withdrawal', 250_000, '2026-09-20'),
    ]
    expect(estimateRecovery(entries, TARGET, TODAY)).toEqual({
      kind: 'recovering',
      shortfall: 250_000,
      estimate: {
        kind: 'projected',
        pace: 100_000,
        paceMonths: 4,
        monthsToTarget: 3,
        projectedDate: '2027-01-31',
      },
    })
  })

  // FR-029 holds here as in the forecast: no estimate from too little history.
  it('says how much more history it needs', () => {
    const entries = [
      entry('contribution', 100_000, '2026-08-05'),
      entry('withdrawal', 50_000, '2026-09-20'),
    ]
    expect(estimateRecovery(entries, TARGET, TODAY)).toEqual({
      kind: 'recovering',
      shortfall: 50_000,
      estimate: { kind: 'insufficient-history', monthsAvailable: 2, monthsNeeded: 1 },
    })
  })

  // Saving stopped in March, and six complete months since have none: no pace, no date.
  it('says there is no pace when nothing was contributed in the window', () => {
    const entries = [
      entry('contribution', 300_000, '2026-01-05'),
      entry('contribution', 300_000, '2026-02-05'),
      entry('contribution', 300_000, '2026-03-05'),
      entry('withdrawal', 200_000, '2026-09-20'),
    ]
    expect(estimateRecovery(entries, TARGET, TODAY)).toEqual({
      kind: 'recovering',
      shortfall: 200_000,
      estimate: { kind: 'no-pace' },
    })
  })
})
