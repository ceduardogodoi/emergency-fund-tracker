import { useReducer, type Dispatch } from 'react'

import { useServices } from '@/runtime/services-context'
import { addDays, type CalendarDate } from '@/domain/dates/calendar-date'
import type { OverBalanceError, ValidationError } from '@/domain/errors'
import { validateEntry } from '@/domain/ledger/entry'
import type { LedgerEntryInput } from '@/domain/ledger/types'
import { money, type Money } from '@/domain/money/money'
import { isErr } from '@/domain/result'
import { fieldMessage } from '@/ui/strings'
import { resolveDate, type DateChoice, type DateDraft } from './date-choice'
import { useRecordWithdrawal } from './hooks'
import { NO_REASON, reasonOf, type ReasonDraft } from './reason-draft'

/** Everything the user has entered so far, as one value — see `use-entry-draft.ts`. */
interface WithdrawalDraft {
  readonly amount: Money
  readonly dateChoice: DateChoice
  /** The day last picked from the calendar, in force only while `dateChoice` is `other`. */
  readonly pickedDate: CalendarDate
  readonly reason: ReasonDraft
  /** The value the last submission refused, or null when nothing was refused. */
  readonly rejected: ValidationError | null
}

/** What the user did. Everything but a refusal is an edit. */
type WithdrawalDraftAction =
  | { readonly kind: 'amount-entered'; readonly amount: Money }
  | { readonly kind: 'date-chosen'; readonly dateChoice: DateChoice }
  | { readonly kind: 'date-picked'; readonly pickedDate: CalendarDate }
  | { readonly kind: 'reason-changed'; readonly reason: ReasonDraft }
  | { readonly kind: 'submission-refused'; readonly rejected: ValidationError }

/** An action that changes a value, as opposed to reporting on one. */
type WithdrawalDraftEdit = Exclude<WithdrawalDraftAction, { kind: 'submission-refused' }>

/** The withdrawal being composed, and everything a screen needs to render or change it. */
export interface WithdrawalDraftState extends DateDraft {
  readonly amount: Money
  readonly reason: ReasonDraft
  /** The message under the amount, when that is what was refused. */
  readonly amountError: string | undefined
  /** The message under the reasons, when that is what was refused. */
  readonly reasonError: string | undefined
  /**
   * The question to ask, when the withdrawal is more than the balance (FR-017): the balance
   * and how far below zero it would go. Null when there is nothing to ask.
   */
  readonly overBalance: OverBalanceError | null
  /** Whether the submission is in flight, for the save control's own pending state. */
  readonly isSaving: boolean
  /** Whether the last submission failed in storage, as opposed to being refused or asked about. */
  readonly hasFailed: boolean
  readonly changeAmount: (value: Money) => void
  readonly changeReason: (reason: ReasonDraft) => void
  /** Validates and submits. Does nothing when a value is refused, beyond saying so. */
  readonly save: () => void
  /** Records the withdrawal the over-balance question was about. */
  readonly confirmOverBalance: () => void
  /** Withdraws the question, leaving the draft as it was for the user to correct. */
  readonly cancelOverBalance: () => void
}

/**
 * The state behind recording a withdrawal (FR-016, FR-017).
 *
 * Checked by `validateEntry` before it is sent, as a contribution is, so a missing reason is
 * named while the user is still looking at it. Whether it is more than the balance is not
 * checked here: `recordEntry` measures that against the ledger in storage, and its refusal
 * is the question — kept on the mutation, with the entry it was about, rather than copied
 * into the draft, so there is one record of what is being asked.
 *
 * @param onSaved Called once the write has landed — where the screen navigates.
 * @returns The draft, its messages, and the operations that change it.
 */
export function useWithdrawalDraft(onSaved: () => void): WithdrawalDraftState {
  const { clock } = useServices()
  const record = useRecordWithdrawal()
  const [draft, dispatch] = useReducer(reduce, clock.today(), openDraft)
  const overBalance = record.error?.kind === 'over-balance' ? record.error : null

  const today = clock.today()

  return {
    amount: draft.amount,
    dateChoice: draft.dateChoice,
    today,
    yesterday: addDays(today, -1),
    pickedDate: draft.pickedDate,
    reason: draft.reason,
    amountError: fieldMessage(draft.rejected, 'amount'),
    reasonError: fieldMessage(draft.rejected, 'reason'),
    dateError: fieldMessage(draft.rejected, 'date'),
    overBalance,
    isSaving: record.isPending,
    hasFailed: record.isError && overBalance === null,
    ...editors(dispatch),
    save: () => {
      // The clock again, not the render's reading of it — see `use-entry-draft.ts`.
      const now = clock.today()
      const validated = validateEntry(buildEntry(draft, now), { today: now, hasOpening: false })
      if (isErr(validated)) {
        dispatch({ kind: 'submission-refused', rejected: validated.error })
        return
      }
      record.mutate({ entry: validated.value, overBalanceConfirmed: false }, { onSuccess: onSaved })
    },
    confirmOverBalance: () => {
      // The entry that was asked about, not the draft rebuilt: the sheet covers the form, so
      // the two are the same, and this is the one the figures on the sheet describe. It is
      // always there while the sheet is — a refusal comes from a submission — and the check
      // is for the compiler, whose type for it admits a mutation never run.
      if (record.variables !== undefined) {
        record.mutate({ ...record.variables, overBalanceConfirmed: true }, { onSuccess: onSaved })
      }
    },
    cancelOverBalance: () => {
      record.reset()
    },
  }
}

/** The operations that change a value, each wrapping one action. */
function editors(
  dispatch: Dispatch<WithdrawalDraftAction>,
): Pick<WithdrawalDraftState, 'changeAmount' | 'chooseDate' | 'pickDate' | 'changeReason'> {
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
    changeReason: (reason) => {
      dispatch({ kind: 'reason-changed', reason })
    },
  }
}

/** An empty withdrawal, dated today, with no reason chosen. */
function openDraft(today: CalendarDate): WithdrawalDraft {
  return {
    amount: money(0),
    dateChoice: 'today',
    pickedDate: today,
    reason: NO_REASON,
    rejected: null,
  }
}

/** The draft's one transition function. Every edit clears the refusal, as in the goal draft. */
function reduce(draft: WithdrawalDraft, action: WithdrawalDraftAction): WithdrawalDraft {
  if (action.kind === 'submission-refused') {
    return { ...draft, rejected: action.rejected }
  }
  return { ...applyEdit(draft, action), rejected: null }
}

/** Applies the value an edit carries. Exhaustive, so a new edit cannot be forgotten here. */
function applyEdit(draft: WithdrawalDraft, action: WithdrawalDraftEdit): WithdrawalDraft {
  switch (action.kind) {
    case 'amount-entered':
      return { ...draft, amount: action.amount }
    case 'date-chosen':
      return { ...draft, dateChoice: action.dateChoice }
    case 'date-picked':
      return { ...draft, pickedDate: action.pickedDate }
    case 'reason-changed':
      return { ...draft, reason: action.reason }
  }
}

/** The withdrawal the draft describes. A withdrawal has a reason where others have a note. */
function buildEntry(draft: WithdrawalDraft, today: CalendarDate): LedgerEntryInput {
  return {
    type: 'withdrawal',
    amount: draft.amount,
    date: resolveDate(draft.dateChoice, draft.pickedDate, today),
    note: null,
    withdrawalReason: reasonOf(draft.reason),
  }
}
