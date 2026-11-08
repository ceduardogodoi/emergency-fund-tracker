import { screen } from '@testing-library/react-native'
import type { RedirectProps } from 'expo-router'
import type { ReactNode } from 'react'
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native'

import { queryKeys } from '@/runtime/query'
import { calendarDate } from '@/domain/dates/calendar-date'
import type { LedgerEntryInput } from '@/domain/ledger/types'
import { money } from '@/domain/money/money'
import { SCREEN_TITLE_ROW_TEST_ID } from '@/ui/primitives'
import { createAppHarness, type AppHarness } from '@tests/support/app-harness'
import { expectOk } from '@tests/support/expect-result'
import HomeScreen from '../../app/(drawer)/index'
import HistoryScreen from '../../app/(drawer)/entries/index'
import ForecastScreen from '../../app/(drawer)/forecast'
import StatisticsScreen from '../../app/(drawer)/statistics'
import EditEntryScreen from '../../app/entries/[id]'
import ContributeScreen from '../../app/entries/contribute'
import WithdrawScreen from '../../app/entries/withdraw'
import ExpensesScreen from '../../app/onboarding/expenses'
import LevelScreen from '../../app/onboarding/level'
import OpeningBalanceScreen from '../../app/onboarding/opening-balance'
import GoalRevisionScreen from '../../app/settings/goal'
import RemindersScreen from '../../app/settings/reminders'

/**
 * FR-050: every screen stays whole and usable at the largest text size the platform offers.
 *
 * Jest lays nothing out, so a test cannot see text at three times its size, and nothing in
 * the app reads the font scale for a mock of it to change. What a test can hold is each
 * screen's side of the bargain — the conditions under which the platform's text size can
 * grow without cutting anything off — read from the host tree the screen renders:
 *
 * - every text scales with the platform: no opt-out, no ceiling, no shrinking to fit;
 * - no text is cut to a number of lines;
 * - no text sits in a box of fixed height or width, which the grown text would overflow;
 * - everything sits inside something that scrolls, so what grows past the screen is still
 *   reachable — except the screen's title row. On a screen whose list scrolls itself
 *   (History), `Screen` draws the title above the list. It stays at the top, never pushed
 *   out of reach by what is below it, so nothing is clipped or unreachable, which is what
 *   FR-050 asks; it does take a fixed share of the screen at the largest size.
 *
 * Whether the result reads well is a device question — T190 looked at the menu at the
 * largest sizes, and found a one-word title breaking mid-word (T196).
 */

const mockParams: Record<string, string> = {}

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: jest.fn(),
    push: jest.fn(),
    replace: jest.fn(),
    canGoBack: () => true,
  }),
  useLocalSearchParams: () => mockParams,
  Redirect: ({ href }: RedirectProps) => {
    throw new Error(`The screen redirected to ${String(href)}; the fixture is incomplete`)
  },
}))

// The real button reads the drawer it sits in, and the sections are rendered here without
// one. What the button does is tested with the real drawer in `navigation-menu.test.tsx`.
jest.mock('@/features/navigation/menu-button', () => ({
  MenuButton: () =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react').createElement(require('react-native').View, { testID: 'menu-button' }),
}))

const TODAY = '2026-08-22'

let harness: AppHarness

beforeEach(() => {
  harness = createAppHarness(TODAY)
  for (const key of Object.keys(mockParams)) {
    delete mockParams[key]
  }
})

afterEach(async () => {
  await harness.teardown()
})

/** Records one entry, straight into storage, and returns its id. */
async function record(entry: Partial<LedgerEntryInput>): Promise<string> {
  const stored = expectOk(
    await harness.repositories.ledger.add({
      type: 'contribution',
      amount: money(50_000),
      date: calendarDate('2026-03-05'),
      note: null,
      withdrawalReason: null,
      ...entry,
    }),
  )
  return stored.id
}

/**
 * A fund that shows as much as each screen can show at once: a goal with a desired date, an
 * opening balance, five months of contributions, a withdrawal with a reason and a note still
 * to be restored, an enabled weekly reminder, and a milestone just crossed. More on screen
 * is more text that has to hold up.
 */
async function seedFullestFund(): Promise<string> {
  expectOk(
    await harness.repositories.profile.save({
      monthlyExpenses: money(200_000),
      currency: harness.services.currency,
    }),
  )
  expectOk(
    await harness.repositories.goal.save({
      target: money(1_200_000),
      source: 'calculated',
      levelKey: 'balanced',
      coverageMonths: 6,
      desiredCompletionDate: calendarDate('2027-12-31'),
    }),
  )
  await record({ type: 'opening', amount: money(300_000), date: calendarDate('2026-02-10') })
  for (const month of ['03', '04', '05', '06', '07']) {
    await record({ date: calendarDate(`2026-${month}-05`), note: 'Depósito do mês' })
  }
  const withdrawal = await record({
    type: 'withdrawal',
    amount: money(120_000),
    date: calendarDate('2026-08-12'),
    withdrawalReason: 'Conserto do carro',
    note: 'Troca da embreagem, orçamento de três oficinas',
  })
  expectOk(
    await harness.repositories.reminders.save({
      enabled: true,
      frequency: 'weekly',
      dayOfMonth: null,
      dayOfWeek: 4,
      timeOfDay: '07:45',
    }),
  )
  harness.queryClient.setQueryData(queryKeys.milestoneReached(), 50)
  return withdrawal
}

/** A host element as `toJSON` gives it: its type, its props, and what it contains. */
interface HostNode {
  readonly type: string
  readonly props: { readonly style?: StyleProp<ViewStyle> } & Record<string, unknown>
  readonly children: readonly (HostNode | string)[] | null
}

/** Every host `Text`, with the host elements around it from the root down. */
function textsWithAncestors(): { text: HostNode; ancestors: HostNode[] }[] {
  const found: { text: HostNode; ancestors: HostNode[] }[] = []
  const visit = (node: HostNode | string, ancestors: HostNode[]): void => {
    if (typeof node === 'string') {
      return
    }
    if (node.type === 'Text') {
      found.push({ text: node, ancestors })
    }
    for (const child of node.children ?? []) {
      visit(child, [...ancestors, node])
    }
  }
  const root = screen.toJSON() as HostNode | HostNode[] | null
  for (const node of Array.isArray(root) ? root : root === null ? [] : [root]) {
    visit(node, [])
  }
  return found
}

/** What a text says, for a failure message that names it. */
function words(node: HostNode): string {
  return (node.children ?? [])
    .map((child) => (typeof child === 'string' ? child : words(child)))
    .join('')
}

/** The size a box is held to, if any — the dimensions grown text would overflow. */
function fixedSize(node: HostNode): string | null {
  const style = StyleSheet.flatten(node.props.style) ?? {}
  const held = (['height', 'maxHeight', 'width', 'maxWidth'] as const).filter(
    (property) => typeof style[property] === 'number',
  )
  return held.length === 0
    ? null
    : held.map((property) => `${property} ${String(style[property])}`).join(', ')
}

/** How a text itself could fail to grow with the platform's text size. */
function sizingProblems(text: HostNode, said: string): string[] {
  const { allowFontScaling, maxFontSizeMultiplier, adjustsFontSizeToFit, numberOfLines } =
    text.props
  return [
    allowFontScaling === false && `${said} does not scale with the platform's text size`,
    typeof maxFontSizeMultiplier === 'number' &&
      maxFontSizeMultiplier > 0 &&
      `${said} stops growing at ${String(maxFontSizeMultiplier)}×`,
    adjustsFontSizeToFit === true && `${said} shrinks to fit rather than growing`,
    typeof numberOfLines === 'number' &&
      numberOfLines > 0 &&
      `${said} is cut to ${String(numberOfLines)} line(s)`,
  ].filter((problem): problem is string => typeof problem === 'string')
}

/** How where a text sits could cut it off, or put it out of reach, once it has grown. */
function placementProblems(ancestors: readonly HostNode[], said: string): string[] {
  const boxed = ancestors.flatMap((ancestor) => {
    const size = fixedSize(ancestor)
    return size === null ? [] : [`${said} sits in a box held to ${size}`]
  })
  const scrolls = ancestors.some((ancestor) => ancestor.type === 'RCTScrollView')
  const isTitle = ancestors.some((ancestor) => ancestor.props.testID === SCREEN_TITLE_ROW_TEST_ID)
  return scrolls || isTitle ? boxed : [...boxed, `${said} is outside anything that scrolls`]
}

/**
 * Every way the screen's text could fail to grow, or grow out of sight, as a list of
 * readable findings — empty when the screen holds up. A list rather than a boolean, so a
 * failure says which text and why.
 */
function findings(): string[] {
  const texts = textsWithAncestors()
  // A screen that rendered no text has not been tested, whatever the list below says.
  expect(texts.length).toBeGreaterThan(0)
  return texts.flatMap(({ text, ancestors }) => {
    const said = JSON.stringify(words(text))
    return [...sizingProblems(text, said), ...placementProblems(ancestors, said)]
  })
}

/** Each screen: how to render it in its fullest state, and what shows once it has. */
const SCREENS: readonly {
  readonly name: string
  readonly ready: string
  readonly render: () => Promise<ReactNode>
}[] = [
  {
    name: 'Home',
    ready: 'recovery-card',
    render: async () => (await seedFullestFund(), (<HomeScreen />)),
  },
  {
    name: 'History',
    ready: 'entry-row',
    render: async () => (await seedFullestFund(), (<HistoryScreen />)),
  },
  {
    name: 'Statistics',
    ready: 'statistics-totals',
    render: async () => (await seedFullestFund(), (<StatisticsScreen />)),
  },
  {
    name: 'Forecast',
    ready: 'forecast-desired',
    render: async () => (await seedFullestFund(), (<ForecastScreen />)),
  },
  {
    name: 'Contribute',
    ready: 'amount-input',
    render: async () => (await seedFullestFund(), (<ContributeScreen />)),
  },
  {
    name: 'Withdraw',
    ready: 'amount-input',
    render: async () => (await seedFullestFund(), (<WithdrawScreen />)),
  },
  {
    name: 'Edit entry',
    ready: 'delete-entry',
    render: async () => {
      mockParams.id = await seedFullestFund()
      return <EditEntryScreen />
    },
  },
  { name: 'Onboarding: expenses', ready: 'expenses-input', render: async () => <ExpensesScreen /> },
  {
    name: 'Onboarding: level',
    ready: 'level-balanced',
    render: async () => {
      mockParams.expenses = '200000'
      return <LevelScreen />
    },
  },
  {
    name: 'Onboarding: opening balance',
    ready: 'opening-input',
    render: async () => {
      expectOk(
        await harness.repositories.goal.save({
          target: money(1_200_000),
          source: 'calculated',
          levelKey: 'balanced',
          coverageMonths: 6,
          desiredCompletionDate: null,
        }),
      )
      return <OpeningBalanceScreen />
    },
  },
  {
    name: 'Goal',
    ready: 'desired-date-field',
    render: async () => (await seedFullestFund(), (<GoalRevisionScreen />)),
  },
  {
    name: 'Reminders',
    ready: 'reminder-summary',
    render: async () => (await seedFullestFund(), (<RemindersScreen />)),
  },
]

describe('at the largest text size (FR-050)', () => {
  it.each(SCREENS)('$name lets every text grow, whole and reachable', async ({ ready, render }) => {
    await harness.render(await render())
    await screen.findAllByTestId(ready)

    expect(findings()).toEqual([])
  })
})
