import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { Stack, router, type Href } from 'expo-router'
import { act, renderRouter, screen } from 'expo-router/testing-library'
import type { ReactNode } from 'react'
import { Text } from 'react-native'

import { DESTINATIONS } from '@/features/navigation/destinations'
import DrawerLayout from '../../app/(drawer)/_layout'

/**
 * Where each route file sits, and what that does to the URLs and to back.
 *
 * The drawer regroups the routes without renaming any of them (research D-003): sections
 * of the menu live under `app/(drawer)/`, and everything that opens over them stays in the
 * root stack. These tests hold both halves — that the files are where the list says, and
 * that the paths and back behaviour the rest of the app relies on survive the move.
 */

const APP = resolve(__dirname, '../../app')

/**
 * The route file an href resolves to, under a group or at the root: `/` is `index.tsx`,
 * `/entries` is `entries/index.tsx`, anything else is the path plus `.tsx`.
 */
function routeFile(href: Href, group: string): string {
  const path = String(href)
  const relative =
    path === '/'
      ? 'index.tsx'
      : existsSync(resolve(APP, group, `.${path}`))
        ? `.${path}/index.tsx`
        : `.${path}.tsx`
  return resolve(APP, group, relative)
}

describe('the route files', () => {
  it.each(DESTINATIONS.filter(({ presentation }) => presentation === 'section'))(
    'put the $key section inside the drawer',
    ({ href }) => {
      expect(existsSync(routeFile(href, '(drawer)'))).toBe(true)
      expect(existsSync(routeFile(href, '.'))).toBe(false)
    },
  )

  it.each(DESTINATIONS.filter(({ presentation }) => presentation === 'over'))(
    'keep $key outside the drawer, so it opens over it',
    ({ href }) => {
      expect(existsSync(routeFile(href, '.'))).toBe(true)
      expect(existsSync(routeFile(href, '(drawer)'))).toBe(false)
    },
  )
})

/** A stand-in screen that says which route it is. */
function named(name: string): () => ReactNode {
  return function Named() {
    return <Text>{name}</Text>
  }
}

/** The app's route layout with stand-in screens: the real drawer, the real grouping. */
const ROUTES = {
  _layout: () => <Stack screenOptions={{ headerShown: false }} />,
  '(drawer)/_layout': DrawerLayout,
  '(drawer)/index': named('Home'),
  '(drawer)/entries/index': named('History'),
  '(drawer)/statistics': named('Statistics'),
  '(drawer)/forecast': named('Forecast'),
  'entries/contribute': named('Contribute'),
  'entries/withdraw': named('Withdraw'),
  'entries/[id]': named('Edit entry'),
  'settings/goal': named('Goal'),
  'settings/reminders': named('Reminders'),
  'onboarding/expenses': named('Onboarding'),
}

/**
 * Renders the routes at `initialUrl` and returns a reader for the current pathname.
 *
 * The value `renderRouter` returns is kept and awaited, not awaited directly: under RNTL
 * v14 its helpers sit on the promise, and awaiting it hands back the result inside without
 * them (AP-018).
 */
async function renderAt(initialUrl: string): Promise<() => string> {
  const rendered = renderRouter(ROUTES, { initialUrl })
  await rendered
  return () => rendered.getPathname()
}

async function go(move: () => void): Promise<void> {
  await act(async () => {
    move()
  })
}

describe('the paths', () => {
  it.each([
    ['/', 'Home'],
    ['/entries', 'History'],
    ['/statistics', 'Statistics'],
    ['/forecast', 'Forecast'],
    ['/entries/contribute', 'Contribute'],
    ['/entries/withdraw', 'Withdraw'],
    ['/entries/an-entry', 'Edit entry'],
    ['/settings/goal', 'Goal'],
    ['/settings/reminders', 'Reminders'],
    ['/onboarding/expenses', 'Onboarding'],
  ])('%s still opens %s', async (path, name) => {
    const pathname = await renderAt(path)
    expect(screen.getByText(name)).toBeTruthy()
    expect(pathname()).toBe(path)
  })
})

describe('going back', () => {
  // FR-009. Two choices, so a back that retraced them would land on the first, not Home —
  // measured while planning: with `backBehavior: 'history'` this read `/statistics`.
  it('from a section returns Home, not to the section before it', async () => {
    const pathname = await renderAt('/')
    await go(() => router.navigate('/statistics'))
    await go(() => router.navigate('/forecast'))
    await go(() => router.back())
    expect(pathname()).toBe('/')
  })

  it('from a contribution opened on Home returns Home', async () => {
    const pathname = await renderAt('/')
    await go(() => router.push('/entries/contribute'))
    await go(() => router.back())
    expect(pathname()).toBe('/')
  })

  // A form opened from a section returns to that section, not Home: the root stack holds it
  // over the drawer rather than inside it.
  it('from a contribution opened on History returns to History', async () => {
    const pathname = await renderAt('/')
    await go(() => router.navigate('/entries'))
    await go(() => router.push('/entries/contribute'))
    await go(() => router.back())
    expect(pathname()).toBe('/entries')
  })
})
