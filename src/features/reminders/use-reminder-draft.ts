import { useState } from 'react'

import type { AppError } from '@/domain/errors'
import {
  formatTimeOfDay,
  stepHour,
  stepMinute,
  type StepDirection,
  type TimeOfDay,
} from '@/domain/reminders/schedule'
import type { ReminderFrequency, ReminderSetting } from '@/domain/reminders/types'
import { useSaveReminder } from './hooks'
import { draftFromSetting, settingFromDraft, type ReminderDraft } from './reminder-draft'

/** Why the last save did not land, in the terms the screen explains it in. */
export type ReminderRefusal = 'denied' | 'device' | 'storage'

/** What {@link useReminderDraft} gives the screen. */
export interface ReminderDraftState {
  readonly draft: ReminderDraft
  /** `HH:MM`, as the summary states it. */
  readonly timeOfDay: string
  /** Why the last save did not land, or null when nothing has gone wrong. */
  readonly refusal: ReminderRefusal | null
  readonly isSaving: boolean
  /** Flips the switch. A draft change only: nothing is asked or stored until {@link save}. */
  turn(on: boolean): void
  selectFrequency(frequency: ReminderFrequency): void
  selectDayOfMonth(day: number): void
  selectDayOfWeek(day: number): void
  stepHour(direction: StepDirection): void
  stepMinute(direction: StepDirection): void
  /** Saves the draft; on success, calls the `onSaved` the hook was given. */
  save(): void
}

/**
 * The reminders form: a draft seeded from the stored setting, and its save.
 *
 * A declined permission turns the switch back off as well as being explained, so the screen
 * shows what is true — reminders are off (FR-035). Turning the switch again clears the
 * explanation, which was about the attempt.
 *
 * @param stored The setting as stored, which the draft starts from.
 * @param onSaved Called once the save has landed.
 * @returns The draft and what changes it.
 */
export function useReminderDraft(stored: ReminderSetting, onSaved: () => void): ReminderDraftState {
  const [draft, setDraft] = useState(() => draftFromSetting(stored))
  const mutation = useSaveReminder()

  function change(patch: Partial<ReminderDraft>): void {
    setDraft((current) => ({ ...current, ...patch }))
  }
  function moveTime(step: (time: TimeOfDay) => TimeOfDay): void {
    setDraft((current) => ({ ...current, time: step(current.time) }))
  }

  return {
    draft,
    timeOfDay: formatTimeOfDay(draft.time),
    refusal: mutation.error === null ? null : refusalFor(mutation.error),
    isSaving: mutation.isPending,
    turn(on) {
      mutation.reset()
      change({ enabled: on })
    },
    selectFrequency: (frequency) => change({ frequency }),
    selectDayOfMonth: (dayOfMonth) => change({ dayOfMonth }),
    selectDayOfWeek: (dayOfWeek) => change({ dayOfWeek }),
    stepHour: (direction) => moveTime((time) => stepHour(time, direction)),
    stepMinute: (direction) => moveTime((time) => stepMinute(time, direction)),
    save() {
      mutation.mutate(settingFromDraft(draft), {
        onSuccess: onSaved,
        onError: (error) => {
          if (error.kind === 'permission-denied') {
            change({ enabled: false })
          }
        },
      })
    },
  }
}

/**
 * The refusal a failed save is explained as. A validation failure cannot come from this
 * form, which offers only valid choices; if one ever did, "could not be saved" is the
 * truthful thing to say about it.
 */
function refusalFor(error: AppError): ReminderRefusal {
  switch (error.kind) {
    case 'permission-denied':
      return 'denied'
    case 'device':
      return 'device'
    default:
      return 'storage'
  }
}
