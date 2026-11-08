import { useNavigation } from 'expo-router'
import { useDrawerStatus } from 'expo-router/drawer'
import { DrawerActions } from 'expo-router/react-navigation'
import type { ReactNode } from 'react'
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native'

import { strings } from '@/ui/strings'
import { borderWidth, color, minimumTouchTarget, opacity, spacing } from '@/ui/tokens'

/**
 * Opens the navigation menu. Drawn by each section of the drawer, in `Screen`'s `leading`
 * slot (specs/002-drawer-navigation/contracts/navigation-ui.md).
 *
 * Built here rather than taken from the drawer's `DrawerToggleButton`, whose accessible name
 * is the English "Show navigation menu" and which says nothing of whether the menu is open
 * (research D-004). This one is named in the app's language and announces its state
 * (FR-003). The state is read from the drawer each render rather than kept here, so what it
 * announces and what is on screen cannot disagree (data-model.md).
 *
 * The glyph is three bars drawn as views: the conventional sign for a menu, square like
 * every other shape in the app, and no icon package for one icon. The bars are decoration —
 * the accessible name carries the meaning.
 *
 * Must render inside a drawer: `useDrawerStatus` throws anywhere else, which is the honest
 * answer for a button that would otherwise open nothing.
 *
 * @returns The rendered button
 */
export function MenuButton(): ReactNode {
  const navigation = useNavigation()
  const expanded = useDrawerStatus() === 'open'
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={strings.navigation.open}
      accessibilityState={{ expanded }}
      onPress={() => {
        navigation.dispatch(DrawerActions.openDrawer())
      }}
      testID="menu-button"
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <View style={styles.bar} />
      <View style={styles.bar} />
      <View style={styles.bar} />
    </Pressable>
  )
}

/** The glyph's width: a half of the touch target, so it reads as an icon rather than a rule. */
const BAR_WIDTH = minimumTouchTarget / 2

const styles = StyleSheet.create({
  button: {
    width: minimumTouchTarget,
    height: minimumTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  } satisfies ViewStyle,
  pressed: { opacity: opacity.pressed },
  bar: {
    width: BAR_WIDTH,
    height: borderWidth.emphasis,
    backgroundColor: color.text.primary,
  } satisfies ViewStyle,
})
