import type { ReactNode } from 'react'
import { StyleSheet, View, type ViewStyle } from 'react-native'

import { useServices } from '@/runtime/services-context'
import { Choice, DatePicker, Text } from '@/ui/primitives'
import { strings } from '@/ui/strings'
import { spacing } from '@/ui/tokens'
import type { DateChoice, DateDraft } from './date-choice'

/** Props for {@link EntryDate}. */
export interface EntryDateProps {
  readonly draft: DateDraft
  /** What "Outra data" is for, in terms of the entry being recorded. */
  readonly otherExplanation: string
}

/** One of the three ways to date the entry, as the group renders it. */
interface DateOption {
  readonly choice: DateChoice
  readonly label: string
  readonly description: string
}

/**
 * The day a new entry belongs to.
 *
 * Opens on today and offers yesterday in one tap, because those two cover nearly every
 * entry and neither needs a calendar. Any other day is behind "Outra data", where the
 * native calendar is revealed with nothing after today in it. Shared by the contribute and
 * withdraw screens, which differ only in what "another day" is for.
 *
 * Each option says which date it stands for, not only its name: "Hoje" saved at five past
 * midnight is a different day from the one the user may have in mind, and the only way to
 * notice is to see it written.
 *
 * @param props - See {@link EntryDateProps}
 * @returns The rendered group
 */
export function EntryDate({ draft, otherExplanation }: EntryDateProps): ReactNode {
  const { locale } = useServices()

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={strings.entries.dateLabel}
      style={styles.group}
    >
      <Text variant="label">{strings.entries.dateLabel}</Text>
      {useDateOptions(draft, otherExplanation).map((option) => (
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
function useDateOptions(draft: DateDraft, otherExplanation: string): readonly DateOption[] {
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
      description: draft.dateChoice === 'other' ? format.date(draft.pickedDate) : otherExplanation,
    },
  ]
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm } satisfies ViewStyle,
})
