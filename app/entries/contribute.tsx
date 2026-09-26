import { useRouter } from 'expo-router'
import type { ReactNode } from 'react'
import { StyleSheet, View, type ViewStyle } from 'react-native'

import { useServices } from '@/runtime/services-context'
import {
  useEntryDraft,
  type DateChoice,
  type EntryDraftState,
} from '@/features/entries/use-entry-draft'
import { leaveScreen } from '@/features/navigation/leave-screen'
import { Button, Choice, DatePicker, Field, MoneyInput, Screen, Text } from '@/ui/primitives'
import { strings } from '@/ui/strings'
import { spacing } from '@/ui/tokens'

/**
 * Recording a contribution (FR-008, FR-009, FR-010).
 *
 * Built for the common case: an amount, saved today. The date is a choice that opens on
 * today and offers yesterday in one tap, because those two cover nearly every contribution
 * and neither needs a calendar. Any other day is behind "Outra data", where the native
 * calendar is revealed with nothing after today in it.
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
      <EntryDate draft={draft} />
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

/** Props for {@link EntryDate}. */
interface EntryDateProps {
  readonly draft: EntryDraftState
}

/** One of the three ways to date the entry, as the group renders it. */
interface DateOption {
  readonly choice: DateChoice
  readonly label: string
  readonly description: string
}

/**
 * The day the contribution belongs to.
 *
 * Each option says which date it stands for, not only its name: "Hoje" saved at five past
 * midnight is a different day from the one the user may have in mind, and the only way to
 * notice is to see it written.
 */
function EntryDate({ draft }: EntryDateProps): ReactNode {
  const { locale } = useServices()

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={strings.entries.dateLabel}
      style={styles.group}
    >
      <Text variant="label">{strings.entries.dateLabel}</Text>
      {useDateOptions(draft).map((option) => (
        <Choice
          key={option.choice}
          label={option.label}
          description={option.description}
          selected={draft.dateChoice === option.choice}
          onSelect={() => {
            draft.chooseDate(option.choice)
          }}
          testID={`date-${option.choice}`}
        />
      ))}
      {draft.dateChoice === 'other' ? (
        <DatePicker
          value={draft.pickedDate}
          latest={draft.today}
          locale={locale}
          onChange={draft.pickDate}
          testID="entry-date-picker"
        />
      ) : null}
      {draft.dateError === undefined ? null : (
        <View accessibilityLiveRegion="polite">
          <Text variant="caption" tone="negative">
            {draft.dateError}
          </Text>
        </View>
      )}
    </View>
  )
}

/**
 * The three options, each described by the date it stands for.
 *
 * "Outra data" has no date until it is chosen — the picked day is only meaningful while the
 * calendar is open — so until then it says what it is for instead.
 */
function useDateOptions(draft: EntryDraftState): readonly DateOption[] {
  const { format } = useServices()
  return [
    { choice: 'today', label: strings.entries.today, description: format.date(draft.today) },
    {
      choice: 'yesterday',
      label: strings.entries.yesterday,
      description: format.date(draft.yesterday),
    },
    {
      choice: 'other',
      label: strings.entries.otherDate,
      description:
        draft.dateChoice === 'other'
          ? format.date(draft.pickedDate)
          : strings.entries.otherDateExplanation,
    },
  ]
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm } satisfies ViewStyle,
})
