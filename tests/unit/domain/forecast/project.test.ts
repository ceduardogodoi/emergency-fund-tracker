import { calendarDate } from '@/domain/dates/calendar-date'
import type { PaceResult } from '@/domain/forecast/pace'
import { project } from '@/domain/forecast/project'
import { money, zero } from '@/domain/money/money'

/**
 * The projection (FR-027 – FR-030): the remaining amount over the pace, as a date and as a
 * number of months, or the reason there is none.
 *
 * Today is the 15th of October. A projection of N months resolves to the last day of the
 * month N after this one — reaching a target "in N months" means by the end of that month.
 */
const TODAY = calendarDate('2026-10-15')

const SIX_MONTHS = ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']

/** A pace measured over the six complete months before today. */
function measured(minorUnits: number): PaceResult {
  return { kind: 'measured', pace: money(minorUnits), months: SIX_MONTHS }
}

const TOO_SHORT: PaceResult = { kind: 'insufficient-history', monthsAvailable: 1, monthsNeeded: 2 }

describe('project', () => {
  // Spec, Story 4 scenario 1: 5 000 remaining at 500 a month is 10 months away.
  it('projects the months to the target and the date they end on', () => {
    expect(project(money(500_000), measured(50_000), TODAY)).toEqual({
      kind: 'projected',
      pace: 50_000,
      paceMonths: 6,
      monthsToTarget: 10,
      projectedDate: '2027-08-31',
    })
  })

  // FR-028 names the window the pace was measured over. Three months here, so the count is
  // read from the pace rather than assumed to be the six the window can reach.
  it('carries how many months the pace was measured over', () => {
    const shortPace: PaceResult = {
      kind: 'measured',
      pace: money(50_000),
      months: ['2026-07', '2026-08', '2026-09'],
    }
    expect(project(money(500_000), shortPace, TODAY)).toMatchObject({ paceMonths: 3 })
  })

  // Rounding policy: months still to save round up, so the date is never early.
  it('rounds a partial month up to a whole one', () => {
    expect(project(money(500_001), measured(50_000), TODAY)).toMatchObject({
      monthsToTarget: 11,
      projectedDate: '2027-09-30',
    })
  })

  it('lands on the last day of a short month', () => {
    expect(project(money(200_000), measured(50_000), TODAY)).toMatchObject({
      monthsToTarget: 4,
      projectedDate: '2027-02-28',
    })
  })

  it('projects next month for less than a month of saving', () => {
    expect(project(money(1_000), measured(50_000), TODAY)).toMatchObject({
      monthsToTarget: 1,
      projectedDate: '2026-11-30',
    })
  })

  // Spec, Story 4 scenario 6: a larger target moves the date later.
  it('moves the date later when more remains', () => {
    expect(project(money(800_000), measured(50_000), TODAY)).toMatchObject({
      monthsToTarget: 16,
      projectedDate: '2028-02-29',
    })
  })

  describe('when no date can be projected', () => {
    // FR-029: passed through, so the screen can say how much more history it needs.
    it('reports history too short to measure a pace', () => {
      expect(project(money(500_000), TOO_SHORT, TODAY)).toEqual({
        kind: 'insufficient-history',
        monthsAvailable: 1,
        monthsNeeded: 2,
      })
    })

    // FR-030: never an infinite, blank, or past date.
    it('reports a pace of zero', () => {
      expect(project(money(500_000), measured(0), TODAY)).toEqual({ kind: 'no-pace' })
    })

    it('reports a pace below zero the same way', () => {
      expect(project(money(500_000), measured(-10_000), TODAY)).toEqual({ kind: 'no-pace' })
    })
  })

  describe('a fund that has reached its target', () => {
    it('needs no projection', () => {
      expect(project(zero, measured(50_000), TODAY)).toEqual({ kind: 'reached' })
    })

    // A fund that opened at its target has nothing to forecast, and telling that user to
    // wait for three months of history would be telling them something untrue.
    it('is reached even before there is history enough for a pace', () => {
      expect(project(zero, TOO_SHORT, TODAY)).toEqual({ kind: 'reached' })
    })

    it('is reached whatever the pace', () => {
      expect(project(zero, measured(-10_000), TODAY)).toEqual({ kind: 'reached' })
    })
  })
})
