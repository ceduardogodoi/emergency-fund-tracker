import { useState } from 'react'

import { useServices } from '@/runtime/services-context'
import type { CalendarDate } from '@/domain/dates/calendar-date'
import type { LedgerEntry, LedgerEntryPatch } from '@/domain/ledger/types'
import type { Money } from '@/domain/money/money'
import { fieldMessage } from '@/ui/strings'
import { useUpdateEntry } from './hooks'

/** What the form holds: the three things about an entry a user can correct. */
interface EntryRevision {
  readonly amount: Money
  readonly date: CalendarDate
  /** The note as typed, surrounding whitespace included. */
  readonly note: string
}

/** The correction being composed, and everything a form needs to render or change it. */
export interface EntryEditState {
  readonly amount: Money
  readonly date: CalendarDate
  /** Today, as the clock reports it. The calendar's last selectable day. */
  readonly today: CalendarDate
  readonly note: string
  /** The message under the amount, when that is what was refused. */
  readonly amountError: string | undefined
  /** The message under the date, when that is what was refused. */
  readonly dateError: string | undefined
  /** The message under the note, when that is what was refused. */
  readonly noteError: string | undefined
  /** Whether the correction is in flight, for the save control's own pending state. */
  readonly isSaving: boolean
  /** Whether the last save failed in storage, as opposed to being refused. */
  readonly hasFailed: boolean
  readonly changeAmount: (value: Money) => void
  readonly changeDate: (value: CalendarDate) => void
  readonly changeNote: (value: string) => void
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
  const [revision, setRevision] = useState<EntryRevision>(() => ({
    amount: entry.amount,
    date: entry.date,
    note: entry.note ?? '',
  }))
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
    isSaving: update.isPending,
    hasFailed: update.isError && refused === null,
    changeAmount: (amount) => {
      change({ amount })
    },
    changeDate: (date) => {
      change({ date })
    },
    changeNote: (note) => {
      change({ note })
    },
    save: () => {
      update.mutate({ id: entry.id, patch: buildPatch(revision) }, { onSuccess: onSaved })
    },
  }
}

/**
 * The patch the revision amounts to.
 *
 * The note is trimmed and a blank one is no note, as when it was first recorded. That is
 * also what a withdrawal sends: it has a reason where the others have a note, the form
 * offers it no note to type, and the patch leaves the reason out and so alone.
 */
function buildPatch(revision: EntryRevision): LedgerEntryPatch {
  const note = revision.note.trim()
  return { amount: revision.amount, date: revision.date, note: note === '' ? null : note }
}
