import { screen, userEvent } from '@testing-library/react-native'

import { calendarDate } from '@/domain/dates/calendar-date'
import type { EntryType } from '@/domain/ledger/types'
import { money } from '@/domain/money/money'
import { strings } from '@/ui/strings'
import { createAppHarness, type AppHarness } from '@tests/support/app-harness'
import { expectOk } from '@tests/support/expect-result'
import StatisticsScreen from '../../app/(drawer)/statistics'

/**
 * The month-by-month breakdown, as a screen reader meets it (FR-049).
 *
 * This release has no charts (research D-011, amended), so the list is not an equivalent
 * of a picture — it is the content. Each month is one stop, read as one sentence in the
 * order the row is laid out: a reader moving through the list hears a month at a time,
 * not a label and then a figure that could belong to either neighbour.
 *
 * Today is the 15th of October, with the fund the statistics tests use.
 */
const TODAY = '2026-10-15'

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

// The real button reads the drawer it sits in, and the screen is rendered here without one.
// What the button does is tested with the real drawer in `navigation-menu.test.tsx`.
jest.mock('@/features/navigation/menu-button', () => ({
  MenuButton: () =>
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react').createElement(require('react-native').View, { testID: 'menu-button' }),
}))

let harness: AppHarness

beforeEach(async () => {
  harness = createAppHarness(TODAY)
  await record('opening', 300_000, '2026-05-10')
  await record('contribution', 50_000, '2026-06-05')
  await record('contribution', 20_000, '2026-06-20')
  await record('contribution', 70_000, '2026-08-05')
  await record('withdrawal', 15_000, '2026-08-12')
  await record('contribution', 40_000, '2026-09-03')
  await record('contribution', 10_000, '2026-10-02')
  await record('contribution', 99_000, '2026-10-20')
})

afterEach(async () => {
  await harness.teardown()
})

/** Records one entry, straight into storage. */
async function record(type: EntryType, minorUnits: number, date: string): Promise<void> {
  expectOk(
    await harness.repositories.ledger.add({
      type,
      amount: money(minorUnits),
      date: calendarDate(date),
      note: null,
      withdrawalReason: type === 'withdrawal' ? 'Conserto do carro' : null,
    }),
  )
}

/** The sentence a closed month is read as. */
function closedMonth(
  month: string,
  contributed: number,
  withdrawn: number,
  balance: number,
): string {
  const { format } = harness.services
  return strings.statistics.monthSummary(
    format.month(month),
    format.money(money(contributed)),
    format.money(money(withdrawn)),
    format.money(money(balance)),
    false,
  )
}

describe('the month-by-month breakdown, read aloud', () => {
  // Most recent first, as the history is: what a reader comes to check is the month just
  // gone. July had nothing and is still a stop (FR-022). October is still running, so its
  // balance is today's and the sentence says so; the 990,00 dated the 20th is not in it.
  it('reads each month as one sentence, most recent first', async () => {
    const { format } = harness.services
    await harness.render(<StatisticsScreen />)
    await screen.findByTestId('statistics-breakdown')

    expect(screen.getAllByTestId('month-row').map((row) => row.props.accessibilityLabel)).toEqual([
      strings.statistics.monthSummary(
        format.month('2026-10'),
        format.money(money(10_000)),
        format.money(money(0)),
        format.money(money(475_000)),
        true,
      ),
      closedMonth('2026-09', 40_000, 0, 465_000),
      closedMonth('2026-08', 70_000, 15_000, 425_000),
      closedMonth('2026-07', 0, 0, 370_000),
      closedMonth('2026-06', 70_000, 0, 370_000),
      closedMonth('2026-05', 0, 0, 300_000),
    ])
  })

  // One stop per month: the row is a single accessible element, so its label and figures
  // are not announced again one by one after the sentence.
  it('makes each month a single element', async () => {
    await harness.render(<StatisticsScreen />)
    await screen.findByTestId('statistics-breakdown')

    for (const row of screen.getAllByTestId('month-row')) {
      expect(row.props.accessible).toBe(true)
    }
  })

  // The sentence and the row say the same thing. A sighted reader sees the closing
  // balance the screen reader hears.
  it('shows the figures the sentence reads', async () => {
    await harness.render(<StatisticsScreen />)
    await screen.findByTestId('statistics-breakdown')

    expect(
      screen.getAllByText(harness.services.format.money(money(425_000))).length,
    ).toBeGreaterThan(0)
    expect(screen.getAllByText(strings.statistics.closingBalance)).toHaveLength(5)
    expect(screen.getAllByText(strings.statistics.balanceSoFar)).toHaveLength(1)
  })

  // The breakdown follows the period like everything else (FR-023), and the balance it
  // reads is still the real one, carried in from before the period.
  it('reads only the period chosen, with the real balance', async () => {
    await harness.render(<StatisticsScreen />)
    await screen.findByTestId('statistics-breakdown')

    await userEvent.press(screen.getByRole('radio', { name: strings.statistics.recent(3) }))

    expect(screen.getAllByTestId('month-row').map((row) => row.props.accessibilityLabel)).toEqual([
      closedMonth('2026-09', 40_000, 0, 465_000),
      closedMonth('2026-08', 70_000, 15_000, 425_000),
      closedMonth('2026-07', 0, 0, 370_000),
    ])
  })
})
