import { screen, userEvent, waitFor, within } from '@testing-library/react-native'
import type { RedirectProps } from 'expo-router'

import { queryKeys } from '@/runtime/query'
import { calendarDate } from '@/domain/dates/calendar-date'
import { storageError } from '@/domain/errors/app-error'
import type { GoalInput } from '@/domain/goal/types'
import type { EntryType } from '@/domain/ledger/types'
import { money } from '@/domain/money/money'
import { err } from '@/domain/result'
import { strings } from '@/ui/strings'
import { createAppHarness, type AppHarness } from '@tests/support/app-harness'
import { expectOk } from '@tests/support/expect-result'
import ForecastScreen from '../../app/forecast'

/**
 * The forecast screen (FR-026 – FR-032) in each of the four states the domain can put it
 * in, with every figure checked against a hand calculation.
 *
 * Today is the 15th of October, so the pace window is April to September. The fund most
 * tests use, against a target of 12 000,00:
 *
 *   Apr  opening 3 000,00 on the 2nd, contribution 500,00 on the 5th
 *   May–Sep  contribution 500,00 on the 5th of each
 *   Oct  contribution 200,00 on the 2nd — in the balance, not in the pace
 *
 *   balance    3 000 + 6 × 500 + 200 = 6 200,00, so 5 800,00 remains
 *   pace       3 000,00 over 6 months = 500,00 a month (the opening is not saving)
 *   months     5 800 ÷ 500 = 11,6, rounded up to 12 — October 2027, ending on the 31st
 */
const TODAY = '2026-10-15'
const TARGET = 1_200_000

const mockPush = jest.fn()
const mockRedirect = jest.fn()

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  Redirect: ({ href }: RedirectProps) => {
    mockRedirect(href)
    return null
  },
}))

let harness: AppHarness

beforeEach(() => {
  harness = createAppHarness(TODAY)
  mockPush.mockClear()
  mockRedirect.mockClear()
})

afterEach(async () => {
  await harness.teardown()
})

/** Stores a goal. The target and the desired date are what a forecast reads. */
async function storeGoal(overrides: Partial<GoalInput> = {}): Promise<void> {
  expectOk(
    await harness.repositories.goal.save({
      target: money(TARGET),
      source: 'calculated',
      levelKey: 'balanced',
      coverageMonths: 6,
      desiredCompletionDate: null,
      ...overrides,
    }),
  )
}

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
async function seedSteadyFund(): Promise<void> {
  await record('opening', 300_000, '2026-04-02')
  for (const month of ['04', '05', '06', '07', '08', '09']) {
    await record('contribution', 50_000, `2026-${month}-05`)
  }
  await record('contribution', 20_000, '2026-10-02')
}

/** An amount as the screen renders it. */
function shown(minorUnits: number): string {
  return harness.services.format.money(money(minorUnits))
}

/** Every text inside an element, joined, for asserting what a card says. */
function textOf(testID: string): string {
  return within(screen.getByTestId(testID))
    .getAllByText(/./)
    .map((element) => element.props.children)
    .join(' | ')
}

/** What every ledger write does once it lands: refresh the entries every reader shares. */
async function refreshLedger(): Promise<void> {
  await harness.queryClient.invalidateQueries({ queryKey: queryKeys.entries() })
}

describe('Forecast', () => {
  describe('with a pace to project from', () => {
    beforeEach(async () => {
      await storeGoal()
      await seedSteadyFund()
      await harness.render(<ForecastScreen />)
      await screen.findByTestId('forecast-projected')
    })

    // FR-027: as a date and as a number of months away.
    it('states the projected date and how many months away it is', () => {
      const card = textOf('forecast-projected')
      expect(card).toContain(harness.services.format.date(calendarDate('2027-10-31')))
      expect(card).toContain(strings.forecast.monthsAway(12))
    })

    // FR-028: the pace and the assumption, beside the date. The pace leaves out the opening
    // balance and October, so it is 500,00 — not 1 000,00, and not anything with 200,00 in it.
    it('states the pace it assumes continues, beside the date', () => {
      expect(textOf('forecast-projected')).toContain(strings.forecast.assumption(shown(50_000), 6))
    })

    it('states what remains to be saved', () => {
      expect(textOf('forecast-projected')).toContain(strings.home.remaining(shown(580_000)))
    })

    it('offers to set a desired date when there is none', async () => {
      await userEvent.press(screen.getByRole('button', { name: strings.forecast.desiredSetAction }))
      expect(mockPush).toHaveBeenCalledWith('/settings/goal')
    })
  })

  // Spec, Story 4 scenario 2 and FR-032: the projection follows the ledger. A withdrawal of
  // 600,00 in September takes the pace to 400,00 and the remaining amount to 6 400,00 —
  // 16 months, February 2028.
  it('recalculates the date and the pace when an entry changes', async () => {
    await storeGoal()
    await seedSteadyFund()
    await harness.render(<ForecastScreen />)
    await screen.findByTestId('forecast-projected')

    await record('withdrawal', 60_000, '2026-09-20')
    await refreshLedger()

    await waitFor(() => {
      expect(textOf('forecast-projected')).toContain(strings.forecast.monthsAway(16))
    })
    expect(textOf('forecast-projected')).toContain(
      harness.services.format.date(calendarDate('2028-02-29')),
    )
    expect(textOf('forecast-projected')).toContain(strings.forecast.assumption(shown(40_000), 6))
  })

  // Spec, Story 4 scenario 6: a larger target moves the date later. 15 000,00 leaves
  // 8 800,00, which is 18 months at 500,00 — April 2028.
  it('moves the date later when the target rises', async () => {
    await storeGoal()
    await seedSteadyFund()
    await harness.render(<ForecastScreen />)
    await screen.findByTestId('forecast-projected')

    await storeGoal({ target: money(1_500_000) })
    await harness.queryClient.invalidateQueries({ queryKey: queryKeys.goal() })

    await waitFor(() => {
      expect(textOf('forecast-projected')).toContain(strings.forecast.monthsAway(18))
    })
    expect(textOf('forecast-projected')).toContain(
      harness.services.format.date(calendarDate('2028-04-30')),
    )
  })

  // FR-029: two complete months, August and September, against the three needed — and no
  // date, however confident the two months look.
  it('says how much more history it needs before projecting', async () => {
    await storeGoal()
    await record('contribution', 90_000, '2026-08-05')
    await record('contribution', 90_000, '2026-09-05')
    await harness.render(<ForecastScreen />)

    expect(await screen.findByTestId('forecast-insufficient')).toBeTruthy()
    const card = textOf('forecast-insufficient')
    expect(card).toContain(strings.forecast.insufficientTitle)
    expect(card).toContain(strings.forecast.insufficientBody(1))
    expect(card).toContain(strings.forecast.insufficientHelp(3, 2))
    expect(screen.queryByTestId('forecast-projected')).toBeNull()
  })

  // FR-030: more left than came in over the window. The screen says why there is no date
  // and offers the contribution that would bring one back.
  it('explains a pace of zero or less, and offers a contribution', async () => {
    await storeGoal()
    await record('opening', 500_000, '2026-07-01')
    await record('contribution', 30_000, '2026-08-05')
    await record('withdrawal', 100_000, '2026-08-10')
    await harness.render(<ForecastScreen />)

    expect(await screen.findByTestId('forecast-no-pace')).toBeTruthy()
    expect(textOf('forecast-no-pace')).toContain(strings.forecast.noPaceBody)
    expect(screen.queryByTestId('forecast-projected')).toBeNull()

    await userEvent.press(screen.getByRole('button', { name: strings.home.contributeAction }))
    expect(mockPush).toHaveBeenCalledWith('/entries/contribute')
  })

  // A fund that opened at its target has one month of history, and still nothing to wait for.
  it('says the target is reached rather than asking for history', async () => {
    await storeGoal()
    await record('opening', 1_250_000, '2026-09-01')
    await harness.render(<ForecastScreen />)

    expect(await screen.findByTestId('forecast-reached')).toBeTruthy()
    expect(textOf('forecast-reached')).toContain(strings.forecast.reachedBody)
    expect(screen.queryByTestId('forecast-insufficient')).toBeNull()
  })

  describe('a desired completion date (FR-031)', () => {
    // November to March is five months: 5 800,00 ÷ 5 = 1 160,00 a month, more than 500,00.
    it('states the contribution it requires and that it exceeds the pace', async () => {
      await storeGoal({ desiredCompletionDate: calendarDate('2027-03-31') })
      await seedSteadyFund()
      await harness.render(<ForecastScreen />)

      const card = await screen.findByTestId('forecast-desired')
      expect(within(card).getByText(strings.forecast.desiredHeading)).toBeTruthy()
      const text = textOf('forecast-desired')
      expect(text).toContain(
        strings.forecast.desiredTarget(harness.services.format.month('2027-03')),
      )
      expect(text).toContain(strings.forecast.desiredRequired(shown(116_000)))
      expect(text).toContain(strings.forecast.desiredExceeds(shown(50_000)))
    })

    // Twenty months, November 2026 to June 2028: 290,00 a month, inside the pace.
    it('says when the pace already covers it', async () => {
      await storeGoal({ desiredCompletionDate: calendarDate('2028-06-30') })
      await seedSteadyFund()
      await harness.render(<ForecastScreen />)

      await screen.findByTestId('forecast-desired')
      expect(textOf('forecast-desired')).toContain(strings.forecast.desiredRequired(shown(29_000)))
      expect(textOf('forecast-desired')).toContain(strings.forecast.desiredWithin(shown(50_000)))
    })

    it('offers to change the date', async () => {
      await storeGoal({ desiredCompletionDate: calendarDate('2027-03-31') })
      await seedSteadyFund()
      await harness.render(<ForecastScreen />)

      await userEvent.press(
        await screen.findByRole('button', { name: strings.forecast.desiredChangeAction }),
      )
      expect(mockPush).toHaveBeenCalledWith('/settings/goal')
    })

    // A stored date passes as time does. It is said, not divided by.
    it('says a date that has passed has passed', async () => {
      await storeGoal({ desiredCompletionDate: calendarDate('2026-09-30') })
      await seedSteadyFund()
      await harness.render(<ForecastScreen />)

      await screen.findByTestId('forecast-desired')
      expect(textOf('forecast-desired')).toContain(strings.forecast.desiredPassed)
    })

    // With too little history there is no pace to compare with — but the amount stands.
    it('states the amount without a comparison before there is a pace', async () => {
      await storeGoal({ desiredCompletionDate: calendarDate('2027-03-31') })
      await record('contribution', 100_000, '2026-09-05')
      await harness.render(<ForecastScreen />)

      await screen.findByTestId('forecast-desired')
      expect(textOf('forecast-desired')).toContain(strings.forecast.desiredRequired(shown(220_000)))
      expect(textOf('forecast-desired')).toContain(strings.forecast.desiredUnmeasured)
    })
  })

  it('sends a user with no goal to setup', async () => {
    await harness.render(<ForecastScreen />)
    await waitFor(() => {
      expect(mockRedirect).toHaveBeenCalledWith('/onboarding/expenses')
    })
  })

  // A ledger that cannot be read is the error state, never a forecast of nothing.
  it('shows the error state when the ledger cannot be read, and retries', async () => {
    await storeGoal()
    await seedSteadyFund()
    const ledger = harness.repositories.ledger
    const list = ledger.list.bind(ledger)
    const failing = jest
      .spyOn(ledger, 'list')
      .mockResolvedValue(err(storageError('ledger.list-failed')))
    await harness.render(<ForecastScreen />)

    expect(await screen.findByText(strings.state.errorTitle)).toBeTruthy()
    expect(screen.queryByTestId('forecast-projected')).toBeNull()

    failing.mockImplementation(list)
    await userEvent.press(screen.getByRole('button', { name: strings.action.retry }))
    expect(await screen.findByTestId('forecast-projected')).toBeTruthy()
  })
})
