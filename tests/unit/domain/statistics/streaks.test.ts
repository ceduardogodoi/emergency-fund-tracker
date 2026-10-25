import { calendarDate, monthKeysBetween } from '@/domain/dates/calendar-date'
import { instant } from '@/domain/dates/instant'
import type { EntryType, LedgerEntry } from '@/domain/ledger/types'
import { money } from '@/domain/money/money'
import { currentStreak, longestStreak } from '@/domain/statistics/streaks'

/**
 * Streaks (FR-021): runs of consecutive calendar months holding at least one contribution.
 *
 * Each function is given the period's months as well as the entries, because the streaks
 * follow the period filter like every other figure on the view (FR-023). Most cases here
 * use all of history; the last block narrows it.
 *
 * Today is the 15th of October, so October is the month in progress.
 */
const TODAY = calendarDate('2026-10-15')

let sequence = 0

/** Builds an entry. Only the type and the date matter to a streak. */
function entry(type: EntryType, date: string): LedgerEntry {
  sequence += 1
  return {
    id: `entry-${sequence}`,
    type,
    amount: money(10_000),
    date: calendarDate(date),
    note: null,
    withdrawalReason: type === 'withdrawal' ? 'Emergência' : null,
    createdAt: instant('2026-10-01T10:00:00.000Z'),
    updatedAt: instant('2026-10-01T10:00:00.000Z'),
  }
}

/** One contribution on the 5th of each named month, `YYYY-MM`. */
function contributionsIn(...months: string[]): LedgerEntry[] {
  return months.map((month) => entry('contribution', `${month}-05`))
}

/** Every month from January to the current one — all of this year's history. */
const THIS_YEAR = monthKeysBetween('2026-01', '2026-10')

describe('currentStreak', () => {
  // The spec's own scenario: three in a row, none before them.
  it('counts consecutive months with a contribution', () => {
    const entries = contributionsIn('2026-07', '2026-08', '2026-09')

    expect(currentStreak(entries, THIS_YEAR, TODAY)).toBe(3)
  })

  // The rule this function exists for. On the 15th, a user who saves at the end of the
  // month has not saved yet this month — and has not broken anything.
  it('is not broken by a current month with no contribution yet', () => {
    const entries = contributionsIn('2026-08', '2026-09')

    expect(currentStreak(entries, THIS_YEAR, TODAY)).toBe(2)
  })

  it('counts the current month once it has a contribution', () => {
    const entries = contributionsIn('2026-08', '2026-09', '2026-10')

    expect(currentStreak(entries, THIS_YEAR, TODAY)).toBe(3)
  })

  // A complete month with nothing in it is a break. September is over.
  it('is zero when the last complete month has no contribution', () => {
    const entries = contributionsIn('2026-06', '2026-07', '2026-08')

    expect(currentStreak(entries, THIS_YEAR, TODAY)).toBe(0)
  })

  it('stops at the first month without a contribution', () => {
    const entries = contributionsIn(
      '2026-03',
      '2026-04',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
    )

    expect(currentStreak(entries, THIS_YEAR, TODAY)).toBe(4)
  })

  // Neither moves money in: an opening is where the fund started, a withdrawal takes from
  // it. Only a contribution makes a month active.
  it('is not kept alive by an opening balance or a withdrawal', () => {
    const entries = [
      ...contributionsIn('2026-07', '2026-08'),
      entry('opening', '2026-09-01'),
      entry('withdrawal', '2026-09-10'),
    ]

    expect(currentStreak(entries, THIS_YEAR, TODAY)).toBe(0)
  })

  // Spec edge case: many small amounts in a single day are each recorded, and the period
  // still counts once.
  it('counts a month with many contributions once', () => {
    const entries = [
      ...contributionsIn('2026-08'),
      entry('contribution', '2026-09-01'),
      entry('contribution', '2026-09-01'),
      entry('contribution', '2026-09-30'),
    ]

    expect(currentStreak(entries, THIS_YEAR, TODAY)).toBe(2)
  })

  // FR-033. Dated the 20th of this month, it has not happened, so October is still a month
  // with nothing in it — and September, empty and complete, ends the streak.
  it('ignores a contribution dated after today', () => {
    const entries = [...contributionsIn('2026-07', '2026-08'), entry('contribution', '2026-10-20')]

    expect(currentStreak(entries, THIS_YEAR, TODAY)).toBe(0)
  })

  // A backfilled month joins the streak where its date puts it, whatever order it was
  // typed in (spec edge case on out-of-order entries).
  it('does not depend on the order entries arrive in', () => {
    const entries = contributionsIn('2026-09', '2026-07', '2026-08')

    expect(currentStreak(entries, THIS_YEAR, TODAY)).toBe(3)
  })

  it('is zero with no history', () => {
    expect(currentStreak([], [], TODAY)).toBe(0)
  })
})

describe('longestStreak', () => {
  // The longest run anywhere, which need not be the current one.
  it('finds the longest run, wherever it is', () => {
    const entries = contributionsIn(
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-07',
      '2026-08',
      '2026-09',
    )

    expect(longestStreak(entries, THIS_YEAR, TODAY)).toBe(4)
    expect(currentStreak(entries, THIS_YEAR, TODAY)).toBe(3)
  })

  // The scenario's other half: three in a row is a longest streak of at least three.
  it('includes the current run', () => {
    const entries = contributionsIn('2026-02', '2026-07', '2026-08', '2026-09', '2026-10')

    expect(longestStreak(entries, THIS_YEAR, TODAY)).toBe(4)
  })

  it('crosses a year boundary', () => {
    const entries = contributionsIn('2025-11', '2025-12', '2026-01')

    expect(longestStreak(entries, monthKeysBetween('2025-11', '2026-10'), TODAY)).toBe(3)
  })

  it('is not lengthened by an opening balance, a withdrawal, or a future date', () => {
    const entries = [
      ...contributionsIn('2026-04', '2026-05'),
      entry('opening', '2026-06-01'),
      entry('withdrawal', '2026-07-01'),
      entry('contribution', '2026-10-30'),
    ]

    expect(longestStreak(entries, THIS_YEAR, TODAY)).toBe(2)
  })

  it('is zero with no contribution', () => {
    expect(longestStreak([entry('opening', '2026-05-01')], THIS_YEAR, TODAY)).toBe(0)
  })
})

describe('within a period', () => {
  /** Four in a row early in the year, then three ending in September. */
  const entries = contributionsIn(
    '2026-01',
    '2026-02',
    '2026-03',
    '2026-04',
    '2026-07',
    '2026-08',
    '2026-09',
  )
  /** The last three complete months, as "last 3 months" defines them. */
  const lastThree = monthKeysBetween('2026-07', '2026-09')

  // The streaks follow the filter like every other figure (FR-023): the run of four in the
  // spring is outside the last three months, so it is not this period's longest.
  it('measures the longest streak inside the period only', () => {
    expect(longestStreak(entries, lastThree, TODAY)).toBe(3)
  })

  it('counts the current streak back from the end of the period', () => {
    expect(currentStreak(entries, lastThree, TODAY)).toBe(3)
  })

  // A recent period is complete months only, so its last month is over: nothing in it is
  // a break, not a month still in progress.
  it('treats an empty last month of a recent period as a break', () => {
    const throughAugust = contributionsIn('2026-07', '2026-08')

    expect(currentStreak(throughAugust, lastThree, TODAY)).toBe(0)
  })

  // A run that began before the period is cut at its start rather than counted whole.
  it('does not count months before the period', () => {
    expect(currentStreak(entries, monthKeysBetween('2026-08', '2026-09'), TODAY)).toBe(2)
  })
})
