import { fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native'

import { money } from '@/domain/money/money'
import { strings, validationMessage } from '@/ui/strings'
import { createAppHarness, type AppHarness } from '@tests/support/app-harness'
import { expectOk } from '@tests/support/expect-result'
import ExpensesScreen from '../../app/onboarding/expenses'
import LevelScreen from '../../app/onboarding/level'

/**
 * The two screens that size the fund: a figure, then a duration to multiply it by.
 *
 * They are tested together because they are one journey with a value passed between them —
 * the expenses figure travels in the route, and the level screen is the only place it is
 * ever written. Testing the second without the first would mean inventing the parameter
 * the first produces, which is exactly the seam most likely to break.
 */
const MONTHLY_EXPENSES_MINOR_UNITS = 200_000

/** The route the level step is reached at, and the figure it is handed. */
const mockPush = jest.fn()
const mockReplace = jest.fn()
let mockParams: Record<string, string> = {}

// Route state is the router's, not the app's, so the router is the one thing here that is
// a double: the screens are exercised for what they do with the parameter and where they
// try to go next, and expo-router's own navigation is not this suite's subject.
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useLocalSearchParams: () => mockParams,
}))

let harness: AppHarness

beforeEach(() => {
  harness = createAppHarness()
  mockPush.mockClear()
  mockReplace.mockClear()
  mockParams = { expenses: String(MONTHLY_EXPENSES_MINOR_UNITS) }
})

afterEach(async () => {
  await harness.teardown()
})

/** The formatted amount the money input shows, so assertions read as the user sees them. */
function formatted(minorUnits: number): string {
  return harness.services.format.money(money(minorUnits))
}

/** Chooses a level by the name the user reads. */
async function chooseLevel(name: string): Promise<void> {
  await userEvent.press(screen.getByLabelText(name))
}

describe('the expenses step', () => {
  it('carries the amount to the level step, in minor units', async () => {
    await harness.render(<ExpensesScreen />)

    fireEvent.changeText(screen.getByTestId('expenses-input'), '200000')
    await userEvent.press(screen.getByRole('button', { name: strings.action.continue }))

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/onboarding/level',
      params: { expenses: String(MONTHLY_EXPENSES_MINOR_UNITS) },
    })
  })

  // FR-001 requires the rejection to be explained. An amount of zero is the one a user
  // reaches by pressing continue on an untouched field, so it is the message they are
  // most likely to see.
  it('refuses zero, says why, and stays where it is', async () => {
    await harness.render(<ExpensesScreen />)

    await userEvent.press(screen.getByRole('button', { name: strings.action.continue }))

    expect(
      screen.getByText(
        validationMessage({
          kind: 'validation',
          field: 'monthlyExpenses',
          messageKey: 'goal.expenses-must-be-positive',
        }),
      ),
    ).toBeTruthy()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('clears the message once the amount is corrected', async () => {
    await harness.render(<ExpensesScreen />)
    await userEvent.press(screen.getByRole('button', { name: strings.action.continue }))

    fireEvent.changeText(screen.getByTestId('expenses-input'), '200000')

    await waitFor(() => {
      expect(screen.queryByText(strings.validation.expensesMustBePositive)).toBeNull()
    })
  })
})

describe('the level step', () => {
  // FR-003: each level says who it suits. Without the explanation the screen offers four
  // durations and no way to tell which one describes you.
  it('offers every level with its explanation', async () => {
    await harness.render(<LevelScreen />)

    // Over the strings rather than over a list written here: the screen renders whatever
    // the domain offers, and a level added to one and not the other should fail this.
    for (const level of Object.values(strings.levels)) {
      expect(screen.getByLabelText(level.name)).toBeTruthy()
      expect(screen.getByText(level.explanation)).toBeTruthy()
    }
  })

  // FR-004: the derivation is shown, not just the result. A user who disagrees with the
  // target can only tell which half to change if they can see both.
  it('shows the target and how it was reached', async () => {
    await harness.render(<LevelScreen />)

    expect(
      screen.getByText(
        strings.goal.derivation(
          formatted(MONTHLY_EXPENSES_MINOR_UNITS),
          strings.coverageDuration(6),
          formatted(MONTHLY_EXPENSES_MINOR_UNITS * 6),
        ),
      ),
    ).toBeTruthy()
  })

  // FR-006: the target follows the level immediately, with no save in between.
  it('recalculates when another level is chosen', async () => {
    await harness.render(<LevelScreen />)

    await chooseLevel(strings.levels.cautious.name)

    expect(
      await screen.findByText(
        strings.goal.derivation(
          formatted(MONTHLY_EXPENSES_MINOR_UNITS),
          strings.coverageDuration(9),
          formatted(MONTHLY_EXPENSES_MINOR_UNITS * 9),
        ),
      ),
    ).toBeTruthy()
  })

  it('accepts a custom duration and multiplies by it (FR-002)', async () => {
    await harness.render(<LevelScreen />)

    await chooseLevel(strings.levels.custom.name)
    fireEvent.changeText(screen.getByTestId('coverage-input'), '8')

    expect(
      await screen.findByText(
        strings.goal.derivation(
          formatted(MONTHLY_EXPENSES_MINOR_UNITS),
          strings.coverageDuration(8),
          formatted(MONTHLY_EXPENSES_MINOR_UNITS * 8),
        ),
      ),
    ).toBeTruthy()
  })

  it('refuses a custom duration outside the permitted range', async () => {
    await harness.render(<LevelScreen />)

    await chooseLevel(strings.levels.custom.name)
    fireEvent.changeText(screen.getByTestId('coverage-input'), '30')
    await userEvent.press(screen.getByRole('button', { name: strings.action.save }))

    expect(
      await screen.findByText(
        validationMessage({
          kind: 'validation',
          field: 'coverageMonths',
          messageKey: 'goal.coverage-out-of-range',
        }),
      ),
    ).toBeTruthy()
    expect(mockReplace).not.toHaveBeenCalled()
    expect(await harness.repositories.goal.get()).toEqual({ ok: true, value: null })
  })

  it('saves the profile and the goal together, then goes to Home', async () => {
    await harness.render(<LevelScreen />)

    await userEvent.press(screen.getByRole('button', { name: strings.action.save }))

    expect(expectOk(await harness.repositories.goal.get())).toMatchObject({
      target: money(MONTHLY_EXPENSES_MINOR_UNITS * 6),
      source: 'calculated',
      levelKey: 'balanced',
      coverageMonths: 6,
    })
    expect(expectOk(await harness.repositories.profile.get())).toMatchObject({
      monthlyExpenses: money(MONTHLY_EXPENSES_MINOR_UNITS),
    })
    expect(mockReplace).toHaveBeenCalledWith('/')
  })

  // FR-005: the user may override the calculated figure, and the app records which of the
  // two the active target is — a number the user typed is not a number the app derived.
  it('records a manual override as the user’s own', async () => {
    await harness.render(<LevelScreen />)

    await userEvent.press(screen.getByRole('button', { name: strings.goal.overrideAction }))
    fireEvent.changeText(screen.getByTestId('target-input'), '5000000')
    await userEvent.press(screen.getByRole('button', { name: strings.action.save }))

    expect(expectOk(await harness.repositories.goal.get())).toMatchObject({
      target: money(5_000_000),
      source: 'user_defined',
    })
  })

  // The only path to a target of zero: a calculated one is the product of two figures
  // already checked, and a fund with nothing to reach is not a fund.
  it('refuses an override of zero', async () => {
    await harness.render(<LevelScreen />)

    await userEvent.press(screen.getByRole('button', { name: strings.goal.overrideAction }))
    fireEvent.changeText(screen.getByTestId('target-input'), '')
    await userEvent.press(screen.getByRole('button', { name: strings.action.save }))

    expect(await screen.findByText(strings.validation.targetMustBePositive)).toBeTruthy()
    expect(await harness.repositories.goal.get()).toEqual({ ok: true, value: null })
  })

  it('returns to the calculated target when the override is dropped', async () => {
    await harness.render(<LevelScreen />)

    await userEvent.press(screen.getByRole('button', { name: strings.goal.overrideAction }))
    fireEvent.changeText(screen.getByTestId('target-input'), '5000000')
    await userEvent.press(screen.getByRole('button', { name: strings.goal.calculatedAction }))
    await userEvent.press(screen.getByRole('button', { name: strings.action.save }))

    expect(expectOk(await harness.repositories.goal.get())).toMatchObject({
      target: money(MONTHLY_EXPENSES_MINOR_UNITS * 6),
      source: 'calculated',
    })
  })

  // Reached by a deep link, or by a stale route after the app was reopened. There is no
  // figure to multiply, and inventing one would put a target in front of the user that
  // nothing they typed produced.
  it('sends the user back when the expenses figure is missing', async () => {
    mockParams = {}
    await harness.render(<LevelScreen />)

    expect(screen.getByText(strings.onboarding.missingExpenses)).toBeTruthy()
    await userEvent.press(screen.getByRole('button', { name: strings.home.emptyAction }))
    expect(mockReplace).toHaveBeenCalledWith('/onboarding/expenses')
  })
})
