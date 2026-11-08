import type { ReactNode } from 'react'
import {
  Pressable,
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type ViewStyle,
} from 'react-native'

import { Text } from '@/ui/primitives/text'
import { borderWidth, color, minimumTouchTarget, opacity, radius, spacing } from '@/ui/tokens'

/** The two actions an adjustable control answers: a swipe up and a swipe down. */
const ADJUST_ACTIONS = [{ name: 'increment' }, { name: 'decrement' }] as const

/** Props for {@link Stepper}. */
export interface StepperProps {
  /** What the value is — "Hora". Also the control's accessible name. */
  readonly label: string
  /** The value as shown, already formatted. Also what a screen reader announces. */
  readonly value: string
  /** The accessible name of the button that steps up. */
  readonly increaseLabel: string
  /** The accessible name of the button that steps down. */
  readonly decreaseLabel: string
  /** Called once per step up, from the button or a screen reader's swipe. */
  readonly onIncrease: () => void
  /** Called once per step down. */
  readonly onDecrease: () => void
  /**
   * The stem the parts are exposed to tests under: `<testID>-stepper` for the control,
   * `<testID>-value`, `<testID>-increase`, and `<testID>-decrease`.
   */
  readonly testID: string
}

/**
 * A value moved one step at a time with − and + buttons — the hour and minutes of a
 * reminder.
 *
 * Built from our own pieces rather than a native time picker, decided with the user on
 * 2026-11-07: it looks and behaves the same on both platforms, and has none of the native
 * picker's zone and initial-value quirks to normalise. The stepper does not know what it
 * steps; the caller decides what one step is and whether it wraps.
 *
 * To a screen reader it is one adjustable control, announced with its value and changed
 * with a swipe up or down, rather than two buttons it has to find and tell apart. The
 * buttons stay for touch, each named for what it does.
 *
 * @param props - See {@link StepperProps}
 * @returns The rendered stepper
 */
export function Stepper(props: StepperProps): ReactNode {
  const { label, value, onIncrease, onDecrease, testID } = props
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: value }}
      accessibilityActions={ADJUST_ACTIONS}
      onAccessibilityAction={(event: AccessibilityActionEvent) => {
        if (event.nativeEvent.actionName === 'increment') {
          onIncrease()
        } else if (event.nativeEvent.actionName === 'decrement') {
          onDecrease()
        }
      }}
      style={styles.stepper}
      testID={`${testID}-stepper`}
    >
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
      <StepRow {...props} />
    </View>
  )
}

/** The − button, the value, and the + button, in a row. */
function StepRow({
  value,
  increaseLabel,
  decreaseLabel,
  onIncrease,
  onDecrease,
  testID,
}: StepperProps): ReactNode {
  return (
    <View style={styles.row}>
      <StepButton
        symbol="−"
        label={decreaseLabel}
        onPress={onDecrease}
        testID={`${testID}-decrease`}
      />
      <View style={styles.value}>
        <Text variant="title" numeric align="center" testID={`${testID}-value`}>
          {value}
        </Text>
      </View>
      <StepButton
        symbol="+"
        label={increaseLabel}
        onPress={onIncrease}
        testID={`${testID}-increase`}
      />
    </View>
  )
}

/** Props for {@link StepButton}. */
interface StepButtonProps {
  /** The sign drawn on the button. Not text a reader hears — `label` is. */
  readonly symbol: string
  readonly label: string
  readonly onPress: () => void
  readonly testID: string
}

/** One of the stepper's two buttons. */
function StepButton({ symbol, label, onPress, testID }: StepButtonProps): ReactNode {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Text variant="title" align="center">
        {symbol}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  stepper: { gap: spacing.xs } satisfies ViewStyle,
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm } satisfies ViewStyle,
  value: { minWidth: minimumTouchTarget } satisfies ViewStyle,
  // At least the touch target rather than exactly it, as `Chip` is: the sign grows with the
  // platform's text size, and a box held to 48 would let it overflow (FR-050).
  button: {
    minWidth: minimumTouchTarget,
    minHeight: minimumTouchTarget,
    borderRadius: radius.none,
    borderWidth: borderWidth.control,
    borderColor: color.boundary.control,
    backgroundColor: color.background.card,
    alignItems: 'center',
    justifyContent: 'center',
  } satisfies ViewStyle,
  pressed: { opacity: opacity.pressed } satisfies ViewStyle,
})
