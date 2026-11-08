import { Drawer } from 'expo-router/drawer'
import type { ReactNode } from 'react'

import { NavigationMenu } from '@/features/navigation/navigation-menu'
import { color } from '@/ui/tokens'

/**
 * The sections of the app that show the navigation menu: Home, History, Statistics, and
 * Forecast (specs/002-drawer-navigation, research D-003).
 *
 * Everything else — the forms, the entry editor, onboarding — stays in the root stack, so
 * it opens over whichever section is showing and returns there. The URLs are unchanged: a
 * group's name is not part of a path.
 *
 * Back from a section returns Home, never through earlier menu choices (FR-009). That is
 * the drawer's default, stated here so a future default cannot change it unnoticed.
 *
 * @returns The drawer navigator
 */
export default function DrawerLayout(): ReactNode {
  return (
    <Drawer
      backBehavior="firstRoute"
      drawerContent={(props) => <NavigationMenu {...props} />}
      screenOptions={SCREEN_OPTIONS}
    />
  )
}

/**
 * How the drawer looks and behaves, from the tokens like everything else.
 *
 * - No header: each screen draws its own title as a heading, and the menu button beside it
 *   (`Screen`'s `leading`), as the root stack's screens do.
 * - `front` on every platform: the drawer's own default is `slide` on iOS, which moves the
 *   whole screen aside, and `front` elsewhere — the same tap behaving differently on each
 *   (FR-013). `front` slides the menu over the content, on a phone and a tablet alike, and
 *   is never permanently open (research D-006).
 * - The backdrop is the scrim the confirmation sheet uses, rather than the drawer's own
 *   hard-coded black.
 */
const SCREEN_OPTIONS = {
  headerShown: false,
  drawerType: 'front',
  overlayColor: color.scrim,
  drawerStyle: { backgroundColor: color.background.card },
  sceneStyle: { backgroundColor: color.background.page },
} as const
