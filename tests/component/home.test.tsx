import { screen } from '@testing-library/react-native'

import { money } from '@/domain/money/money'
import { strings } from '@/ui/strings'
import { createAppHarness, type AppHarness } from '@tests/support/app-harness'
import HomeScreen from '../../app/index'

/**
 * Home is where first launch is decided, so both of its answers are tested here: the
 * redirect that sends a new user into setup, and the target a returning one sees.
 */
const TARGET_MINOR_UNITS = 1_200_000
const EXPENSES_MINOR_UNITS = 200_000

const mockRedirect = jest.fn()

// Only the redirect is doubled, and only to record where it pointed. Rendering nothing in
// its place is what the real component does to this tree anyway — it navigates rather than
// drawing — so the assertion is about the destination, which is the whole decision.
jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    mockRedirect(href)
    return null
  },
}))

let harness: AppHarness

beforeEach(() => {
  harness = createAppHarness()
  mockRedirect.mockClear()
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

describe('Home', () => {
  // No stored goal means setup never finished. That is the only definition of first launch
  // that survives the app being deleted and reinstalled with its data restored — a flag
  // saying "onboarding done" would not.
  it('sends a user with no goal into setup', async () => {
    await harness.render(<HomeScreen />)

    await screen.findByText(strings.home.title)
    expect(mockRedirect).toHaveBeenCalledWith('/onboarding/expenses')
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
})
