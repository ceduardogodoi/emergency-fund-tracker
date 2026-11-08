import { Stack, router } from 'expo-router'
import { act, fireEvent, renderRouter, screen, within } from 'expo-router/testing-library'
import type { ReactNode } from 'react'

import { DESTINATIONS, type DestinationKey } from '@/features/navigation/destinations'
import { MenuButton } from '@/features/navigation/menu-button'
import { Screen, Text } from '@/ui/primitives'
import { strings } from '@/ui/strings'
import DrawerLayout from '../../app/(drawer)/_layout'

/**
 * The menu, inside the real drawer layout, over stand-in screens.
 *
 * The drawer is real because most of what the spec asks of the menu is the drawer's doing
 * or depends on it: what a screen reader can reach while it is open or closed (FR-010), and
 * whether it closes when something is chosen (FR-006). A menu rendered on its own could
 * pass every one of these while the app did something else. The screens are stand-ins
 * because what they show is not the menu's business — each section draws the real menu
 * button in the real `Screen` slot, which is.
 *
 * Whether the menu is open is read from the menu button's `expanded` state, which comes
 * from the drawer's own state. What a screen reader can reach is not asserted here: the
 * drawer hides the side not shown through animated props, driven by the open and close
 * animation, and under reanimated's Jest mock animated props never reach the view — so in
 * this environment nothing is ever hidden, open or closed. That half of FR-010 is the
 * drawer's own, and it is measured on a device with VoiceOver and TalkBack (T194).
 */

/** A section of the drawer: its name, and the button that opens the menu. */
function section(name: string): () => ReactNode {
  return function Section() {
    return (
      <Screen title={name} leading={<MenuButton />}>
        <Text>{`${name} content`}</Text>
      </Screen>
    )
  }
}

/** A screen that opens over the drawer: no menu button. */
function over(name: string): () => ReactNode {
  return function Over() {
    return <Text>{`${name} content`}</Text>
  }
}

const ROUTES = {
  _layout: () => <Stack screenOptions={{ headerShown: false }} />,
  '(drawer)/_layout': DrawerLayout,
  '(drawer)/index': section('Home'),
  '(drawer)/entries/index': section('History'),
  '(drawer)/statistics': section('Statistics'),
  '(drawer)/forecast': section('Forecast'),
  'settings/goal': over('Goal'),
  'settings/reminders': over('Reminders'),
}

/** What a test needs from a rendered router. */
interface Rendered {
  /** The pathname the router is on now. */
  readonly pathname: () => string
}

/**
 * Renders the app's routes at `initialUrl`.
 *
 * `renderRouter` hangs its helpers on the promise RNTL v14's `render` returns, so the
 * value is kept and awaited rather than awaited directly, which would hand back the inner
 * result with no `getPathname` on it (AP-018).
 */
async function renderAt(initialUrl: string): Promise<Rendered> {
  const rendered = renderRouter(ROUTES, { initialUrl })
  await rendered
  return { pathname: () => rendered.getPathname() }
}

/** The menu button of the section showing — the only one a test here renders at a time. */
function menuButton(): ReturnType<typeof screen.getByTestId> {
  return screen.getByTestId('menu-button')
}

async function openMenu(): Promise<void> {
  await fireEvent.press(screen.getByRole('button', { name: strings.navigation.open }))
}

/** A menu item, found the way a screen reader finds it: by role and name. */
function item(key: DestinationKey): ReturnType<typeof screen.getByRole> {
  return screen.getByRole('button', { name: strings.navigation.destinations[key] })
}

describe('the menu', () => {
  it('lists every destination, in order, once opened (FR-001)', async () => {
    await renderAt('/')
    await openMenu()
    const menu = screen.getByTestId('navigation-menu')
    expect(
      within(menu)
        .getAllByTestId(/^menu-item-[a-z]+$/)
        .map((element) => element.props.testID),
    ).toEqual(DESTINATIONS.map(({ key }) => `menu-item-${key}`))
    for (const { key } of DESTINATIONS) {
      expect(item(key)).toBeTruthy()
    }
  })

  // FR-007. Opened on Statistics rather than on Home: Home is first in the list, and what a
  // menu that ignored where it was would most likely mark (AP-002).
  it('marks the section it was opened on, and no other (FR-007)', async () => {
    await renderAt('/statistics')
    await openMenu()
    for (const { key } of DESTINATIONS) {
      const current = key === 'statistics'
      if (current) {
        expect(item(key)).toBeSelected()
      } else {
        expect(item(key)).not.toBeSelected()
      }
      // The bar is the mark a sighted reader sees, and a shape rather than a colour.
      expect(screen.queryByTestId(`menu-item-${key}-current`) !== null).toBe(current)
    }
  })

  // 001 FR-050: at the largest text size a label wraps; nothing may cut it short.
  it('never limits a label to a number of lines', async () => {
    await renderAt('/')
    await openMenu()
    for (const { key, label } of DESTINATIONS) {
      expect(within(item(key)).getByText(label).props.numberOfLines).toBeUndefined()
    }
  })
})

describe('choosing from the menu', () => {
  it('shows the section chosen, and closes (FR-006)', async () => {
    const rendered = await renderAt('/statistics')
    await openMenu()
    await fireEvent.press(item('forecast'))
    expect(rendered.pathname()).toBe('/forecast')
    expect(menuButton()).toBeCollapsed()
    expect(screen.getByText('Forecast content')).toBeTruthy()
  })

  it('closes and changes nothing else when the current section is chosen', async () => {
    const rendered = await renderAt('/statistics')
    await openMenu()
    await fireEvent.press(item('statistics'))
    expect(rendered.pathname()).toBe('/statistics')
    expect(menuButton()).toBeCollapsed()
    expect(screen.getByText('Statistics content')).toBeTruthy()
  })

  // The two forms open over the section the menu was opened on, and going back returns
  // there with the menu closed — not to Home, and not to an open menu.
  it.each(['goal', 'reminders'] as const)(
    'opens %s over the current section, and back returns to it',
    async (key) => {
      const rendered = await renderAt('/statistics')
      await openMenu()
      await fireEvent.press(item(key))
      expect(rendered.pathname()).toBe(
        DESTINATIONS.find((destination) => destination.key === key)?.href,
      )
      await act(async () => {
        router.back()
      })
      expect(rendered.pathname()).toBe('/statistics')
      expect(menuButton()).toBeCollapsed()
      expect(screen.getByText('Statistics content')).toBeTruthy()
    },
  )
})

describe('the menu button', () => {
  it('says what it opens, and that the menu is closed (FR-003)', async () => {
    await renderAt('/')
    expect(menuButton()).toBeCollapsed()
    expect(screen.getByRole('button', { name: strings.navigation.open })).toBe(menuButton())
  })

  it('says the menu is open once it is', async () => {
    await renderAt('/')
    await openMenu()
    expect(menuButton()).toBeExpanded()
  })
})
