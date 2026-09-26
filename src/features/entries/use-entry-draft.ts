import { useReducer, type Dispatch } from 'react'

import { useServices } from '@/runtime/services-context'
import { addDays, type CalendarDate } from '@/domain/dates/calendar-date'
import type { ValidationError } from '@/domain/errors'
import { validateEntry } from '@/domain/ledger/entry'
import type { LedgerEntryInput } from '@/domain/ledger/types'
import { money, type Money } from '@/domain/money/money'
import { isErr } from '@/domain/result'
import { fieldMessage } from '@/ui/strings'
import { useAddEntry } from './hooks'

/**
 * How the day of an entry was chosen.
 *
 * A choice rather than a date, because "Hoje" and "Ontem" are relative: they are resolved
 * against today when the entry is built, and a picked day is kept aside so that returning
 * to the calendar finds it where it was left.
 */
export type DateChoice = 'today' | 'yesterday' | 'other'

/** Everything the user has entered so far, as one value — see `use-goal-draft.ts`. */
interface EntryDraft {
  readonly amount: Money
  readonly dateChoice: DateChoice
  /** The day last picked from the calendar, in force only while `dateChoice` is `other`. */
  readonly pickedDate: CalendarDate
  /** The note as typed, surrounding whitespace included. */
  readonly note: string
  /** The value the last submission refused, or null when nothing was refused. */
  readonly rejected: ValidationError | null
}

/** What the user did. Everything but a refusal is an edit. */
type EntryDraftAction =
  | { readonly kind: 'amount-entered'; readonly amount: Money }
  | { readonly kind: 'date-chosen'; readonly dateChoice: DateChoice }
  | { readonly kind: 'date-picked'; readonly pickedDate: CalendarDate }
  | { readonly kind: 'note-typed'; readonly note: string }
  | { readonly kind: 'submission-refused'; readonly rejected: ValidationError }

/** An action that changes a value, as opposed to reporting on one. */
type EntryDraftEdit = Exclude<EntryDraftAction, { kind: 'submission-refused' }>

/** The contribution being composed, and everything a screen needs to render or change it. */
export interface EntryDraftState {
  readonly amount: Money
  readonly dateChoice: DateChoice
  /** Today, as it was when the form opened. The calendar's last selectable day. */
  readonly today: CalendarDate
  /** The day "Ontem" stands for. */
  readonly yesterday: CalendarDate
  /** The day last picked from the calendar. */
  readonly pickedDate: CalendarDate
  readonly note: string
  /** The message under the amount, when that is what was refused. */
  readonly amountError: string | undefined
  /** The message under the note, when that is what was refused. */
  readonly noteError: string | undefined
  /** The message under the date, when that is what was refused. */
  readonly dateError: string | undefined
  /** Whether the submission is in flight, for the save control's own pending state. */
  readonly isSaving: boolean
  /** Whether the last submission failed in storage, as opposed to in validation. */
  readonly hasFailed: boolean
  readonly changeAmount: (value: Money) => void
  readonly chooseDate: (choice: DateChoice) => void
  readonly pickDate: (value: CalendarDate) => void
  readonly changeNote: (value: string) => void
  /** Validates and submits. Does nothing when a value is refused, beyond saying so. */
  readonly save: () => void
}

/**
 * The state behind recording a contribution (FR-008, FR-009, FR-010).
 *
 * The entry is checked by `validateEntry` before it is sent, so a refusal names its field
 * while the user is still looking at it. `recordEntry` checks the same rules again on the
 * way to storage; that second check is the one the import path (FR-046) relies on, and the
 * form cannot bypass it.
 *
 * @param onSaved Called once the write has landed — where the screen navigates.
 * @returns The draft, its messages, and the operations that change it.
 */
export function useEntryDraft(onSaved: () => void): EntryDraftState {
  const { clock } = useServices()
  const add = useAddEntry()
  const [draft, dispatch] = useReducer(reduce, clock.today(), openDraft)

  // Read per render rather than stored: the draft holds a choice, and what the choice means
  // is today's business. The picked day is the only absolute date in it.
  const today = clock.today()
  const yesterday = addDays(today, -1)

  return {
    amount: draft.amount,
    dateChoice: draft.dateChoice,
    today,
    yesterday,
    pickedDate: draft.pickedDate,
    note: draft.note,
    amountError: fieldMessage(draft.rejected, 'amount'),
    noteError: fieldMessage(draft.rejected, 'note'),
    dateError: fieldMessage(draft.rejected, 'date'),
    isSaving: add.isPending,
    hasFailed: add.isError,
    ...editors(dispatch),
    save: () => {
      // The clock again, not the render's reading of it. A form left open across midnight,
      // or on a device whose clock is corrected meanwhile, would otherwise be checked
      // against a day that has stopped being today — and `recordEntry` would then refuse
      // what this let through, as a storage failure with no field to point at.
      const now = clock.today()
      const entry = buildEntry(draft, now, addDays(now, -1))
      // A contribution is never an opening balance, so whether one exists cannot change the
      // answer — and finding out would cost a read of the whole ledger.
      const validated = validateEntry(entry, { today: now, hasOpening: false })
      if (isErr(validated)) {
        dispatch({ kind: 'submission-refused', rejected: validated.error })
        return
      }
      add.mutate(validated.value, { onSuccess: onSaved })
    },
  }
}

/** The four operations that change a value, each wrapping one action. */
function editors(
  dispatch: Dispatch<EntryDraftAction>,
): Pick<EntryDraftState, 'changeAmount' | 'chooseDate' | 'pickDate' | 'changeNote'> {
  return {
    changeAmount: (amount) => {
      dispatch({ kind: 'amount-entered', amount })
    },
    chooseDate: (dateChoice) => {
      dispatch({ kind: 'date-chosen', dateChoice })
    },
    pickDate: (pickedDate) => {
      dispatch({ kind: 'date-picked', pickedDate })
    },
    changeNote: (note) => {
      dispatch({ kind: 'note-typed', note })
    },
  }
}

/**
 * An empty contribution, dated today.
 *
 * The calendar opens on today too, rather than on yesterday or on nothing: today is where a
 * user who asked for "another day" starts counting back from.
 */
function openDraft(today: CalendarDate): EntryDraft {
  return { amount: money(0), dateChoice: 'today', pickedDate: today, note: '', rejected: null }
}

/** The draft's one transition function. Every edit clears the refusal, as in the goal draft. */
function reduce(draft: EntryDraft, action: EntryDraftAction): EntryDraft {
  if (action.kind === 'submission-refused') {
    return { ...draft, rejected: action.rejected }
  }
  return { ...applyEdit(draft, action), rejected: null }
}

/** Applies the value an edit carries. Exhaustive, so a new edit cannot be forgotten here. */
function applyEdit(draft: EntryDraft, action: EntryDraftEdit): EntryDraft {
  switch (action.kind) {
    case 'amount-entered':
      return { ...draft, amount: action.amount }
    case 'date-chosen':
      return { ...draft, dateChoice: action.dateChoice }
    case 'date-picked':
      return { ...draft, pickedDate: action.pickedDate }
    case 'note-typed':
      return { ...draft, note: action.note }
  }
}

/**
 * The entry the draft describes.
 *
 * The note is trimmed, and a blank one is no note: stored as spaces it would show in the
 * history as an entry with something to say and nothing said.
 */
function buildEntry(
  draft: EntryDraft,
  today: CalendarDate,
  yesterday: CalendarDate,
): LedgerEntryInput {
  const note = draft.note.trim()
  return {
    type: 'contribution',
    amount: draft.amount,
    date: resolveDate(draft, today, yesterday),
    note: note === '' ? null : note,
    withdrawalReason: null,
  }
}

/** The day the current choice stands for. */
function resolveDate(
  draft: EntryDraft,
  today: CalendarDate,
  yesterday: CalendarDate,
): CalendarDate {
  switch (draft.dateChoice) {
    case 'today':
      return today
    case 'yesterday':
      return yesterday
    case 'other':
      return draft.pickedDate
  }
}
