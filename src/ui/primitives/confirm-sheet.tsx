import type { ReactNode } from 'react'
import { Modal, StyleSheet, View, type ViewStyle } from 'react-native'

import { Button } from '@/ui/primitives/button'
import { Text } from '@/ui/primitives/text'
import { strings } from '@/ui/strings'
import { color, radius, spacing } from '@/ui/tokens'

/** Props for {@link ConfirmSheet}. */
export interface ConfirmSheetProps {
  /** Whether the sheet is showing. */
  readonly open: boolean
  /** What is about to happen, as a short sentence naming the action. */
  readonly title: string
  /**
   * What the action does and what it costs.
   *
   * Required, and required to name the loss. "Are you sure?" tells the user nothing they
   * did not already know; the ui-contract asks the sheet to state what will happen and
   * what is lost, because that is the only information that makes the choice a choice.
   */
  readonly body: string
  /**
   * The confirming button's label.
   *
   * The verb, never "OK" — the ui-contract's rule. A user who reads only the buttons should
   * still know which one deletes.
   */
  readonly confirmLabel: string
  /** Called when the user confirms. */
  readonly onConfirm: () => void
  /** Called when the user cancels, or dismisses the sheet with the system back gesture. */
  readonly onCancel: () => void
  /** Exposes the sheet to tests. */
  readonly testID?: string | undefined
}

/**
 * The one confirmation pattern for destructive actions.
 *
 * Every irreversible action in the app — deleting an entry, replacing data on import,
 * erasing everything — goes through this. One pattern means the user learns the shape of
 * the question once, and a destructive action that skips it is visible in review as a
 * missing component rather than as a subtly different dialog.
 *
 * The confirming button always takes the destructive variant. Its label is the caller's
 * verb, but its weight is not the caller's decision to make.
 *
 * @param props - See {@link ConfirmSheetProps}
 * @returns The rendered sheet, or nothing while it is closed
 */
export function ConfirmSheet({
  open,
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
  testID,
}: ConfirmSheetProps): ReactNode {
  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      // Android's back gesture dismisses the sheet, and dismissing is cancelling: the
      // destructive action must never be what happens when someone backs out.
      onRequestClose={onCancel}
    >
      <View style={styles.scrim}>
        <View
          // `alert` rather than a plain view: the sheet interrupts to ask a question, and
          // a screen reader should move to it and read it rather than announce a layout
          // change. `accessibilityViewIsModal` is what keeps VoiceOver from wandering back
          // into the screen underneath.
          accessibilityRole="alert"
          accessibilityLabel={title}
          accessibilityViewIsModal
          style={styles.sheet}
          testID={testID}
        >
          <Text variant="heading" accessibilityRole="header">
            {title}
          </Text>
          <Text tone="secondary">{body}</Text>
          <View style={styles.actions}>
            <Button label={strings.action.cancel} variant="secondary" onPress={onCancel} />
            <Button label={confirmLabel} variant="destructive" onPress={onConfirm} />
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: color.scrim,
  } satisfies ViewStyle,
  sheet: {
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: color.background.page,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  } satisfies ViewStyle,
  actions: { gap: spacing.sm } satisfies ViewStyle,
})
