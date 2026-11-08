import { usePathname, useRouter } from 'expo-router'
import type { DrawerContentComponentProps } from 'expo-router/drawer'
import type { ReactNode } from 'react'
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { DESTINATIONS, type Destination } from '@/features/navigation/destinations'
import { MenuItem } from '@/features/navigation/menu-item'
import { Text } from '@/ui/primitives'
import { strings } from '@/ui/strings'
import { color, screenInset, spacing } from '@/ui/tokens'

/**
 * The drawer's content: every destination, in order, the current one marked.
 *
 * Which one is current is read from the router's pathname, compared with each destination's
 * href — one answer, from the router, in the same terms the list is written in. Only a
 * section can match: a form is never showing while the menu can be opened, since its screen
 * has no menu button and opens over the drawer (data-model.md).
 *
 * Choosing closes the menu, whatever is chosen. The current section then changes nothing
 * else (FR-006). Anything else is navigated to by its href, and where its route file lives
 * decides how it opens: a section is shown in place by the drawer, and a form, whose file is
 * in the root stack, is pushed over the screen the menu was opened on, so back returns there
 * (research D-003). The drawer closes itself on moving to another section, but not for the
 * current one or a form — without the explicit close, the menu would still be open behind
 * the form when the user came back.
 *
 * Inside a scroll view, so at the largest text size every item stays reachable (001 FR-050).
 *
 * @param props - What the drawer hands its content
 * @returns The rendered menu
 */
export function NavigationMenu({ navigation }: DrawerContentComponentProps): ReactNode {
  const pathname = usePathname()
  const router = useRouter()

  function choose(destination: Destination): void {
    navigation.closeDrawer()
    if (destination.href === pathname) {
      return
    }
    router.navigate(destination.href)
  }

  return (
    <SafeAreaView style={styles.menu} testID="navigation-menu">
      <ScrollView contentContainerStyle={styles.content}>
        {/* A heading a screen reader can land on, saying what this list is. Inset like
            the items, so the column's left edge is one line. */}
        <View style={styles.heading}>
          <Text variant="label" tone="secondary" accessibilityRole="header">
            {strings.navigation.menuLabel}
          </Text>
        </View>
        {DESTINATIONS.map((destination) => (
          <MenuItem
            key={destination.key}
            destination={destination}
            current={destination.href === pathname}
            onPress={() => {
              choose(destination)
            }}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  menu: {
    flex: 1,
    backgroundColor: color.background.card,
  } satisfies ViewStyle,
  content: {
    paddingVertical: screenInset,
    gap: spacing.xs,
  } satisfies ViewStyle,
  heading: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm } satisfies ViewStyle,
})
