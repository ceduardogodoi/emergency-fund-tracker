import { calendarDate } from '@/domain/dates/calendar-date'
import {
  createSeededRandom,
  MAXIMUM_SEED_MONTHS,
  parseSeedRequest,
  planHistory,
} from '@/features/dev/seed-history'

/**
 * The seed script's two pure halves (T087): reading the request a link carries, and
 * turning it into a history.
 *
 * Today is the 24th, so "the current month" and "the 1st of it" are distinguishable from
 * the dates the plan is allowed to use.
 */
const TODAY = calendarDate('2026-10-24')

/** A random source that hands out the given values in order, then fails loudly. */
function scripted(...values: number[]): () => number {
  const queue = [...values]
  return () => {
    const next = queue.shift()
    if (next === undefined) {
      throw new Error('The plan asked for more random values than the test scripted')
    }
    return next
  }
}

describe('parseSeedRequest', () => {
  it('reads months and a pattern', () => {
    expect(parseSeedRequest({ months: '8', pattern: 'erratic' })).toEqual({
      kind: 'seed',
      months: 8,
      pattern: 'erratic',
    })
  })

  // The quickstart's `--months 2` names no pattern.
  it('saves steadily when no pattern is named', () => {
    expect(parseSeedRequest({ months: '2' })).toEqual({
      kind: 'seed',
      months: 2,
      pattern: 'steady',
    })
  })

  it('reads a reset on its own', () => {
    expect(parseSeedRequest({ reset: '1' })).toEqual({ kind: 'reset' })
  })

  // A seed starts from an erased store anyway, so a reset beside months adds nothing.
  it('seeds when months come with a reset', () => {
    expect(parseSeedRequest({ months: '3', reset: '1' })).toEqual({
      kind: 'seed',
      months: 3,
      pattern: 'steady',
    })
  })

  it('takes the first of a repeated parameter, as a router hands it over', () => {
    expect(parseSeedRequest({ months: ['4', '9'] })).toEqual({
      kind: 'seed',
      months: 4,
      pattern: 'steady',
    })
  })

  it('asks for months when there are none and no reset', () => {
    expect(parseSeedRequest({ pattern: 'steady' })).toEqual({
      kind: 'invalid',
      problem: 'months-missing',
    })
  })

  it.each(['0', String(MAXIMUM_SEED_MONTHS + 1), 'eight', '2.5', '-3', ''])(
    'refuses %p months',
    (months) => {
      expect(parseSeedRequest({ months })).toEqual({
        kind: 'invalid',
        problem: 'months-out-of-range',
      })
    },
  )

  // Ten years is what SC-012's performance check seeds (T150).
  it('accepts ten years', () => {
    expect(parseSeedRequest({ months: '120' })).toMatchObject({ kind: 'seed', months: 120 })
    expect(MAXIMUM_SEED_MONTHS).toBe(120)
  })

  it('refuses a pattern it does not know', () => {
    expect(parseSeedRequest({ months: '8', pattern: 'stedy' })).toEqual({
      kind: 'invalid',
      problem: 'pattern-unknown',
    })
  })
})

describe('planHistory', () => {
  // Complete months only, the current one left out — the months the forecast reads
  // (D-017), so `--months 2` lands below its threshold as the quickstart says it should.
  it('saves R$ 500,00 on the 5th of each complete month before today, oldest first', () => {
    expect(planHistory(3, 'steady', TODAY, scripted())).toEqual([
      expect.objectContaining({ type: 'contribution', amount: 50_000, date: '2026-07-05' }),
      expect.objectContaining({ type: 'contribution', amount: 50_000, date: '2026-08-05' }),
      expect.objectContaining({ type: 'contribution', amount: 50_000, date: '2026-09-05' }),
    ])
  })

  it('crosses a year boundary', () => {
    const dates = planHistory(12, 'steady', calendarDate('2026-03-10'), scripted()).map(
      (entry) => entry.date,
    )

    expect(dates[0]).toBe('2025-03-05')
    expect(dates.at(-1)).toBe('2026-02-05')
    expect(dates).toHaveLength(12)
  })

  it('writes plain contributions, with nothing to read beside them', () => {
    for (const entry of planHistory(2, 'steady', TODAY, scripted())) {
      expect(entry).toMatchObject({ note: null, withdrawalReason: null })
    }
  })

  // Each month draws three values: whether it is missed, the day, the amount. The first
  // month never draws the first, so the history starts where it was asked to.
  it('varies the day and the amount, and misses a month now and then', () => {
    const plan = planHistory(
      3,
      'erratic',
      TODAY,
      scripted(
        // July: never missed. Day 1, R$ 100,00 — the low ends.
        0,
        0,
        // August: missed, so it draws nothing else.
        0.1,
        // September: kept. Day 28, R$ 1.200,00 — the high ends.
        0.25,
        0.999_999,
        0.999_999,
      ),
    )

    expect(plan).toEqual([
      expect.objectContaining({ amount: 10_000, date: '2026-07-01' }),
      expect.objectContaining({ amount: 120_000, date: '2026-09-28' }),
    ])
  })

  it('writes whole reais in steps of R$ 10,00', () => {
    const [entry] = planHistory(1, 'erratic', TODAY, scripted(0.5, 0.5))

    expect(entry?.amount).toBe(65_000)
  })
})

describe('createSeededRandom', () => {
  // The same command has to produce the same history, or "check it by hand" means
  // nothing the second time it is run.
  it('repeats its sequence for the same seed, and differs for another', () => {
    const first = createSeededRandom(7)
    const again = createSeededRandom(7)
    const other = createSeededRandom(8)
    const draws = Array.from({ length: 50 }, () => [first(), again(), other()])

    expect(draws.every(([one, two]) => one === two)).toBe(true)
    expect(draws.some(([one, , three]) => one !== three)).toBe(true)
  })

  it('stays within [0, 1)', () => {
    const random = createSeededRandom(2026)
    for (let index = 0; index < 10_000; index += 1) {
      const value = random()
      expect(value >= 0 && value < 1).toBe(true)
    }
  })
})
