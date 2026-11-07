import { screen, userEvent, waitFor } from '@testing-library/react-native'
import type { RedirectProps } from 'expo-router'

import { queryKeys } from '@/runtime/query'
import { calendarDate, monthKey } from '@/domain/dates/calendar-date'
import { storageError } from '@/domain/errors/app-error'
import { money } from '@/domain/money/money'
import { err } from '@/domain/result'
import { strings } from '@/ui/strings'
import { createAppHarness, type AppHarness } from '@tests/support/app-harness'
import { filledUnits, meterUnits } from '@tests/support/coverage-meter'
import { expectOk } from '@tests/support/expect-result'
import HomeScreen from '../../app/index'

/**
 * Home is where first launch is decided, so both of its answers are tested here: the
 * redirect that sends a new user into setup, and the target a returning one sees.
 */
const TARGET_MINOR_UNITS = 1_200_000
const EXPENSES_MINOR_UNITS = 200_000

const mockRedirect = jest.fn()
const mockPush = jest.fn()

// Only the redirect is doubled, and only to record where it pointed. Rendering nothing in
// its place is what the real component does to this tree anyway — it navigates rather than
// drawing — so the assertion is about the destination, which is the whole decision.
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  Redirect: ({ href }: RedirectProps) => {
    mockRedirect(href)
    return null
  },
}))

let harness: AppHarness

beforeEach(() => {
  harness = createAppHarness()
  mockRedirect.mockClear()
  mockPush.mockClear()
})

afterEach(async () => {
  await harness.teardown()
})

/** Stores a goal, the way finishing onboarding would. */
async function storeGoal(): Promise<void> {
  await harness.repositories.profile.save({
    monthlyExpenses: money(EXPENSES_MINOR_UNITS),
    currency: harness.services.currency,
  })
  await harness.repositories.goal.save({
    target: money(TARGET_MINOR_UNITS),
    source: 'calculated',
    levelKey: 'balanced',
    coverageMonths: 6,
    desiredCompletionDate: null,
  })
}

/** Records contributions, the way the contribute screen would, dated before today. */
async function contribute(...amounts: number[]): Promise<void> {
  for (const amount of amounts) {
    expectOk(
      await harness.repositories.ledger.add({
        type: 'contribution',
        amount: money(amount),
        date: calendarDate('2026-08-01'),
        note: null,
        withdrawalReason: null,
      }),
    )
  }
}

/** An amount as Home renders it. */
function shown(minorUnits: number): string {
  return harness.services.format.money(money(minorUnits))
}

describe('Home', () => {
  // No stored goal means setup never finished. That is the only definition of first launch
  // that survives the app being deleted and reinstalled with its data restored — a flag
  // saying "onboarding done" would not.
  it('sends a user with no goal into setup', async () => {
    await harness.render(<HomeScreen />)

    // Waited for, and for the redirect itself. The title is drawn on the first render,
    // while the goal is still being read, so waiting for it waits for nothing: the
    // assertion then raced the read, and lost once on a slow CI runner.
    await waitFor(() => {
      expect(mockRedirect).toHaveBeenCalledWith('/onboarding/expenses')
    })
  })

  it('shows the stored target, and the choice behind it', async () => {
    await storeGoal()

    await harness.render(<HomeScreen />)

    expect(
      await screen.findByText(harness.services.format.money(money(TARGET_MINOR_UNITS))),
    ).toBeTruthy()
    expect(
      screen.getByText(
        strings.goal.levelSummary(strings.levels.balanced.name, strings.coverageDuration(6)),
      ),
    ).toBeTruthy()
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  // FR-006 asks for the target to be changeable, and a screen with no way in is a feature
  // that exists only in the route table. Home is where a returning user is, so this is
  // where the way in belongs.
  it('offers a way to change the target', async () => {
    await storeGoal()
    await harness.render(<HomeScreen />)
    await screen.findByTestId('goal-card')

    await userEvent.press(screen.getByRole('button', { name: strings.home.reviseAction }))

    expect(mockPush).toHaveBeenCalledWith('/settings/goal')
  })

  it('offers a way to record a contribution', async () => {
    await storeGoal()
    await harness.render(<HomeScreen />)
    await screen.findByTestId('standing-card')

    await userEvent.press(screen.getByRole('button', { name: strings.home.contributeAction }))

    expect(mockPush).toHaveBeenCalledWith('/entries/contribute')
  })

  // FR-014: the history exists to be read, and Home is the only screen a user is sure to see.
  it('offers a way to the history', async () => {
    await storeGoal()
    await harness.render(<HomeScreen />)
    await screen.findByTestId('standing-card')

    await userEvent.press(screen.getByRole('button', { name: strings.home.historyAction }))

    expect(mockPush).toHaveBeenCalledWith('/entries')
  })

  // FR-016: a withdrawal is recorded from where the balance is read, beside a contribution.
  it('offers a way to record a withdrawal', async () => {
    await storeGoal()
    await harness.render(<HomeScreen />)
    await screen.findByTestId('standing-card')

    await userEvent.press(screen.getByRole('button', { name: strings.home.withdrawAction }))

    expect(mockPush).toHaveBeenCalledWith('/entries/withdraw')
  })

  // FR-020 – FR-025 live on their own screen, and Home is the way in.
  it('offers a way to the statistics', async () => {
    await storeGoal()
    await harness.render(<HomeScreen />)
    await screen.findByTestId('standing-card')

    await userEvent.press(screen.getByRole('button', { name: strings.statistics.action }))

    expect(mockPush).toHaveBeenCalledWith('/statistics')
  })

  // FR-026 – FR-032 live on their own screen too, beside the statistics.
  it('offers a way to the forecast', async () => {
    await storeGoal()
    await harness.render(<HomeScreen />)
    await screen.findByTestId('standing-card')

    await userEvent.press(screen.getByRole('button', { name: strings.forecast.action }))

    expect(mockPush).toHaveBeenCalledWith('/forecast')
  })

  // Story 6: reminders are optional, so they are reached from Home rather than offered
  // during setup.
  it('offers a way to the reminders', async () => {
    await storeGoal()
    await harness.render(<HomeScreen />)
    await screen.findByTestId('standing-card')

    await userEvent.press(screen.getByRole('button', { name: strings.home.remindersAction }))

    expect(mockPush).toHaveBeenCalledWith('/settings/reminders')
  })

  // FR-024. A contribution returns here, so this is where the milestone it crossed is
  // shown. 50 rather than 25, so a banner that named the first threshold whatever it was
  // told would fail.
  it('shows the milestone the last save crossed, until dismissed', async () => {
    await storeGoal()
    harness.queryClient.setQueryData(queryKeys.milestoneReached(), 50)
    await harness.render(<HomeScreen />)

    expect(
      await screen.findByText(strings.milestones.title(50, harness.services.format.percent(50))),
    ).toBeTruthy()

    await userEvent.press(screen.getByRole('button', { name: strings.milestones.dismiss }))
    expect(screen.queryByTestId('milestone-banner')).toBeNull()
  })

  it('shows no milestone when the last save crossed none', async () => {
    await storeGoal()
    await harness.render(<HomeScreen />)
    await screen.findByTestId('standing-card')

    expect(screen.queryByTestId('milestone-banner')).toBeNull()
  })
})

/**
 * Where the fund stands (FR-013, FR-015).
 *
 * The figures are odd on purpose. A balance of 300.123 against 1.200.000 is 25,01%, so a
 * screen that rounded, or that showed the target where the balance belongs, or a remaining
 * that was not the difference, would each show a number these tests do not expect.
 */
describe('Home, once there is money in the fund', () => {
  it('shows the balance, what remains, and how far along the fund is', async () => {
    await storeGoal()
    await contribute(250_000, 50_123)

    await harness.render(<HomeScreen />)

    expect(await screen.findByText(shown(300_123))).toBeTruthy()
    expect(
      screen.getByText(strings.home.progress(harness.services.format.percent(25.01))),
    ).toBeTruthy()
    expect(screen.getByText(strings.home.remaining(shown(899_877)))).toBeTruthy()
    expect(screen.queryByText(strings.home.reached)).toBeNull()
  })

  it('starts from nothing, with the whole target still to save', async () => {
    await storeGoal()

    await harness.render(<HomeScreen />)

    expect(await screen.findByText(strings.home.remaining(shown(TARGET_MINOR_UNITS)))).toBeTruthy()
    expect(screen.getByText(strings.home.progress(harness.services.format.percent(0)))).toBeTruthy()
  })

  // One unit short. To nearest, 99,9999…% is 100% — beside a goal that has not been
  // reached. The domain stops it at 99,99.
  it('does not call a goal reached, or 100%, while anything remains', async () => {
    await storeGoal()
    await contribute(TARGET_MINOR_UNITS - 1)

    await harness.render(<HomeScreen />)

    expect(await screen.findByText(strings.home.remaining(shown(1)))).toBeTruthy()
    expect(screen.getByText(strings.home.progress('99,99%'))).toBeTruthy()
    expect(screen.queryByText(strings.home.reached)).toBeNull()
  })

  // FR-015: the surplus, never a negative remaining.
  it('shows the goal reached, and by how much it was passed', async () => {
    await storeGoal()
    await contribute(TARGET_MINOR_UNITS, 50_000)

    await harness.render(<HomeScreen />)

    expect(await screen.findByText(strings.home.reached)).toBeTruthy()
    expect(screen.getByText(strings.home.surplus(shown(50_000)))).toBeTruthy()
    expect(screen.queryByText(/Faltam/)).toBeNull()
  })

  // The spec's edge case: exactly the target is reached, with no surplus figure at all —
  // "R$ 0,00 além da meta" would be a sentence about nothing.
  it('at exactly the target, shows it reached with no surplus line', async () => {
    await storeGoal()
    await contribute(TARGET_MINOR_UNITS)

    await harness.render(<HomeScreen />)

    expect(await screen.findByText(strings.home.reached)).toBeTruthy()
    expect(screen.queryByText(strings.home.surplus(shown(0)))).toBeNull()
    expect(screen.queryByText(/Faltam/)).toBeNull()
  })

  // T157. R$ 5.900,00 is 2,95 months of R$ 2.000,00: to nearest that is three, so a meter
  // that rounded would fill one unit too many. Two of six, and the caption says both.
  it('fills the meter with the whole months the balance covers, and says how many of the plan', async () => {
    await storeGoal()
    await contribute(590_000)

    await harness.render(<HomeScreen />)

    expect(
      await screen.findByText(strings.home.coverage(2, strings.coverageDuration(6))),
    ).toBeTruthy()
    expect(meterUnits('coverage-meter')).toHaveLength(6)
    expect(filledUnits('coverage-meter')).toHaveLength(2)
  })

  // Before T157 every unit was filled, so an empty fund is the case that tells the two apart.
  it('fills nothing while the balance covers no whole month', async () => {
    await storeGoal()

    await harness.render(<HomeScreen />)

    expect(
      await screen.findByText(strings.home.coverage(0, strings.coverageDuration(6))),
    ).toBeTruthy()
    expect(filledUnits('coverage-meter')).toHaveLength(0)
  })

  // R$ 16.500,00 covers eight months of a six-month plan. The meter stops at six by itself;
  // the caption is the check that the count was capped before it got there.
  it('stops at the plan when the balance covers more', async () => {
    await storeGoal()
    await contribute(TARGET_MINOR_UNITS, 450_000)

    await harness.render(<HomeScreen />)

    expect(
      await screen.findByText(strings.home.coverage(6, strings.coverageDuration(6))),
    ).toBeTruthy()
    expect(filledUnits('coverage-meter')).toHaveLength(6)
  })

  // The balance is half of what Home stands on. A ledger that cannot be read must say so
  // rather than show the goal beside a balance of zero that is not the truth.
  it('reports a ledger it cannot read, rather than a zero balance', async () => {
    await storeGoal()
    jest
      .spyOn(harness.repositories.ledger, 'list')
      .mockResolvedValue(err(storageError('ledger.read-failed')))

    await harness.render(<HomeScreen />)

    expect(await screen.findByText(strings.state.errorTitle)).toBeTruthy()
    expect(screen.queryByTestId('standing-card')).toBeNull()
  })
})

/**
 * After a withdrawal (FR-018, T125): what is left to restore, and how long restoring it
 * takes at the pace of contributions.
 *
 * Today is the 22nd of August, so July is the last complete month.
 */
describe('Home, after a withdrawal', () => {
  /** Stores one entry, the way a save would have. */
  async function entry(
    type: 'contribution' | 'withdrawal',
    minorUnits: number,
    date: string,
  ): Promise<void> {
    expectOk(
      await harness.repositories.ledger.add({
        type,
        amount: money(minorUnits),
        date: calendarDate(date),
        note: null,
        withdrawalReason: type === 'withdrawal' ? 'medical' : null,
      }),
    )
  }

  /** April to July, 100_000 each, then 250_000 withdrawn late in July. */
  async function fourMonthsThenAWithdrawal(): Promise<void> {
    for (const month of ['04', '05', '06', '07']) {
      await entry('contribution', 100_000, `2026-${month}-05`)
    }
    await entry('withdrawal', 250_000, '2026-07-20')
  }

  // The shortfall is the drop from the high, 400_000, not what remains to the target,
  // which is 1_050_000. At 100_000 a month that is three months from the end of August,
  // November. The net pace, (400_000 − 250_000) / 4, would make it seven.
  it('shows what is left to restore, and when it will be at the pace of contributions', async () => {
    await storeGoal()
    await fourMonthsThenAWithdrawal()

    await harness.render(<HomeScreen />)

    expect(await screen.findByTestId('recovery-card')).toBeTruthy()
    expect(screen.getByTestId('shortfall-amount')).toHaveTextContent(shown(250_000))
    expect(
      screen.getByText(
        strings.recovery.estimate(
          shown(100_000),
          4,
          3,
          harness.services.format.month(monthKey(calendarDate('2026-11-30'))),
        ),
      ),
    ).toBeTruthy()
  })

  it('shows nothing to restore when no withdrawal has been made', async () => {
    await storeGoal()
    await contribute(300_000)

    await harness.render(<HomeScreen />)

    await screen.findByTestId('standing-card')
    expect(screen.queryByTestId('recovery-card')).toBeNull()
  })

  it('shows nothing to restore once the fund is back where it was', async () => {
    await storeGoal()
    await fourMonthsThenAWithdrawal()
    await entry('contribution', 250_000, '2026-08-10')

    await harness.render(<HomeScreen />)

    await screen.findByTestId('standing-card')
    expect(screen.queryByTestId('recovery-card')).toBeNull()
  })

  // FR-029, as in the forecast: July is the only complete month, two more are needed.
  it('says how much more history the estimate needs', async () => {
    await storeGoal()
    await entry('contribution', 100_000, '2026-07-05')
    await entry('withdrawal', 50_000, '2026-07-20')

    await harness.render(<HomeScreen />)

    expect(await screen.findByText(strings.recovery.insufficient(2))).toBeTruthy()
    expect(screen.getByTestId('shortfall-amount')).toHaveTextContent(shown(50_000))
  })

  // Saving stopped in 2025, and February to July have no contribution: no date to give.
  it('says why there is no estimate when nothing has been contributed lately', async () => {
    await storeGoal()
    for (const month of ['10', '11', '12']) {
      await entry('contribution', 300_000, `2025-${month}-05`)
    }
    await entry('withdrawal', 200_000, '2026-07-20')

    await harness.render(<HomeScreen />)

    expect(await screen.findByText(strings.recovery.noPace)).toBeTruthy()
  })
})
