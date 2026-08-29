import type { ReactNode } from 'react'
import { Pressable, StyleSheet, type ViewStyle } from 'react-native'

import { Text, type TextTone } from '@/ui/primitives/text'
import { color, minimumTouchTarget, radius, spacing } from '@/ui/tokens'

/** The roles a button can play, which decide its fill and its foreground together. */
export type ButtonVariant = 'primary' | 'secondary' | 'destructive'

/** Props for {@link Button}. */
export interface ButtonProps {
  /**
   * The button's visible text, which is also its accessible name.
   *
   * Required rather than optional: a control a screen reader announces as "button" and
   * nothing else is unusable, and FR-049 forbids it. Making the type demand a label means
   * an unlabelled button cannot be written in the first place.
   */
  readonly label: string
  /** Called when the button is activated. */
  readonly onPress: () => void
  /** Which role this button plays. Defaults to `primary`. */
  readonly variant?: ButtonVariant
  /** Prevents activation and dims the button. */
  readonly disabled?: boolean
  /** Exposes the element to tests. */
  readonly testID?: string
}

/**
 * The only pressable in the app that renders as a button.
 *
 * Each variant names a fill and the foreground audited against it, taken from the token
 * module as a pair — a caller cannot combine a fill with text that was never checked for
 * contrast against it, because the two are never offered separately.
 *
 * @param props - See {@link ButtonProps}
 * @returns The rendered button
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  testID,
}: ButtonProps): ReactNode {
  const scheme = SCHEMES[variant]
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: scheme.background, borderColor: scheme.border },
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text variant="label" tone={scheme.tone}>
        {label}
      </Text>
    </Pressable>
  )
}

/**
 * A fill paired with the foreground that was audited against it.
 *
 * `secondary` sits on the page rather than on a fill of its own, so it takes the audited
 * page foreground and a visible boundary instead — an outline button with no border is
 * indistinguishable from a label.
 */
const SCHEMES = {
  primary: {
    background: color.filled.accent.background,
    border: color.filled.accent.background,
    tone: 'onAccent',
  },
  secondary: {
    background: color.background.page,
    border: color.boundary.control,
    tone: 'accent',
  },
  destructive: {
    background: color.filled.negative.background,
    border: color.filled.negative.background,
    tone: 'onNegative',
  },
} as const satisfies Record<ButtonVariant, { background: string; border: string; tone: TextTone }>

const styles = StyleSheet.create({
  base: {
    minHeight: minimumTouchTarget,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  } satisfies ViewStyle,
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.45 },
})
