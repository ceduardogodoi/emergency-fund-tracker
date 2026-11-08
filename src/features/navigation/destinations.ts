import type { Href } from 'expo-router'

import { strings } from '@/ui/strings'

/**
 * Which destination an entry is.
 *
 * Derived from the strings module rather than written out again, so a destination cannot
 * be added here without a name to show for it, or named there without being offered here.
 */
export type DestinationKey = keyof typeof strings.navigation.destinations

/**
 * How a destination opens.
 *
 * - `section`: a screen of the drawer. It shows the menu button, and back from it returns
 *   Home.
 * - `over`: pushed over whatever screen the menu was opened on, with no menu button, and
 *   back or saving returns there. For the two forms, so an abandoned edit is discarded on
 *   leaving rather than kept alive by the drawer (spec, Clarifications, 2026-11-08).
 */
export type Presentation = 'section' | 'over'

/** One entry in the navigation menu. */
export interface Destination {
  /** Identity; the menu item's test id is `menu-item-<key>`. */
  readonly key: DestinationKey
  /** The name shown and announced. */
  readonly label: string
  /** Where it leads — the path the app already used before the menu existed. */
  readonly href: Href
  /** Whether it opens as a section of the menu or over the current screen. */
  readonly presentation: Presentation
}

/**
 * Every place the menu offers, in the order it offers them (FR-001).
 *
 * The data behind the menu, and nothing else: which one is current is the drawer's to say
 * (specs/002-drawer-navigation/data-model.md), and how each is drawn is the menu's.
 */
export const DESTINATIONS: readonly Destination[] = [
  { key: 'home', label: strings.navigation.destinations.home, href: '/', presentation: 'section' },
  {
    key: 'history',
    label: strings.navigation.destinations.history,
    href: '/entries',
    presentation: 'section',
  },
  {
    key: 'statistics',
    label: strings.navigation.destinations.statistics,
    href: '/statistics',
    presentation: 'section',
  },
  {
    key: 'forecast',
    label: strings.navigation.destinations.forecast,
    href: '/forecast',
    presentation: 'section',
  },
  {
    key: 'goal',
    label: strings.navigation.destinations.goal,
    href: '/settings/goal',
    presentation: 'over',
  },
  {
    key: 'reminders',
    label: strings.navigation.destinations.reminders,
    href: '/settings/reminders',
    presentation: 'over',
  },
]
