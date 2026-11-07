import type { ReactNode } from 'react'
import { StyleSheet, View, type ViewStyle } from 'react-native'

import { WITHDRAWAL_REASONS } from '@/domain/ledger/withdrawal'
import { Choice, Field, Text } from '@/ui/primitives'
import { strings } from '@/ui/strings'
import { spacing } from '@/ui/tokens'
import type { ReasonDraft } from './reason-draft'

/** Props for {@link ReasonPicker}. */
export interface ReasonPickerProps {
  /** The reason as the form holds it. */
  readonly reason: ReasonDraft
  /** Called with the reason as it now stands. */
  readonly onChange: (reason: ReasonDraft) => void
  /** The message under the group, when the reason is what was refused. */
  readonly error: string | undefined
}

/**
 * Why money is being taken out (FR-016): one of the predefined reasons, or the user's own
 * words.
 *
 * Every predefined reason the domain offers, each explaining what it covers, then "Outro
 * motivo", which reveals a field to write in. The field stays out of the way until asked
 * for, as the calendar does behind "Outra data".
 *
 * @param props - See {@link ReasonPickerProps}
 * @returns The rendered group
 */
export function ReasonPicker({ reason, onChange, error }: ReasonPickerProps): ReactNode {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={strings.withdrawal.reasonLabel}
      style={styles.group}
    >
      <Text variant="label">{strings.withdrawal.reasonLabel}</Text>
      {WITHDRAWAL_REASONS.map((key) => (
        <Choice
          key={key}
          label={strings.withdrawal.reasons[key].label}
          description={strings.withdrawal.reasons[key].description}
          selected={reason.choice === key}
          onSelect={() => {
            onChange({ ...reason, choice: key })
          }}
          testID={`reason-${key}`}
        />
      ))}
      <Choice
        label={strings.withdrawal.otherReason}
        description={strings.withdrawal.otherReasonDescription}
        selected={reason.choice === 'other'}
        onSelect={() => {
          onChange({ ...reason, choice: 'other' })
        }}
        testID="reason-other"
      />
      {reason.choice === 'other' ? <OwnWords reason={reason} onChange={onChange} /> : null}
      {error === undefined ? null : (
        <View accessibilityLiveRegion="polite">
          <Text variant="caption" tone="negative">
            {error}
          </Text>
        </View>
      )}
    </View>
  )
}

/** Props for {@link OwnWords}. */
type OwnWordsProps = Pick<ReasonPickerProps, 'reason' | 'onChange'>

/** The field a reason is written in, once "Outro motivo" is chosen. */
function OwnWords({ reason, onChange }: OwnWordsProps): ReactNode {
  return (
    <Field
      label={strings.withdrawal.otherReasonLabel}
      value={reason.text}
      onChangeText={(text) => {
        onChange({ ...reason, text })
      }}
      required
      testID="reason-input"
    />
  )
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm } satisfies ViewStyle,
})
