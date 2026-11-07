import { useRouter } from 'expo-router'
import type { ReactNode } from 'react'

import { useServices } from '@/runtime/services-context'
import { EntryDate } from '@/features/entries/entry-date'
import { useEntryDraft } from '@/features/entries/use-entry-draft'
import { leaveScreen } from '@/features/navigation/leave-screen'
import { Button, Field, MoneyInput, Screen, Text } from '@/ui/primitives'
import { strings } from '@/ui/strings'

/**
 * Recording a contribution (FR-008, FR-009, FR-010).
 *
 * Built for the common case: an amount, saved today — `EntryDate` says how the day is
 * chosen.
 *
 * @returns The rendered screen
 */
export default function ContributeScreen(): ReactNode {
  const router = useRouter()
  const { format } = useServices()
  const draft = useEntryDraft(() => {
    leaveScreen(router)
  })

  return (
    <Screen title={strings.entries.contributeTitle}>
      <MoneyInput
        label={strings.entries.amountLabel}
        value={draft.amount}
        onChangeValue={draft.changeAmount}
        format={format.money}
        help={strings.entries.amountHelp}
        error={draft.amountError}
        required
        testID="amount-input"
      />
      <EntryDate draft={draft} otherExplanation={strings.entries.otherDateExplanation} />
      <Field
        label={strings.entries.noteLabel}
        value={draft.note}
        onChangeText={draft.changeNote}
        help={strings.entries.noteHelp}
        error={draft.noteError}
        testID="note-input"
      />
      <Button
        label={strings.action.save}
        onPress={draft.save}
        disabled={draft.isSaving}
        testID="save-entry"
      />
      {/* Storage failed, rather than a value being refused. The draft stays on screen, so
          nothing the user typed is lost. */}
      {draft.hasFailed ? <Text tone="negative">{strings.state.errorBody}</Text> : null}
    </Screen>
  )
}
