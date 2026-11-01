import { monthKey, monthKeysBetween, nextMonth, type CalendarDate } from '../dates/calendar-date'
import type { ValidationError } from '../errors/app-error'
import { validateDesiredCompletionDate } from '../goal/validation'
import { isPositive, type Money } from '../money/money'
import { divideToRequiredAmount } from '../money/rounding'
import { isErr, ok, type Result } from '../result'
import type { PaceResult } from './pace'

/** How a required contribution stands against the pace the user has kept (FR-031). */
export type PaceComparison =
  | {
      /** More than the user has been saving each month. */
      readonly kind: 'exceeds'
      /** The pace it exceeds, per month. May be zero or negative. */
      readonly pace: Money
    }
  | {
      /** No more than the user has been saving. */
      readonly kind: 'within'
      /** The pace it is within, per month. */
      readonly pace: Money
    }
  | {
      /** Too little history to say — there is no pace yet (FR-029). */
      readonly kind: 'unmeasured'
    }

/** What a desired completion date asks of the user (FR-031). */
export type DesiredContribution =
  | {
      /** The date is today or earlier. A stored date passes as time does. */
      readonly kind: 'passed'
    }
  | {
      /** Nothing remains to be saved, so the date asks for nothing. */
      readonly kind: 'covered'
    }
  | {
      readonly kind: 'required'
      /** Per month, from next month to the desired one, rounded up. Above zero. */
      readonly amount: Money
      /** How that stands against the pace. */
      readonly comparison: PaceComparison
    }

/**
 * The monthly contribution that reaches the target by a desired date (FR-031).
 *
 * The months available are the whole calendar months after this one, up to and including
 * the desired date's month. The rest of this month is left out, as it is from the pace and
 * from a projection: saving the required amount every month from the next one projects
 * onto the desired month, never after it. At least one month, so a date later this month
 * asks for everything that remains at once rather than dividing by zero.
 *
 * Rounded up, so saving it is enough.
 *
 * @param remaining What is still to be saved, never negative.
 * @param desired The date the user wants to have reached the target by.
 * @param today From the `Clock` port.
 * @returns The amount per month — zero when nothing remains — or a validation failure on
 *   `desiredCompletionDate` when the date is not after today. A stored date passes as time
 *   does, so that is a state a screen meets, not only a typing error.
 */
export function requiredMonthly(
  remaining: Money,
  desired: CalendarDate,
  today: CalendarDate,
): Result<Money, ValidationError> {
  const checked = validateDesiredCompletionDate(desired, today)
  if (isErr(checked)) {
    return checked
  }
  const months = monthKeysBetween(nextMonth(monthKey(today)), monthKey(desired)).length
  return ok(divideToRequiredAmount(remaining, Math.max(1, months)))
}

/**
 * What a desired completion date asks of the user, and how it compares with what they have
 * been saving (FR-031) — everything a screen states about the date, decided here.
 *
 * The amount compared is always above zero — a target already met is `covered` before any
 * comparison — so against a pace of zero or below it always exceeds.
 *
 * @param remaining What is still to be saved, never negative.
 * @param desired The date the user wants to have reached the target by.
 * @param pace From `calculatePace`.
 * @param today From the `Clock` port.
 * @returns What the date asks, or that it has passed.
 */
export function desiredContribution(
  remaining: Money,
  desired: CalendarDate,
  pace: PaceResult,
  today: CalendarDate,
): DesiredContribution {
  const required = requiredMonthly(remaining, desired, today)
  if (isErr(required)) {
    return { kind: 'passed' }
  }
  const amount = required.value
  if (!isPositive(amount)) {
    return { kind: 'covered' }
  }
  return { kind: 'required', amount, comparison: compareWithPace(amount, pace) }
}

/** How an amount to save each month stands against the pace. */
function compareWithPace(amount: Money, pace: PaceResult): PaceComparison {
  if (pace.kind === 'insufficient-history') {
    return { kind: 'unmeasured' }
  }
  return {
    kind: amount > pace.pace ? 'exceeds' : 'within',
    pace: pace.pace,
  }
}
