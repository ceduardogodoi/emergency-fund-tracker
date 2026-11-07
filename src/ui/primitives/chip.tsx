import type { ReactNode } from 'react'
import { Pressable, StyleSheet, type ViewStyle } from 'react-native'

import { Text } from '@/ui/primitives/text'
import { borderWidth, color, minimumTouchTarget, opacity, radius, spacing } from '@/ui/tokens'

/** Props for {@link Chip}. */
export interface ChipProps {
  /** The short text shown — a day's number, a weekday's abbreviation. */
  readonly label: string
  /**
   * What a screen reader announces instead, when the visible text is too short to stand
   * alone: "Dia 17" rather than a bare "17". Defaults to the label.
   */
  readonly accessibilityLabel?: string | undefined
  /** Whether this is the one chosen. */
  readonly selected: boolean
  /** Called when the user chooses it. */
  readonly onSelect: () => void
  /** Exposes the element to tests. */
  readonly testID?: string | undefined
}

/**
 * One small option in a group where exactly one is chosen — a day of the month, a day of
 * the week.
 *
 * {@link Choice}'s compact sibling, for options a word or a number already explains. Like
 * it, announced as a radio with `selected` as state, and selection shown by fill and border
 * together, never by colour alone (FR-049). At least the minimum touch target in both
 * directions, since a grid of them is pressed with a thumb.
 *
 * @param props - See {@link ChipProps}
 * @returns The rendered option
 */
export function Chip({
  label,
  accessibilityLabel = label,
  selected,
  onSelect,
  testID,
}: ChipProps): ReactNode {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      onPress={onSelect}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        selected ? styles.selected : styles.unselected,
        pressed && styles.pressed,
      ]}
    >
      <Text variant="label" tone={selected ? 'onAccent' : 'primary'} numeric align="center">
        {label}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    minWidth: minimumTouchTarget,
    minHeight: minimumTouchTarget,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.none,
    borderWidth: borderWidth.emphasis,
    alignItems: 'center',
    justifyContent: 'center',
  } satisfies ViewStyle,
  selected: {
    backgroundColor: color.filled.accent.background,
    borderColor: color.boundary.focus,
  } satisfies ViewStyle,
  unselected: {
    backgroundColor: color.background.card,
    borderColor: color.boundary.control,
  } satisfies ViewStyle,
  pressed: { opacity: opacity.pressed } satisfies ViewStyle,
})
