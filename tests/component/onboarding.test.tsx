import { fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native'

import { storageError } from '@/domain/errors/app-error'
import { money } from '@/domain/money/money'
import { err } from '@/domain/result'
import { strings, validationMessage } from '@/ui/strings'
import { createAppHarness, type AppHarness } from '@tests/support/app-harness'
import { expectOk } from '@tests/support/expect-result'
import ExpensesScreen from '../../app/onboarding/expenses'
import LevelScreen from '../../app/onboarding/level'
import OpeningBalanceScreen from '../../app/onboarding/opening-balance'

/**
 * Setup: a figure, a duration to multiply it by, and then what is already saved.
 *
 * The first two are tested together because they are one journey with a value passed
 * between them — the expenses figure travels in the route, and the level screen is the only
 * place it is ever written. Testing the second without the first would mean inventing the
 * parameter the first produces, which is exactly the seam most likely to break. The third
 * is handed nothing: by the time it opens, the goal is stored.
 */
const MONTHLY_EXPENSES_MINOR_UNITS = 200_000

/** The day setup happens on, which is the day an opening balance is dated. */
const TODAY = '2026-10-01'

/** What the user already had. Not a multiple of the expenses, so no target can stand in for it. */
const OPENING_MINOR_UNITS = 345_678

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
  harness = createAppHarness(TODAY)
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

    await fireEvent.changeText(screen.getByTestId('expenses-input'), '200000')
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

    await fireEvent.changeText(screen.getByTestId('expenses-input'), '200000')

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
    await fireEvent.changeText(screen.getByTestId('coverage-input'), '8')

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
    await fireEvent.changeText(screen.getByTestId('coverage-input'), '30')
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

  // On to the opening balance rather than to Home: FR-010 asks for it during setup, and
  // Home is where that step ends.
  it('saves the profile and the goal together, then asks what is already saved', async () => {
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
    expect(mockReplace).toHaveBeenCalledWith('/onboarding/opening-balance')
  })

  // FR-005: the user may override the calculated figure, and the app records which of the
  // two the active target is — a number the user typed is not a number the app derived.
  it('records a manual override as the user’s own', async () => {
    await harness.render(<LevelScreen />)

    await userEvent.press(screen.getByRole('button', { name: strings.goal.overrideAction }))
    await fireEvent.changeText(screen.getByTestId('target-input'), '5000000')
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
    await fireEvent.changeText(screen.getByTestId('target-input'), '')
    await userEvent.press(screen.getByRole('button', { name: strings.action.save }))

    expect(await screen.findByText(strings.validation.targetMustBePositive)).toBeTruthy()
    expect(await harness.repositories.goal.get()).toEqual({ ok: true, value: null })
  })

  it('returns to the calculated target when the override is dropped', async () => {
    await harness.render(<LevelScreen />)

    await userEvent.press(screen.getByRole('button', { name: strings.goal.overrideAction }))
    await fireEvent.changeText(screen.getByTestId('target-input'), '5000000')
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

describe('the opening balance step', () => {
  async function typeOpening(minorUnits: number): Promise<void> {
    await fireEvent.changeText(screen.getByTestId('opening-input'), String(minorUnits))
  }

  async function save(): Promise<void> {
    await userEvent.press(screen.getByRole('button', { name: strings.action.save }))
  }

  async function stored(): Promise<readonly unknown[]> {
    return expectOk(await harness.repositories.ledger.list())
  }

  // FR-010, and the data model's rule that the opening entry is dated the day of setup.
  it('records what was already saved as the opening balance, dated today, then goes to Home', async () => {
    await harness.render(<OpeningBalanceScreen />)

    await typeOpening(OPENING_MINOR_UNITS)
    await save()

    expect(await stored()).toEqual([
      expect.objectContaining({
        type: 'opening',
        amount: OPENING_MINOR_UNITS,
        date: TODAY,
        note: null,
        withdrawalReason: null,
      }),
    ])
    expect(mockReplace).toHaveBeenCalledWith('/')
  })

  // Starting from nothing is the common case, and it must not cost an entry of zero — which
  // the ledger refuses anyway — or a detour through a refusal.
  it('can be skipped, which writes nothing and goes to Home', async () => {
    await harness.render(<OpeningBalanceScreen />)

    await typeOpening(OPENING_MINOR_UNITS)
    await userEvent.press(screen.getByRole('button', { name: strings.onboarding.openingSkip }))

    expect(await stored()).toHaveLength(0)
    expect(mockReplace).toHaveBeenCalledWith('/')
  })

  it('refuses an amount of zero, says why, and stays where it is', async () => {
    await harness.render(<OpeningBalanceScreen />)

    await save()

    expect(
      await screen.findByText(
        validationMessage({
          kind: 'validation',
          field: 'amount',
          messageKey: 'entry.amount-must-be-positive',
        }),
      ),
    ).toBeTruthy()
    expect(await stored()).toHaveLength(0)
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('clears the refusal once the amount is changed', async () => {
    await harness.render(<OpeningBalanceScreen />)
    await save()
    // Waited for, so the assertion below is about a message that left rather than one that
    // had not arrived yet.
    await screen.findByText(strings.validation.entryAmountMustBePositive)

    await typeOpening(OPENING_MINOR_UNITS)

    expect(screen.queryByText(strings.validation.entryAmountMustBePositive)).toBeNull()
  })

  // Reached a second time — by a link, since setup never returns here. The ledger refuses
  // a second opening, and the user is told that rather than that storage failed: retrying
  // would never work, and the way out is the other button.
  it('says an opening balance already exists, rather than that storage failed', async () => {
    expectOk(
      await harness.repositories.ledger.add({
        type: 'opening',
        amount: money(100_000),
        date: harness.clock.today(),
        note: null,
        withdrawalReason: null,
      }),
    )
    await harness.render(<OpeningBalanceScreen />)

    await typeOpening(OPENING_MINOR_UNITS)
    await save()

    expect(await screen.findByText(strings.validation.entryOpeningAlreadyExists)).toBeTruthy()
    expect(screen.queryByText(strings.state.errorBody)).toBeNull()
    expect(await stored()).toHaveLength(1)
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('says so when storage fails, and keeps what was typed', async () => {
    jest
      .spyOn(harness.repositories.ledger, 'add')
      .mockResolvedValue(err(storageError('ledger.write-failed')))
    await harness.render(<OpeningBalanceScreen />)

    await typeOpening(OPENING_MINOR_UNITS)
    await save()

    expect(await screen.findByText(strings.state.errorBody)).toBeTruthy()
    expect(screen.getByTestId('opening-input').props.value).toBe(formatted(OPENING_MINOR_UNITS))
    expect(mockReplace).not.toHaveBeenCalled()
  })
})
