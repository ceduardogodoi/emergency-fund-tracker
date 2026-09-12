import { useReducer, type Dispatch } from 'react'

import type { ValidationError } from '@/domain/errors'
import { COVERAGE_MONTHS } from '@/domain/goal/levels'
import { calculateTarget } from '@/domain/goal/target'
import type { Goal, GoalInput, LevelKey } from '@/domain/goal/types'
import {
  validateCoverageMonths,
  validateMonthlyExpenses,
  validateTarget,
} from '@/domain/goal/validation'
import type { Money } from '@/domain/money/money'
import { isErr, ok, type Result } from '@/domain/result'
import { validationMessage } from '@/ui/strings'
import { useSubmitGoal } from './hooks'

/** The level offered first: the most common starting point rather than the smallest fund. */
export const DEFAULT_LEVEL = 'balanced'

/**
 * Everything the user has decided so far, as one value.
 *
 * One state rather than five, because the five are not independent: every edit to any of
 * the four figures also clears the refusal message, and that is a rule about the draft
 * rather than about any one field. Split across separate `useState` calls it has to be
 * stapled onto each setter, which is four places for one rule to be forgotten from.
 */
interface GoalDraft {
  readonly monthlyExpenses: Money
  readonly levelKey: LevelKey
  /** The duration being typed, as text — an empty field is not a number. */
  readonly customMonths: string
  readonly override: Money | null
  /** The figure the last submission refused, or null when nothing was refused. */
  readonly rejected: ValidationError | null
}

/** What the user did. Everything but a refusal is an edit. */
type GoalDraftAction =
  | { readonly kind: 'expenses-entered'; readonly monthlyExpenses: Money }
  | { readonly kind: 'level-chosen'; readonly levelKey: LevelKey }
  | { readonly kind: 'duration-typed'; readonly customMonths: string }
  | { readonly kind: 'target-overridden'; readonly override: Money | null }
  | { readonly kind: 'submission-refused'; readonly rejected: ValidationError }

/** An action that changes a figure, as opposed to reporting on one. */
type GoalDraftEdit = Exclude<GoalDraftAction, { kind: 'submission-refused' }>

/** Where a draft begins — the figures the form is seeded with. */
export interface GoalDraftStart {
  /** The average monthly essential expenses (FR-001). */
  readonly monthlyExpenses: Money
  /** The level to show as chosen. */
  readonly levelKey: LevelKey
  /** The duration behind that level, which is the custom field's starting value too. */
  readonly coverageMonths: number
  /** The user's own target, or null when the calculated one is in force (FR-005). */
  readonly override: Money | null
}

/**
 * A first goal, from the figure setup collected.
 *
 * @param monthlyExpenses The figure the target is derived from.
 * @returns The starting point for a draft nobody has saved yet.
 */
export function firstGoalDraft(monthlyExpenses: Money): GoalDraftStart {
  return {
    monthlyExpenses,
    levelKey: DEFAULT_LEVEL,
    coverageMonths: COVERAGE_MONTHS[DEFAULT_LEVEL],
    override: null,
  }
}

/**
 * A revision, from the goal as it stands (FR-006).
 *
 * The stored `levelKey` is used rather than derived from the duration. Both are recorded,
 * and the stored one is the choice the user actually made — deriving it would turn a custom
 * duration of six months into "Equilibrada", putting a word in their mouth they did not say.
 *
 * `source` decides whether the target is offered back as theirs: a `user_defined` target
 * reopens in the override field, a calculated one reopens as the product of the two figures
 * above it, so reopening the screen proposes nothing the user did not choose.
 *
 * @param goal The stored goal.
 * @param monthlyExpenses The stored expenses the target was derived from.
 * @returns The starting point for revising it.
 */
export function storedGoalDraft(goal: Goal, monthlyExpenses: Money): GoalDraftStart {
  return {
    monthlyExpenses,
    levelKey: goal.levelKey,
    coverageMonths: goal.coverageMonths,
    override: goal.source === 'user_defined' ? goal.target : null,
  }
}

/** The goal being composed, and everything a screen needs to render or change it. */
export interface GoalDraftState {
  /** The expenses figure as it stands, which a revision screen may change. */
  readonly monthlyExpenses: Money
  /** The level currently chosen, `custom` included. */
  readonly levelKey: LevelKey
  /** The duration being typed, as text. */
  readonly customMonths: string
  /** The duration behind the current choice. */
  readonly coverageMonths: number
  /** The user's own target, or null while the calculated one is in force (FR-005). */
  readonly override: Money | null
  /** The target as it stands, or null while the duration is not a usable number. */
  readonly target: Money | null
  /** The message under the expenses field, when that is what was refused. */
  readonly expensesError: string | undefined
  /** The message under the duration field, when that is what was refused. */
  readonly coverageError: string | undefined
  /** The message under the target field, when that is what was refused. */
  readonly targetError: string | undefined
  /** Whether the submission is in flight, for the save control's own pending state. */
  readonly isSaving: boolean
  /** Whether the last submission failed in storage, as opposed to in validation. */
  readonly hasFailed: boolean
  readonly changeMonthlyExpenses: (value: Money) => void
  readonly selectLevel: (key: LevelKey) => void
  readonly changeCustomMonths: (value: string) => void
  readonly changeOverride: (value: Money | null) => void
  /** Validates and submits. Does nothing when a figure is refused, beyond saying so. */
  readonly save: () => void
}

/**
 * The state behind sizing a goal: expenses, a level, a duration, and an optional override.
 *
 * A hook rather than state in the screen, because the same decisions are made twice — during
 * setup, and again on the revision screen (FR-006) — and the second one has to arrive at the
 * same target from the same inputs. Two copies of this arithmetic is two chances for the app
 * to disagree with itself about what a user's fund should hold.
 *
 * The target follows every change immediately (FR-006), so the user chooses by watching the
 * figure rather than by imagining it.
 *
 * @param start What the form opens on. Read once, when the screen mounts: a screen renders
 *   this form only after its data has arrived, so there is no later value to adopt, and
 *   re-seeding from a changing prop would overwrite what the user was in the middle of typing.
 * @param onSaved Called once the write has landed — where the screen navigates.
 * @returns The draft, its messages, and the operations that change it.
 */
export function useGoalDraft(start: GoalDraftStart, onSaved: () => void): GoalDraftState {
  const submit = useSubmitGoal()
  const [draft, dispatch] = useReducer(reduce, start, openDraft)

  const coverageMonths = chosenMonths(draft)
  const goal = buildGoal(draft, coverageMonths)

  return {
    monthlyExpenses: draft.monthlyExpenses,
    levelKey: draft.levelKey,
    customMonths: draft.customMonths,
    coverageMonths,
    override: draft.override,
    target: previewTarget(draft, coverageMonths),
    expensesError: messageFor(draft.rejected, 'monthlyExpenses'),
    coverageError: messageFor(draft.rejected, 'coverageMonths'),
    targetError: messageFor(draft.rejected, 'target'),
    isSaving: submit.isPending,
    hasFailed: submit.isError,
    ...editors(dispatch),
    save: () => {
      if (isErr(goal)) {
        dispatch({ kind: 'submission-refused', rejected: goal.error })
        return
      }
      submit.mutate(
        { monthlyExpenses: draft.monthlyExpenses, goal: goal.value },
        { onSuccess: onSaved },
      )
    },
  }
}

/**
 * The four operations that change a figure, each wrapping one action.
 *
 * Apart from the hook so that what it returns stays readable as a list of what a screen
 * gets, rather than as a wall of dispatch calls with the interesting values buried in them.
 *
 * @param dispatch The reducer's dispatch.
 * @returns The editing half of {@link GoalDraftState}.
 */
function editors(
  dispatch: Dispatch<GoalDraftAction>,
): Pick<
  GoalDraftState,
  'changeMonthlyExpenses' | 'selectLevel' | 'changeCustomMonths' | 'changeOverride'
> {
  return {
    changeMonthlyExpenses: (monthlyExpenses) => {
      dispatch({ kind: 'expenses-entered', monthlyExpenses })
    },
    selectLevel: (levelKey) => {
      dispatch({ kind: 'level-chosen', levelKey })
    },
    changeCustomMonths: (customMonths) => {
      dispatch({ kind: 'duration-typed', customMonths })
    },
    changeOverride: (override) => {
      dispatch({ kind: 'target-overridden', override })
    },
  }
}

/** Turns the figures a screen opens on into the draft the reducer carries. */
function openDraft(start: GoalDraftStart): GoalDraft {
  return {
    monthlyExpenses: start.monthlyExpenses,
    levelKey: start.levelKey,
    customMonths: String(start.coverageMonths),
    override: start.override,
    rejected: null,
  }
}

/**
 * The draft's one transition function.
 *
 * The rule that every edit clears the refusal is stated here, once: a message describing a
 * value the user has since changed is a message about something that is no longer on the
 * screen, and left under a field they have just edited it reads as a fresh refusal of what
 * they typed.
 *
 * There is no action for a successful submission. Success is only reachable when nothing
 * stands refused — any edit clears the message, and pressing save again without editing
 * refuses the same figure again — so there is no state for it to return to.
 */
function reduce(draft: GoalDraft, action: GoalDraftAction): GoalDraft {
  if (action.kind === 'submission-refused') {
    return { ...draft, rejected: action.rejected }
  }
  return { ...applyEdit(draft, action), rejected: null }
}

/** Applies the figure an edit carries. Exhaustive, so a new edit cannot be forgotten here. */
function applyEdit(draft: GoalDraft, action: GoalDraftEdit): GoalDraft {
  switch (action.kind) {
    case 'expenses-entered':
      return { ...draft, monthlyExpenses: action.monthlyExpenses }
    case 'level-chosen':
      return { ...draft, levelKey: action.levelKey }
    case 'duration-typed':
      return { ...draft, customMonths: action.customMonths }
    case 'target-overridden':
      return { ...draft, override: action.override }
  }
}

/** The duration behind the current choice — the preset's, or the one being typed. */
function chosenMonths(draft: GoalDraft): number {
  return draft.levelKey === 'custom'
    ? Number.parseInt(draft.customMonths, 10)
    : COVERAGE_MONTHS[draft.levelKey]
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
function previewTarget(draft: GoalDraft, coverageMonths: number): Money | null {
  if (draft.override !== null) {
    return draft.override
  }
  const coverage = validateCoverageMonths(coverageMonths)
  return isErr(coverage) ? null : calculateTarget(draft.monthlyExpenses, coverage.value)
}

/**
 * Assembles the goal, or names the first figure that is not usable.
 *
 * One function for both the preview and the save, so what the screen shows is exactly what
 * it would store. Validating only on save would let a target be drawn from a duration the
 * app was going to refuse — and `calculateTarget` multiplies, which on a duration of `NaN`
 * throws rather than producing a figure.
 *
 * The expenses come first because the other two are derived from them: a target calculated
 * from an expense figure the app is about to refuse is a number with nothing behind it, and
 * naming the duration as the problem would send the user to correct the wrong field.
 */
function buildGoal(draft: GoalDraft, coverageMonths: number): Result<GoalInput, ValidationError> {
  const expenses = validateMonthlyExpenses(draft.monthlyExpenses)
  if (isErr(expenses)) {
    return expenses
  }
  const coverage = validateCoverageMonths(coverageMonths)
  if (isErr(coverage)) {
    return coverage
  }
  const target = validateTarget(draft.override ?? calculateTarget(expenses.value, coverage.value))
  if (isErr(target)) {
    return target
  }
  return ok({
    target: target.value,
    source: draft.override === null ? 'calculated' : 'user_defined',
    levelKey: draft.levelKey,
    coverageMonths: coverage.value,
    desiredCompletionDate: null,
  })
}

/** The message for a rejection, if it was this field that was rejected. */
function messageFor(rejected: ValidationError | null, field: string): string | undefined {
  return rejected !== null && rejected.field === field ? validationMessage(rejected) : undefined
}
