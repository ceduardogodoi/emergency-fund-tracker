import { useRouter } from 'expo-router'
import type { ReactNode } from 'react'
import { Linking } from 'react-native'

import { toViewState } from '@/runtime/query'
import { DEFAULT_REMINDER_SETTING } from '@/domain/reminders/schedule'
import type { ReminderSetting } from '@/domain/reminders/types'
import { leaveScreen } from '@/features/navigation/leave-screen'
import { useReminder } from '@/features/reminders/hooks'
import { ReminderSchedule } from '@/features/reminders/reminder-schedule'
import { useReminderDraft, type ReminderRefusal } from '@/features/reminders/use-reminder-draft'
import { Button, ErrorState, LoadingState, Screen, StateView, Text, Toggle } from '@/ui/primitives'
import { strings } from '@/ui/strings'

/**
 * The contribution reminder (Story 6): on or off, and when it comes.
 *
 * Off by default (FR-034), with nothing to configure until it is turned on. The switch is
 * part of the form: the permission is asked for when the reminder is saved on, which is
 * the moment the user has decided (FR-035), and a decline is explained here with the way to
 * the system settings — once refused, the system will not ask again.
 *
 * @returns The rendered screen
 */
export default function RemindersScreen(): ReactNode {
  const stored = useReminder()
  // Never empty: with nothing stored the repository answers the default, which is off.
  const state = toViewState(stored, () => false)

  return (
    <Screen title={strings.reminders.title}>
      <Text tone="secondary">{strings.reminders.intro}</Text>
      <StateView
        state={state}
        loading={() => <LoadingState />}
        // Unreachable, as above. Should the repository ever answer nothing, a first launch
        // is what that means, and the form opens on the default.
        empty={() => <ReminderForm stored={DEFAULT_REMINDER_SETTING} />}
        error={(_error, retry) => <ErrorState retry={retry} />}
        ready={(setting) => <ReminderForm stored={setting} />}
      />
    </Screen>
  )
}

/** Props for {@link ReminderForm}. */
interface ReminderFormProps {
  readonly stored: ReminderSetting
}

/** The form, seeded once from the stored setting, so its hooks are never conditional. */
function ReminderForm({ stored }: ReminderFormProps): ReactNode {
  const router = useRouter()
  const state = useReminderDraft(stored, () => {
    leaveScreen(router)
  })

  return (
    <>
      <Toggle
        label={strings.reminders.enabledLabel}
        value={state.draft.enabled}
        onChange={state.turn}
        testID="reminder-enabled"
      />
      {state.draft.enabled ? <ReminderSchedule state={state} /> : null}
      {state.refusal === null ? null : <Refusal refusal={state.refusal} />}
      <Button
        label={strings.action.save}
        onPress={state.save}
        disabled={state.isSaving}
        testID="save-reminder"
      />
    </>
  )
}

/** Props for {@link Refusal}. */
interface RefusalProps {
  readonly refusal: ReminderRefusal
}

/** Why the last save did not land, and for a declined permission, the way out. */
function Refusal({ refusal }: RefusalProps): ReactNode {
  if (refusal === 'denied') {
    return (
      <>
        <Text tone="negative">{strings.reminders.deniedBody}</Text>
        <Button
          label={strings.reminders.openSettings}
          variant="secondary"
          onPress={() => {
            void Linking.openSettings()
          }}
          testID="open-settings"
        />
      </>
    )
  }
  return (
    <Text tone="negative">
      {refusal === 'device' ? strings.reminders.deviceFailedBody : strings.reminders.saveFailedBody}
    </Text>
  )
}
