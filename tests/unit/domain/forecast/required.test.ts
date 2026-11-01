import { calendarDate } from '@/domain/dates/calendar-date'
import type { PaceResult } from '@/domain/forecast/pace'
import { desiredContribution, requiredMonthly } from '@/domain/forecast/required'
import { money, zero } from '@/domain/money/money'
import { expectErr } from '../../../support/expect-result'

/**
 * The monthly contribution a desired completion date needs (FR-031), and whether it is more
 * than the user has been saving.
 *
 * Today is the 15th of October. The months available are the whole calendar months after
 * this one up to the desired date's month — the same months a projection counts, so saving
 * the required amount from November projects onto the desired month and not after it. The
 * rest of October is left out, as it is from the pace.
 */
const TODAY = calendarDate('2026-10-15')

const SIX_MONTHS = ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']

/** A pace measured over the six complete months before today. */
function measured(minorUnits: number): PaceResult {
  return { kind: 'measured', pace: money(minorUnits), months: SIX_MONTHS }
}

describe('requiredMonthly', () => {
  // November and December.
  it('divides the remaining amount over the months up to the desired date', () => {
    expect(requiredMonthly(money(100_000), calendarDate('2026-12-31'), TODAY)).toEqual({
      ok: true,
      value: 50_000,
    })
  })

  it('counts across a year boundary', () => {
    expect(requiredMonthly(money(120_000), calendarDate('2027-10-31'), TODAY)).toEqual({
      ok: true,
      value: 10_000,
    })
  })

  // Rounding policy: an amount the user must save rounds up, or saving it falls short.
  it('rounds up, so saving the amount is enough', () => {
    expect(requiredMonthly(money(100_001), calendarDate('2026-12-31'), TODAY)).toEqual({
      ok: true,
      value: 50_001,
    })
  })

  // The month is what counts, not the day within it.
  it('reads only the month of the desired date', () => {
    expect(requiredMonthly(money(100_000), calendarDate('2026-12-01'), TODAY)).toEqual(
      requiredMonthly(money(100_000), calendarDate('2026-12-31'), TODAY),
    )
  })

  // Data model: at least one month. A date later this month leaves no whole month after
  // this one, and the remaining amount all at once is what it asks.
  it('asks for everything in one month when the date is later this month', () => {
    expect(requiredMonthly(money(100_000), calendarDate('2026-10-31'), TODAY)).toEqual({
      ok: true,
      value: 100_000,
    })
  })

  it('asks for nothing when nothing remains', () => {
    expect(requiredMonthly(zero, calendarDate('2026-12-31'), TODAY)).toEqual({
      ok: true,
      value: 0,
    })
  })

  describe('a date that is not ahead', () => {
    // Data model: the desired date must be later than today.
    it('refuses today', () => {
      expect(expectErr(requiredMonthly(money(100_000), TODAY, TODAY))).toEqual({
        kind: 'validation',
        field: 'desiredCompletionDate',
        messageKey: 'goal.desired-date-not-ahead',
      })
    })

    // A stored date passes as time does, so this is a state the screen meets, not only input.
    it('refuses a date that has passed', () => {
      expect(
        expectErr(requiredMonthly(money(100_000), calendarDate('2026-09-30'), TODAY)),
      ).toMatchObject({ field: 'desiredCompletionDate' })
    })
  })
})

describe('desiredContribution', () => {
  const DECEMBER = calendarDate('2026-12-31')

  it('says the amount exceeds a smaller pace, and quotes the pace', () => {
    expect(desiredContribution(money(100_002), DECEMBER, measured(50_000), TODAY)).toEqual({
      kind: 'required',
      amount: 50_001,
      comparison: { kind: 'exceeds', pace: 50_000 },
    })
  })

  it('says the amount is within a pace that matches it', () => {
    expect(desiredContribution(money(100_000), DECEMBER, measured(50_000), TODAY)).toEqual({
      kind: 'required',
      amount: 50_000,
      comparison: { kind: 'within', pace: 50_000 },
    })
  })

  it('says the amount is within a larger pace', () => {
    expect(desiredContribution(money(40_000), DECEMBER, measured(50_000), TODAY)).toMatchObject({
      comparison: { kind: 'within', pace: 50_000 },
    })
  })

  // At a pace of zero or below, any amount at all is more than the user is saving.
  it('says any amount exceeds a pace of zero or less', () => {
    expect(desiredContribution(money(2), DECEMBER, measured(0), TODAY)).toMatchObject({
      comparison: { kind: 'exceeds', pace: 0 },
    })
    expect(desiredContribution(money(2), DECEMBER, measured(-10_000), TODAY)).toMatchObject({
      comparison: { kind: 'exceeds', pace: -10_000 },
    })
  })

  // FR-029: with too little history there is no pace to compare with, and the amount still
  // stands on its own.
  it('has nothing to compare with before a pace is measured', () => {
    expect(
      desiredContribution(
        money(100_000),
        DECEMBER,
        { kind: 'insufficient-history', monthsAvailable: 1, monthsNeeded: 2 },
        TODAY,
      ),
    ).toEqual({ kind: 'required', amount: 50_000, comparison: { kind: 'unmeasured' } })
  })

  // A target the balance already meets asks nothing, at any pace.
  it('asks nothing when nothing remains', () => {
    expect(desiredContribution(zero, DECEMBER, measured(-10_000), TODAY)).toEqual({
      kind: 'covered',
    })
  })

  it('says a date that is not ahead has passed', () => {
    expect(desiredContribution(money(100_000), TODAY, measured(50_000), TODAY)).toEqual({
      kind: 'passed',
    })
  })
})
