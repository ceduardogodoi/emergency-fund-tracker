import type { ReactNode } from 'react'
import { Pressable, StyleSheet, type ViewStyle } from 'react-native'

import { Text, type TextTone } from '@/ui/primitives/text'
import { borderWidth, color, minimumTouchTarget, opacity, radius, spacing } from '@/ui/tokens'

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
      {/* Centred through the label rather than by the container: see `align` on `Text`.
          A button that centres a content-sized label loses the end of a long one on
          Android, silently and only on some screen widths. */}
      <Text variant="label" tone={scheme.tone} align="center">
        {label}
      </Text>
    </Pressable>
  )
}

/**
 * A fill paired with the foreground that was audited against it.
 *
 * `secondary` is a slab with a boundary and ordinary ink, not a second blue thing. The
 * palette has one accent, and an accent used by two controls at once stops saying which of
 * them the screen is asking for; the border is what makes it a control, and the fill is
 * what makes it a surface rather than a label.
 */
const SCHEMES = {
  primary: {
    background: color.filled.accent.background,
    border: color.filled.accent.background,
    tone: 'onAccent',
  },
  secondary: {
    background: color.background.card,
    border: color.boundary.control,
    tone: 'primary',
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
    borderRadius: radius.none,
    borderWidth: borderWidth.control,
    alignItems: 'center',
    justifyContent: 'center',
  } satisfies ViewStyle,
  pressed: { opacity: opacity.pressed },
  disabled: { opacity: opacity.disabled },
})
