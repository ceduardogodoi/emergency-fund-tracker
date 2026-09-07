import type { ReactNode } from 'react'
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native'

import { Text } from '@/ui/primitives/text'
import { borderWidth, color, minimumTouchTarget, opacity, radius, spacing } from '@/ui/tokens'

/** Props for {@link Choice}. */
export interface ChoiceProps {
  /** The option's name, which is also its accessible name. */
  readonly label: string
  /**
   * What choosing this means, in the user's terms.
   *
   * Required rather than optional. An option worth offering is one the user has to be able
   * to tell apart from its neighbours, and FR-003 asks for exactly that — a plain-language
   * line saying who each level suits, so the choice is informed rather than arbitrary.
   */
  readonly description: string
  /** A figure summarising the option — the duration behind a level, for instance. */
  readonly detail?: string | undefined
  /**
   * An optional visual drawn beneath the description.
   *
   * A composition slot rather than a prop describing a picture, so the primitive never
   * has to know what is being depicted. Whatever goes here is decorative by contract: the
   * option's meaning has to survive in {@link ChoiceProps.label},
   * {@link ChoiceProps.description}, and {@link ChoiceProps.detail} alone, because those
   * three are what a screen reader announces.
   */
  readonly children?: ReactNode | undefined
  /** Whether this is the option currently chosen. */
  readonly selected: boolean
  /** Called when the user chooses this option. */
  readonly onSelect: () => void
  /** Exposes the element to tests. */
  readonly testID?: string | undefined
}

/**
 * One option in a group where exactly one is chosen.
 *
 * A pressable of its own rather than a `Button`, because an option is two lines — a name
 * and what it means — and a button's accessible name is its visible text. Announced as a
 * radio, which is what carries the choice to a screen reader: `selected` is state, not
 * decoration, and a mark drawn on the card would say nothing out loud.
 *
 * Selection is shown by fill and border together, never by colour alone (FR-049). The
 * border width does not change with it: a boundary that thickens on selection shifts every
 * option below it as the user moves through the list.
 *
 * @param props - See {@link ChoiceProps}
 * @returns The rendered option
 */
export function Choice({
  label,
  description,
  detail,
  selected,
  onSelect,
  children,
  testID,
}: ChoiceProps): ReactNode {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onSelect}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        selected ? styles.selected : styles.unselected,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.header}>
        <Text variant="label">{label}</Text>
        {detail === undefined ? null : (
          <Text variant="caption" tone="secondary" numeric>
            {detail}
          </Text>
        )}
      </View>
      <Text variant="caption" tone="secondary">
        {description}
      </Text>
      {children}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    minHeight: minimumTouchTarget,
    padding: spacing.md,
    gap: spacing.xs,
    borderRadius: radius.none,
    borderWidth: borderWidth.emphasis,
  } satisfies ViewStyle,
  selected: {
    backgroundColor: color.background.card,
    borderColor: color.boundary.focus,
  } satisfies ViewStyle,
  unselected: {
    backgroundColor: color.background.page,
    borderColor: color.boundary.control,
  } satisfies ViewStyle,
  pressed: { opacity: opacity.pressed } satisfies ViewStyle,
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  } satisfies ViewStyle,
})
