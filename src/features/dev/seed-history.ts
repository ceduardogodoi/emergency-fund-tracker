import {
  calendarDate,
  completeMonthKeysBefore,
  type CalendarDate,
} from '@/domain/dates/calendar-date'
import type { LedgerEntryInput } from '@/domain/ledger/types'
import { money, type Money } from '@/domain/money/money'

/**
 * Synthetic histories for development (T087), so a screen can be checked against months
 * of saving without months of tapping. Never shipped to a user: the only way in is a
 * development-only route, and the data is invented — real financial data never enters the
 * repository or a fixture (constitution, Quality Standards).
 */

/** How a seeded saver behaves. */
export type SeedPattern = 'steady' | 'erratic'

/** Ten years, which is what SC-012's performance check needs (T150). */
export const MAXIMUM_SEED_MONTHS = 120

/** What a seed link asks for. */
export type SeedRequest =
  | { readonly kind: 'reset' }
  | { readonly kind: 'seed'; readonly months: number; readonly pattern: SeedPattern }

/** Why a seed link could not be read. */
export type SeedProblem = 'months-missing' | 'months-out-of-range' | 'pattern-unknown'

/** The parameters a link carries, as the router hands them over. */
export type SeedParams = Readonly<Record<string, string | readonly string[] | undefined>>

/**
 * Reads a seed link's parameters.
 *
 * Months make it a seed, with the pattern defaulting to steady; a reset alone empties the
 * store. A seed starts from an empty store too, so a reset beside months changes nothing.
 *
 * @param params `months` (1 to {@link MAXIMUM_SEED_MONTHS}), `pattern`, `reset`.
 * @returns The request, or the problem with it.
 */
export function parseSeedRequest(
  params: SeedParams,
): SeedRequest | { readonly kind: 'invalid'; readonly problem: SeedProblem } {
  const months = first(params['months'])
  if (months === undefined) {
    return first(params['reset']) === undefined
      ? { kind: 'invalid', problem: 'months-missing' }
      : { kind: 'reset' }
  }

  const count = /^\d+$/.test(months) ? Number(months) : Number.NaN
  if (!(count >= 1 && count <= MAXIMUM_SEED_MONTHS)) {
    return { kind: 'invalid', problem: 'months-out-of-range' }
  }

  const pattern = first(params['pattern']) ?? 'steady'
  if (pattern !== 'steady' && pattern !== 'erratic') {
    return { kind: 'invalid', problem: 'pattern-unknown' }
  }
  return { kind: 'seed', months: count, pattern }
}

/** The steady saver's monthly contribution, R$ 500,00. */
const STEADY_AMOUNT = money(50_000)
/** The steady saver's day — payday, near the start of the month. */
const STEADY_DAY = 5
/** How often the erratic saver misses a month. */
const MISSED_MONTH_CHANCE = 0.25
/** The erratic saver's smallest contribution, R$ 100,00, and its step, R$ 10,00. */
const ERRATIC_MINIMUM = 10_000
const ERRATIC_STEP = 1_000
/** How many steps above the smallest the largest is: R$ 1.200,00. */
const ERRATIC_STEPS = 110
/** The last day every month has, so a drawn day always exists. */
const LAST_COMMON_DAY = 28

/**
 * A history of contributions over the complete months before today, oldest first.
 *
 * Complete months only, the current one left out: they are the months the forecast reads
 * (research D-017), so `--months 2` lands below its threshold the way the quickstart says,
 * and every date is in the past, where the rules allow it.
 *
 * Steady saves R$ 500,00 on the 5th of every month. Erratic saves between R$ 100,00 and
 * R$ 1.200,00, in whole steps of R$ 10,00 so a hand calculation stays readable, on any day,
 * and misses about one month in four — never the first, so the history starts where it
 * was asked to.
 *
 * @param months How many complete months to cover.
 * @param pattern How the saver behaves.
 * @param today The current date, from the `Clock` port.
 * @param random Values in [0, 1). Pass {@link createSeededRandom} for a history that is the
 *   same every time it is generated.
 * @returns The entries to record, in the order to record them.
 */
export function planHistory(
  months: number,
  pattern: SeedPattern,
  today: CalendarDate,
  random: () => number,
): readonly LedgerEntryInput[] {
  const keys = completeMonthKeysBefore(today, months)
  if (pattern === 'steady') {
    return keys.map((key) => contribution(calendarDate(`${key}-${pad(STEADY_DAY)}`), STEADY_AMOUNT))
  }

  return keys.flatMap((key, index) => {
    if (index > 0 && random() < MISSED_MONTH_CHANCE) {
      return []
    }
    const day = 1 + Math.floor(random() * LAST_COMMON_DAY)
    const steps = Math.floor(random() * (ERRATIC_STEPS + 1))
    return [
      contribution(
        calendarDate(`${key}-${pad(day)}`),
        money(ERRATIC_MINIMUM + steps * ERRATIC_STEP),
      ),
    ]
  })
}

/**
 * A small, fast pseudo-random source with a fixed starting point (mulberry32).
 *
 * Seeded rather than `Math.random`, so the same command produces the same history and a
 * figure checked by hand once can be checked again.
 *
 * @param seed Any integer.
 * @returns A function returning values in [0, 1).
 */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d_2b_79_f5) >>> 0
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state)
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296
  }
}

function contribution(date: CalendarDate, amount: Money): LedgerEntryInput {
  return { type: 'contribution', amount, date, note: null, withdrawalReason: null }
}

function first(value: string | readonly string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : value?.[0]
}

function pad(day: number): string {
  return String(day).padStart(2, '0')
}
