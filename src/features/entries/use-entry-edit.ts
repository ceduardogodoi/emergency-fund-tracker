import { useState } from 'react'

import { useServices } from '@/runtime/services-context'
import type { CalendarDate } from '@/domain/dates/calendar-date'
import type { EntryType, LedgerEntry, LedgerEntryPatch } from '@/domain/ledger/types'
import type { Money } from '@/domain/money/money'
import { fieldMessage } from '@/ui/strings'
import { useUpdateEntry } from './hooks'
import { NO_REASON, reasonDraftOf, reasonOf, type ReasonDraft } from './reason-draft'

/** What the form holds: the things about an entry a user can correct. */
interface EntryRevision {
  readonly amount: Money
  readonly date: CalendarDate
  /** The note as typed, surrounding whitespace included. Not offered for a withdrawal. */
  readonly note: string
  /** A withdrawal's reason. Nothing chosen, and not offered, for any other kind. */
  readonly reason: ReasonDraft
}

/** The correction being composed, and everything a form needs to render or change it. */
export interface EntryEditState {
  readonly amount: Money
  readonly date: CalendarDate
  /** Today, as the clock reports it. The calendar's last selectable day. */
  readonly today: CalendarDate
  readonly note: string
  readonly reason: ReasonDraft
  /** The message under the amount, when that is what was refused. */
  readonly amountError: string | undefined
  /** The message under the date, when that is what was refused. */
  readonly dateError: string | undefined
  /** The message under the note, when that is what was refused. */
  readonly noteError: string | undefined
  /** The message under the reasons, when that is what was refused. */
  readonly reasonError: string | undefined
  /** Whether the correction is in flight, for the save control's own pending state. */
  readonly isSaving: boolean
  /** Whether the last save failed in storage, as opposed to being refused. */
  readonly hasFailed: boolean
  readonly changeAmount: (value: Money) => void
  readonly changeDate: (value: CalendarDate) => void
  readonly changeNote: (value: string) => void
  readonly changeReason: (reason: ReasonDraft) => void
  /** Submits the correction. A refusal comes back as one of the messages above. */
  readonly save: () => void
}

/**
 * The state behind correcting an entry (FR-011).
 *
 * Nothing is validated here. `reviseEntry` applies every rule on the way to storage, and a
 * second copy of them in the form could only ever agree with it or be wrong — so the
 * mutation's refusal is the form's, as it is on the opening balance step.
 *
 * @param entry The entry as it is stored, which the form opens on.
 * @param onSaved Called once the write has landed — where the screen navigates.
 * @returns The revision, its messages, and the operations that change it.
 */
export function useEntryEdit(entry: LedgerEntry, onSaved: () => void): EntryEditState {
  const { clock } = useServices()
  const update = useUpdateEntry()
  const [revision, setRevision] = useState<EntryRevision>(() => openRevision(entry))
  const refused = update.error?.kind === 'validation' ? update.error : null

  // Every edit withdraws the last refusal: the message describes a value that is no longer
  // the one on screen.
  const change = (edit: Partial<EntryRevision>): void => {
    setRevision((current) => ({ ...current, ...edit }))
    update.reset()
  }

  return {
    ...revision,
    today: clock.today(),
    amountError: fieldMessage(refused, 'amount'),
    dateError: fieldMessage(refused, 'date'),
    noteError: fieldMessage(refused, 'note'),
    reasonError: fieldMessage(refused, 'reason'),
    isSaving: update.isPending,
    hasFailed: update.isError && refused === null,
    ...editors(change),
    save: () => {
      update.mutate(
        { id: entry.id, patch: buildPatch(entry.type, revision) },
        { onSuccess: onSaved },
      )
    },
  }
}

/** The entry as it is stored, as the form opens on it. */
function openRevision(entry: LedgerEntry): EntryRevision {
  return {
    amount: entry.amount,
    date: entry.date,
    note: entry.note ?? '',
    reason: entry.withdrawalReason === null ? NO_REASON : reasonDraftOf(entry.withdrawalReason),
  }
}

/** The operations that change a value, each one field of the revision. */
function editors(
  change: (edit: Partial<EntryRevision>) => void,
): Pick<EntryEditState, 'changeAmount' | 'changeDate' | 'changeNote' | 'changeReason'> {
  return {
    changeAmount: (amount) => {
      change({ amount })
    },
    changeDate: (date) => {
      change({ date })
    },
    changeNote: (note) => {
      change({ note })
    },
    changeReason: (reason) => {
      change({ reason })
    },
  }
}

/**
 * The patch the revision amounts to.
 *
 * A withdrawal has a reason where the others have a note: its patch carries the reason as
 * the form now gives it, and the form offers it no note. Every other kind carries the note,
 * trimmed, a blank one being no note as when it was first recorded, and leaves the reason
 * out and so alone.
 */
function buildPatch(type: EntryType, revision: EntryRevision): LedgerEntryPatch {
  if (type === 'withdrawal') {
    return {
      amount: revision.amount,
      date: revision.date,
      withdrawalReason: reasonOf(revision.reason),
    }
  }
  const note = revision.note.trim()
  return { amount: revision.amount, date: revision.date, note: note === '' ? null : note }
}
