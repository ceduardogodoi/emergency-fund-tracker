import { screen, userEvent, within } from '@testing-library/react-native'

import { calendarDate } from '@/domain/dates/calendar-date'
import { storageError } from '@/domain/errors/app-error'
import type { EntryType } from '@/domain/ledger/types'
import { money } from '@/domain/money/money'
import { err } from '@/domain/result'
import { strings } from '@/ui/strings'
import { createAppHarness, type AppHarness } from '@tests/support/app-harness'
import { expectOk } from '@tests/support/expect-result'
import StatisticsScreen from '../../app/(drawer)/statistics'

/**
 * The statistics view (FR-020 – FR-025), checked figure by figure against a hand
 * calculation of one fund — the same fund `tests/unit/domain/statistics/` works through.
 *
 * Today is the 15th of October. The fund:
 *
 *   May  opening 3 000,00
 *   Jun  contributions 500,00 and 200,00
 *   Jul  nothing
 *   Aug  contribution 700,00, withdrawal 150,00
 *   Sep  contribution 400,00
 *   Oct  contribution 100,00 on the 2nd, and 990,00 dated the 20th — after today
 */
const TODAY = '2026-10-15'

const mockPush = jest.fn()

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}))

let harness: AppHarness

beforeEach(() => {
  harness = createAppHarness(TODAY)
  mockPush.mockClear()
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

/** The fund described above. */
async function seedFund(): Promise<void> {
  await record('opening', 300_000, '2026-05-10')
  await record('contribution', 50_000, '2026-06-05')
  await record('contribution', 20_000, '2026-06-20')
  await record('contribution', 70_000, '2026-08-05')
  await record('withdrawal', 15_000, '2026-08-12')
  await record('contribution', 40_000, '2026-09-03')
  await record('contribution', 10_000, '2026-10-02')
  await record('contribution', 99_000, '2026-10-20')
}

/** An amount as the screen renders it. */
function shown(minorUnits: number): string {
  return harness.services.format.money(money(minorUnits))
}

/** The value a figure shows, found by the figure's own test id. */
function figure(testID: string): string {
  return within(screen.getByTestId(testID))
    .getAllByText(/./)
    .map((element) => element.props.children)
    .join(' | ')
}

describe('Statistics', () => {
  describe('over all time, the default', () => {
    beforeEach(async () => {
      await seedFund()
      await harness.render(<StatisticsScreen />)
      await screen.findByTestId('statistics-totals')
    })

    // FR-020, each against the hand calculation. The opening is not a contribution, and the
    // 990,00 dated the 20th has not happened (FR-033).
    it('states the totals', () => {
      expect(figure('figure-total-contributed')).toContain(shown(190_000))
      expect(figure('figure-total-withdrawn')).toContain(shown(15_000))
      expect(figure('figure-net-saved')).toContain(shown(175_000))
      expect(figure('figure-contribution-count')).toContain('5')
      expect(figure('figure-largest-contribution')).toContain(shown(70_000))
    })

    // Five complete months, May to September, holding 1 800,00. The caption says what the
    // figure divides by, so it can be checked.
    it('states the average over the complete months, and what it divides by', () => {
      expect(figure('figure-average-contribution')).toContain(shown(36_000))
      expect(figure('figure-average-contribution')).toContain(strings.statistics.averageBasis(5))
    })

    // August, September, and October so far: October has a contribution, so it counts.
    it('states the streaks', () => {
      expect(figure('figure-current-streak')).toContain(strings.statistics.streak(3))
      expect(figure('figure-longest-streak')).toContain(strings.statistics.streak(3))
    })

    // FR-023: the active period is labelled, in months, above the figures.
    it('labels the period it shows, with the months it covers', () => {
      const label = within(screen.getByTestId('statistics-period'))
      expect(label.getByText(strings.statistics.allTime)).toBeTruthy()
      expect(
        label.getByText(
          strings.statistics.covers(
            harness.services.format.month('2026-05'),
            harness.services.format.month('2026-10'),
          ),
        ),
      ).toBeTruthy()
    })

    it('offers every period, with all time chosen', () => {
      const options = screen.getAllByRole('radio')

      expect(options.map((option) => option.props.accessibilityLabel)).toEqual([
        strings.statistics.allTime,
        strings.statistics.recent(12),
        strings.statistics.recent(6),
        strings.statistics.recent(3),
      ])
      expect(screen.getByRole('radio', { name: strings.statistics.allTime })).toBeSelected()
    })
  })

  // FR-023's scenario: every figure recalculates for the period, and the label says which.
  // July, August, and September — the month in progress is not in a recent period.
  it('recalculates every figure when the period changes', async () => {
    await seedFund()
    await harness.render(<StatisticsScreen />)
    await screen.findByTestId('statistics-totals')

    await userEvent.press(screen.getByRole('radio', { name: strings.statistics.recent(3) }))

    expect(screen.getByRole('radio', { name: strings.statistics.recent(3) })).toBeSelected()
    expect(
      within(screen.getByTestId('statistics-period')).getByText(strings.statistics.recent(3)),
    ).toBeTruthy()
    expect(figure('figure-total-contributed')).toContain(shown(110_000))
    expect(figure('figure-total-withdrawn')).toContain(shown(15_000))
    expect(figure('figure-net-saved')).toContain(shown(95_000))
    expect(figure('figure-contribution-count')).toContain('2')
    expect(figure('figure-average-contribution')).toContain(shown(36_666))
    expect(figure('figure-average-contribution')).toContain(strings.statistics.averageBasis(3))
    expect(figure('figure-current-streak')).toContain(strings.statistics.streak(2))
    expect(screen.getAllByTestId('month-row')).toHaveLength(3)
  })

  // FR-025, for the whole view: before the first contribution there is nothing to state,
  // and the screen says what will appear and how to make it appear. An opening balance
  // alone is the state every user leaves setup in.
  it('explains what will appear before the first contribution, and offers one', async () => {
    await record('opening', 300_000, '2026-10-01')
    await harness.render(<StatisticsScreen />)

    expect(await screen.findByText(strings.statistics.emptyTitle)).toBeTruthy()
    expect(screen.getByText(strings.statistics.emptyBody)).toBeTruthy()
    expect(screen.queryByTestId('statistics-totals')).toBeNull()

    await userEvent.press(screen.getByRole('button', { name: strings.home.contributeAction }))
    expect(mockPush).toHaveBeenCalledWith('/entries/contribute')
  })

  describe('a figure with too little history to state (FR-025)', () => {
    // History that began this month has no complete month to average over. The average
    // says when it will appear rather than showing zero, which would read as "you save
    // nothing".
    it('says when the average will appear', async () => {
      await record('contribution', 10_000, '2026-10-02')
      await harness.render(<StatisticsScreen />)
      await screen.findByTestId('statistics-totals')

      expect(figure('figure-average-contribution')).toContain(strings.statistics.averageUnavailable)
      expect(figure('figure-total-contributed')).toContain(shown(10_000))
    })

    // A recent period over history younger than one complete month has no months at all,
    // and says so in place of a column of zeros.
    it('says a recent period has no complete month yet', async () => {
      await record('contribution', 10_000, '2026-10-02')
      await harness.render(<StatisticsScreen />)
      await screen.findByTestId('statistics-totals')

      await userEvent.press(screen.getByRole('radio', { name: strings.statistics.recent(3) }))

      expect(screen.getByText(strings.statistics.periodEmpty)).toBeTruthy()
      expect(screen.queryByTestId('statistics-totals')).toBeNull()
    })

    // A withdrawal with no contribution beside it: there is a total to state, and no
    // largest contribution — which says so rather than "R$ 0,00".
    it('says there is no largest contribution in a period without one', async () => {
      await record('withdrawal', 15_000, '2026-10-02')
      await harness.render(<StatisticsScreen />)
      await screen.findByTestId('statistics-totals')

      expect(figure('figure-largest-contribution')).toContain(strings.statistics.noContribution)
      expect(figure('figure-total-withdrawn')).toContain(shown(15_000))
    })
  })

  // A ledger that cannot be read is the error state, never statistics of nothing.
  it('shows the error state when the ledger cannot be read, and retries', async () => {
    const ledger = harness.repositories.ledger
    const list = ledger.list.bind(ledger)
    const failing = jest
      .spyOn(ledger, 'list')
      .mockResolvedValue(err(storageError('ledger.list-failed')))
    await seedFund()
    await harness.render(<StatisticsScreen />)

    expect(await screen.findByText(strings.state.errorTitle)).toBeTruthy()
    expect(screen.queryByTestId('statistics-totals')).toBeNull()

    failing.mockImplementation(list)
    await userEvent.press(screen.getByRole('button', { name: strings.action.retry }))
    expect(await screen.findByTestId('statistics-totals')).toBeTruthy()
  })
})
