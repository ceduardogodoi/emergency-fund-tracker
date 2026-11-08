import type { ReactNode } from 'react'
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native'

import type { Destination } from '@/features/navigation/destinations'
import { Text } from '@/ui/primitives'
import { color, minimumTouchTarget, opacity, spacing } from '@/ui/tokens'

/** Props for {@link MenuItem}. */
export interface MenuItemProps {
  /** The destination this item leads to. */
  readonly destination: Destination
  /** Whether it is the section the menu was opened on. */
  readonly current: boolean
  /** Called when the item is chosen. */
  readonly onPress: () => void
}

/**
 * One destination in the navigation menu.
 *
 * Built here rather than taken from the drawer's own `DrawerItem`, which limits its label to
 * one line, so at the largest text size a name would be cut off (001 FR-050), and which
 * draws in React Navigation's colours rather than the tokens (research D-004). Here the
 * label wraps as far as it needs to and the row grows with it.
 *
 * The current item says so twice: to a screen reader through `selected`, and to the eye
 * through a bar at its leading edge — a shape, so it is not colour alone that carries it
 * (FR-007, 001 FR-049). The bar is drawn only on the current item; every label keeps the
 * same inset, so the list does not shift as the current section changes.
 *
 * @param props - See {@link MenuItemProps}
 * @returns The rendered item
 */
export function MenuItem({ destination, current, onPress }: MenuItemProps): ReactNode {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={destination.label}
      accessibilityState={{ selected: current }}
      onPress={onPress}
      testID={`menu-item-${destination.key}`}
      style={({ pressed }) => [styles.item, pressed && styles.pressed]}
    >
      {current ? (
        <View style={styles.currentBar} testID={`menu-item-${destination.key}-current`} />
      ) : null}
      <View style={styles.label}>
        <Text>{destination.label}</Text>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  item: {
    minHeight: minimumTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  } satisfies ViewStyle,
  pressed: { opacity: opacity.pressed },
  // At the leading edge and the full height of the row, outside the flow so the label's
  // inset is the same whether or not it is there.
  currentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: spacing.xs,
    backgroundColor: color.filled.accent.background,
  } satisfies ViewStyle,
  label: { flexShrink: 1 } satisfies ViewStyle,
})
