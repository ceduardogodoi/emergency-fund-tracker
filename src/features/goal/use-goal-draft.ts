import { useState } from 'react'

import type { ValidationError } from '@/domain/errors'
import { COVERAGE_MONTHS } from '@/domain/goal/levels'
import { calculateTarget } from '@/domain/goal/target'
import type { GoalInput, LevelKey } from '@/domain/goal/types'
import { validateCoverageMonths, validateTarget } from '@/domain/goal/validation'
import type { Money } from '@/domain/money/money'
import { isErr, ok, type Result } from '@/domain/result'
import { validationMessage } from '@/ui/strings'
import { useSubmitGoal } from './hooks'

/** The level offered first: the most common starting point rather than the smallest fund. */
export const DEFAULT_LEVEL = 'balanced'

/** The goal being composed, and everything a screen needs to render or change it. */
export interface GoalDraftState {
  /** The level currently chosen, `custom` included. */
  readonly levelKey: LevelKey
  /** The duration being typed, as text — an empty field is not a number. */
  readonly customMonths: string
  /** The duration behind the current choice. */
  readonly coverageMonths: number
  /** The user's own target, or null while the calculated one is in force (FR-005). */
  readonly override: Money | null
  /** The target as it stands, or null while the duration is not a usable number. */
  readonly target: Money | null
  /** The message under the duration field, when that is what was refused. */
  readonly coverageError: string | undefined
  /** The message under the target field, when that is what was refused. */
  readonly targetError: string | undefined
  /** Whether the submission is in flight, for the save control's own pending state. */
  readonly isSaving: boolean
  /** Whether the last submission failed in storage, as opposed to in validation. */
  readonly hasFailed: boolean
  readonly selectLevel: (key: LevelKey) => void
  readonly changeCustomMonths: (value: string) => void
  readonly changeOverride: (value: Money | null) => void
  /** Validates and submits. Does nothing when a figure is refused, beyond saying so. */
  readonly save: () => void
}

/**
 * The state behind sizing a goal: a level, a duration, and an optional override.
 *
 * A hook rather than state in the screen, because the same three decisions are made twice
 * — during setup, and again on the revision screen (FR-006) — and the second one has to
 * arrive at the same target from the same inputs. Two copies of this arithmetic is two
 * chances for the app to disagree with itself about what a user's fund should hold.
 *
 * The target follows every change immediately (FR-006), so the user chooses by watching
 * the figure rather than by imagining it.
 *
 * @param monthlyExpenses The figure the target is derived from.
 * @param onSaved Called once the write has landed — where the screen navigates.
 * @returns The draft, its messages, and the operations that change it.
 */
export function useGoalDraft(monthlyExpenses: Money, onSaved: () => void): GoalDraftState {
  const submit = useSubmitGoal()
  const [levelKey, setLevelKey] = useState<LevelKey>(DEFAULT_LEVEL)
  const [customMonths, setCustomMonths] = useState(String(COVERAGE_MONTHS[DEFAULT_LEVEL]))
  const [override, setOverride] = useState<Money | null>(null)
  const [rejected, setRejected] = useState<ValidationError | null>(null)

  const coverageMonths = chosenMonths(levelKey, customMonths)
  const goal = buildGoal(monthlyExpenses, coverageMonths, levelKey, override)
  const target = previewTarget(monthlyExpenses, coverageMonths, override)

  const save = (): void => {
    if (isErr(goal)) {
      setRejected(goal.error)
      return
    }
    setRejected(null)
    submit.mutate({ monthlyExpenses, goal: goal.value }, { onSuccess: onSaved })
  }

  // Applied to every change: the message described a value that is no longer there, and a
  // rejection left under a field the user has just edited reads as a new refusal.
  function clearingRejection<T>(apply: (value: T) => void): (value: T) => void {
    return (value) => {
      apply(value)
      setRejected(null)
    }
  }

  return {
    levelKey,
    customMonths,
    coverageMonths,
    override,
    target,
    coverageError: messageFor(rejected, 'coverageMonths'),
    targetError: messageFor(rejected, 'target'),
    isSaving: submit.isPending,
    hasFailed: submit.isError,
    selectLevel: clearingRejection(setLevelKey),
    changeCustomMonths: clearingRejection(setCustomMonths),
    changeOverride: clearingRejection(setOverride),
    save,
  }
}

/** The duration behind the current choice — the preset's, or the one being typed. */
function chosenMonths(levelKey: LevelKey, customMonths: string): number {
  return levelKey === 'custom' ? Number.parseInt(customMonths, 10) : COVERAGE_MONTHS[levelKey]
}

/**
 * What the preview shows, which is not the same question as what may be saved.
 *
 * A figure the user is typing is shown as they type it, refused or not: a zero override is
 * rejected on save, and hiding the preview the moment it was typed would take away the
 * field being edited along with the message explaining it.
 *
 * Null only when there is nothing to show at all — no override, and a duration that is not
 * yet a usable number, which `calculateTarget` would throw on rather than multiply.
 */
function previewTarget(
  monthlyExpenses: Money,
  coverageMonths: number,
  override: Money | null,
): Money | null {
  if (override !== null) {
    return override
  }
  const coverage = validateCoverageMonths(coverageMonths)
  return isErr(coverage) ? null : calculateTarget(monthlyExpenses, coverage.value)
}

/**
 * Assembles the goal, or names the first figure that is not usable.
 *
 * One function for both the preview and the save, so what the screen shows is exactly what
 * it would store. Validating only on save would let a target be drawn from a duration the
 * app was going to refuse — and `calculateTarget` multiplies, which on a duration of `NaN`
 * throws rather than producing a figure.
 */
function buildGoal(
  monthlyExpenses: Money,
  coverageMonths: number,
  levelKey: LevelKey,
  override: Money | null,
): Result<GoalInput, ValidationError> {
  const coverage = validateCoverageMonths(coverageMonths)
  if (isErr(coverage)) {
    return coverage
  }
  const target = validateTarget(override ?? calculateTarget(monthlyExpenses, coverage.value))
  if (isErr(target)) {
    return target
  }
  return ok({
    target: target.value,
    source: override === null ? 'calculated' : 'user_defined',
    levelKey,
    coverageMonths: coverage.value,
    desiredCompletionDate: null,
  })
}

/** The message for a rejection, if it was this field that was rejected. */
function messageFor(rejected: ValidationError | null, field: string): string | undefined {
  return rejected !== null && rejected.field === field ? validationMessage(rejected) : undefined
}
