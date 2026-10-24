import { fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native'
import type { RedirectProps } from 'expo-router'

import { storageError } from '@/domain/errors/app-error'
import type { GoalInput } from '@/domain/goal/types'
import { calendarDate } from '@/domain/dates/calendar-date'
import { money } from '@/domain/money/money'
import { err } from '@/domain/result'
import { strings, validationMessage } from '@/ui/strings'
import { createAppHarness, type AppHarness } from '@tests/support/app-harness'
import { expectOk } from '@tests/support/expect-result'
import GoalRevisionScreen from '../../app/settings/goal'

/**
 * Revising a goal that already exists (FR-006).
 *
 * The screen makes the same three decisions the level step does — expenses, duration,
 * optional override — so what is tested here is what is different about doing it a second
 * time: starting from what is stored rather than from a default, saying what the change
 * costs before it is made, and leaving an audit row behind.
 *
 * The impact preview states the target's change and the progress percentage's (FR-006).
 * The percentages are asserted against a seeded balance, written as the figures a hand
 * calculation gives rather than recomputed with the code's own arithmetic.
 */
const MONTHLY_EXPENSES_MINOR_UNITS = 200_000
const BALANCED_MONTHS = 6
const STORED_TARGET_MINOR_UNITS = MONTHLY_EXPENSES_MINOR_UNITS * BALANCED_MONTHS
const CAUTIOUS_MONTHS = 9
const CAUTIOUS_TARGET_MINOR_UNITS = MONTHLY_EXPENSES_MINOR_UNITS * CAUTIOUS_MONTHS
const LEAN_MONTHS = 3
const LEAN_TARGET_MINOR_UNITS = MONTHLY_EXPENSES_MINOR_UNITS * LEAN_MONTHS

const mockBack = jest.fn()
const mockReplace = jest.fn()
const mockCanGoBack = jest.fn(() => true)
const mockRedirect = jest.fn()

// The router is doubled for the same reason the onboarding suite doubles it: where the
// screen goes next is the app's decision and is asserted, while getting there is
// expo-router's own behaviour and is not this suite's subject.
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, replace: mockReplace, canGoBack: mockCanGoBack }),
  Redirect: ({ href }: RedirectProps) => {
    mockRedirect(href)
    return null
  },
}))

let harness: AppHarness

beforeEach(() => {
  harness = createAppHarness()
  mockBack.mockClear()
  mockReplace.mockClear()
  mockRedirect.mockClear()
  mockCanGoBack.mockReturnValue(true)
})

afterEach(async () => {
  await harness.teardown()
})

/** Stores the profile and goal that finishing onboarding would have left behind. */
async function storeGoal(overrides: Partial<GoalInput> = {}): Promise<void> {
  await harness.repositories.profile.save({
    monthlyExpenses: money(MONTHLY_EXPENSES_MINOR_UNITS),
    currency: harness.services.currency,
  })
  await harness.repositories.goal.save({
    target: money(STORED_TARGET_MINOR_UNITS),
    source: 'calculated',
    levelKey: 'balanced',
    coverageMonths: BALANCED_MONTHS,
    desiredCompletionDate: null,
    ...overrides,
  })
}

/**
 * Stores an opening balance, so the fund has progress for a revision to change.
 *
 * Dated before the harness's today, since a future-dated entry is left out of the balance.
 */
async function storeBalance(minorUnits: number): Promise<void> {
  expectOk(
    await harness.repositories.ledger.add({
      type: 'opening',
      amount: money(minorUnits),
      date: calendarDate('2026-08-01'),
      note: null,
      withdrawalReason: null,
    }),
  )
}

/** A percentage as the screen renders it. */
function percent(value: number): string {
  return harness.services.format.percent(value)
}

/** The formatted amount, so assertions read the way the screen does. */
function formatted(minorUnits: number): string {
  return harness.services.format.money(money(minorUnits))
}

/** Renders the screen and waits for the stored goal to arrive. */
async function openRevision(): Promise<void> {
  await harness.render(<GoalRevisionScreen />)
  await screen.findByTestId('target-preview')
}

describe('the goal revision screen', () => {
  // FR-007: the stored goal is the starting point, not a fresh form. A revision screen that
  // opened on defaults would quietly propose undoing whatever the user had chosen.
  it('opens on what is stored, not on a default', async () => {
    // Deliberately not the level a new draft starts on. Stored as `balanced`, this test
    // would pass just as well against a screen that ignored the stored goal entirely.
    await storeGoal({
      levelKey: 'cautious',
      coverageMonths: CAUTIOUS_MONTHS,
      target: money(CAUTIOUS_TARGET_MINOR_UNITS),
    })

    await openRevision()

    expect(screen.getByTestId('expenses-input').props.value).toBe(
      formatted(MONTHLY_EXPENSES_MINOR_UNITS),
    )
    expect(screen.getByText(formatted(CAUTIOUS_TARGET_MINOR_UNITS))).toBeTruthy()
    expect(screen.getByLabelText(strings.levels.cautious.name).props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    )
    expect(screen.getByLabelText(strings.levels.balanced.name).props.accessibilityState).toEqual(
      expect.objectContaining({ selected: false }),
    )
  })

  // A duration the user typed is the one case where the stored number is not implied by the
  // level: every preset carries its own months, so only a custom goal can come back wrong,
  // and it would come back as whatever the default level happens to be.
  it('reopens a custom duration as the number the user typed', async () => {
    const customMonths = 8
    await storeGoal({
      levelKey: 'custom',
      coverageMonths: customMonths,
      target: money(MONTHLY_EXPENSES_MINOR_UNITS * customMonths),
    })

    await openRevision()

    expect(screen.getByLabelText(strings.levels.custom.name).props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    )
    expect(screen.getByTestId('coverage-input').props.value).toBe(String(customMonths))
    expect(screen.getByText(formatted(MONTHLY_EXPENSES_MINOR_UNITS * customMonths))).toBeTruthy()
  })

  // FR-006: the target follows the level immediately, and the screen says what the change
  // does to the goal rather than leaving the user to subtract two figures themselves.
  it('shows what the change costs before it is saved', async () => {
    await storeGoal()
    await openRevision()

    await userEvent.press(screen.getByLabelText(strings.levels.cautious.name))

    expect(await screen.findByTestId('goal-impact')).toBeTruthy()
    expect(screen.getByText(formatted(CAUTIOUS_TARGET_MINOR_UNITS))).toBeTruthy()
    expect(
      screen.getByText(
        strings.revision.increase(
          formatted(CAUTIOUS_TARGET_MINOR_UNITS - STORED_TARGET_MINOR_UNITS),
        ),
      ),
    ).toBeTruthy()
  })

  // The other direction, and its own words: a smaller goal is a reduction, not a negative
  // amount. The formatter would render the difference with a minus sign, which reads as a
  // debt rather than as a target that moved down.
  it('states a smaller target as a reduction', async () => {
    await storeGoal()
    await openRevision()

    await userEvent.press(screen.getByLabelText(strings.levels.lean.name))

    expect(
      await screen.findByText(
        strings.revision.decrease(formatted(STORED_TARGET_MINOR_UNITS - LEAN_TARGET_MINOR_UNITS)),
      ),
    ).toBeTruthy()
  })

  // FR-006's second half. R$ 3.000,00 of a R$ 12.000,00 goal is 25%; of the R$ 18.000,00
  // the cautious level asks for, 16,67%. The balance is neither zero nor the target, so
  // neither percentage is one a preview with no balance could fall back to.
  it('says what the change does to progress', async () => {
    await storeGoal()
    await storeBalance(300_000)
    await openRevision()

    await userEvent.press(screen.getByLabelText(strings.levels.cautious.name))

    expect(
      await screen.findByText(strings.revision.progressChange(percent(25), percent(16.67))),
    ).toBeTruthy()
  })

  // And down: the same balance is half of the lean level's R$ 6.000,00.
  it('says what a smaller target does to progress', async () => {
    await storeGoal()
    await storeBalance(300_000)
    await openRevision()

    await userEvent.press(screen.getByLabelText(strings.levels.lean.name))

    expect(
      await screen.findByText(strings.revision.progressChange(percent(25), percent(50))),
    ).toBeTruthy()
  })

  // A fund already past both targets is reached either way. "De 100% para 100%" would read
  // as a change that is not one.
  it('says progress stays where it is when the change does not move it', async () => {
    await storeGoal()
    await storeBalance(STORED_TARGET_MINOR_UNITS)
    await openRevision()

    await userEvent.press(screen.getByLabelText(strings.levels.lean.name))

    expect(await screen.findByText(strings.revision.progressUnchanged(percent(100)))).toBeTruthy()
  })

  // A ledger that cannot be read is not an empty one. Showing 0% would tell the user their
  // savings are gone; failing the whole screen would stop them revising a goal that reads
  // fine. So the target's half stands, and the progress half says it could not be worked out.
  it('says progress cannot be worked out when the ledger cannot be read, and still shows the target', async () => {
    await storeGoal()
    await storeBalance(300_000)
    jest
      .spyOn(harness.repositories.ledger, 'list')
      .mockResolvedValue(err(storageError('ledger.read-failed')))
    await openRevision()

    await userEvent.press(screen.getByLabelText(strings.levels.cautious.name))

    expect(await screen.findByText(strings.revision.progressUnavailable)).toBeTruthy()
    expect(
      screen.getByText(
        strings.revision.increase(
          formatted(CAUTIOUS_TARGET_MINOR_UNITS - STORED_TARGET_MINOR_UNITS),
        ),
      ),
    ).toBeTruthy()
    expect(screen.queryByText(/%/)).toBeNull()
  })

  // Nothing has changed yet, so there is no impact to state. A preview reading
  // "no change" on arrival is noise the user has to read past on every visit.
  it('says nothing about impact until something differs', async () => {
    await storeGoal()

    await openRevision()

    expect(screen.queryByTestId('goal-impact')).toBeNull()
  })

  // FR-006 names the expense figure as well as the level: both feed the target, and this is
  // the only screen where the stored figure can be corrected.
  it('recalculates from a corrected expense figure', async () => {
    await storeGoal()
    await openRevision()

    await fireEvent.changeText(screen.getByTestId('expenses-input'), '300000')

    expect(await screen.findByText(formatted(300_000 * BALANCED_MONTHS))).toBeTruthy()
    // The new target brings the impact panel, whose progress line reads the balance. The
    // target arriving says nothing about the balance, which otherwise landed after the test
    // had stopped waiting — an update outside act(), about one full run in six (AP-013).
    expect(await screen.findByTestId('progress-difference')).toBeTruthy()
  })

  it('saves the revision, records it, and returns where the user came from', async () => {
    await storeGoal()
    await openRevision()

    await userEvent.press(screen.getByLabelText(strings.levels.cautious.name))
    await userEvent.press(screen.getByRole('button', { name: strings.action.save }))

    await waitFor(() => {
      expect(mockBack).toHaveBeenCalled()
    })
    expect(expectOk(await harness.repositories.goal.get())).toMatchObject({
      target: money(CAUTIOUS_TARGET_MINOR_UNITS),
      coverageMonths: CAUTIOUS_MONTHS,
      source: 'calculated',
    })
    // The audit row FR-006 requires: history is preserved with the change recorded.
    expect(expectOk(await harness.repositories.goal.listChanges())).toMatchObject([
      {
        previousTarget: money(STORED_TARGET_MINOR_UNITS),
        newTarget: money(CAUTIOUS_TARGET_MINOR_UNITS),
        previousCoverageMonths: BALANCED_MONTHS,
        newCoverageMonths: CAUTIOUS_MONTHS,
      },
    ])
  })

  // Reached by a deep link, or by the back stack after the app was reopened elsewhere.
  it('goes to Home when there is nothing behind it to go back to', async () => {
    mockCanGoBack.mockReturnValue(false)
    await storeGoal()
    await openRevision()

    await userEvent.press(screen.getByRole('button', { name: strings.action.save }))

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/')
    })
    expect(mockBack).not.toHaveBeenCalled()
  })

  // FR-001 applies to the corrected figure exactly as it did to the first one, and a
  // refused revision must leave the stored goal untouched rather than half-applied.
  it('refuses an expense figure of zero and changes nothing', async () => {
    await storeGoal()
    await openRevision()

    await fireEvent.changeText(screen.getByTestId('expenses-input'), '')
    await userEvent.press(screen.getByRole('button', { name: strings.action.save }))

    expect(
      await screen.findByText(
        validationMessage({
          kind: 'validation',
          field: 'monthlyExpenses',
          messageKey: 'goal.expenses-must-be-positive',
        }),
      ),
    ).toBeTruthy()
    expect(expectOk(await harness.repositories.goal.get())).toMatchObject({
      target: money(STORED_TARGET_MINOR_UNITS),
    })
    expect(expectOk(await harness.repositories.goal.listChanges())).toHaveLength(0)
  })

  // FR-005: a target the user typed is theirs, and reopening the screen has to offer it
  // back as theirs rather than reverting to the calculated figure behind their back.
  it('reopens a user-defined target as the user’s own', async () => {
    await storeGoal({ target: money(5_000_000), source: 'user_defined' })

    await openRevision()

    expect(screen.getByTestId('target-input').props.value).toBe(formatted(5_000_000))
    expect(screen.getByRole('button', { name: strings.goal.calculatedAction })).toBeTruthy()
  })

  // Either row failing is the pair's failure. The screen cannot open a form on half a goal,
  // and showing the error is what lets the user retry rather than facing a blank form
  // seeded with figures the app could not actually read.
  it('reports a storage failure rather than opening a form on half a goal', async () => {
    await storeGoal()
    jest
      .spyOn(harness.repositories.profile, 'get')
      .mockResolvedValue(err(storageError('storage.unavailable')))

    await harness.render(<GoalRevisionScreen />)

    expect(await screen.findByText(strings.state.errorTitle)).toBeTruthy()
    expect(screen.queryByTestId('target-preview')).toBeNull()

    // Retrying reads both rows again. Asserting the button exists would leave the half that
    // matters untested — a retry that renders and does nothing is the failure this state
    // exists to avoid.
    jest.spyOn(harness.repositories.profile, 'get').mockRestore()
    await userEvent.press(screen.getByRole('button', { name: strings.action.retry }))

    expect(await screen.findByTestId('target-preview')).toBeTruthy()
  })

  // Nothing to revise. Sending the user to setup is the same answer Home gives, and for
  // the same reason: no stored goal means setup never finished.
  it('sends the user to setup when there is no goal to revise', async () => {
    await harness.render(<GoalRevisionScreen />)

    await waitFor(() => {
      expect(mockRedirect).toHaveBeenCalledWith('/onboarding/expenses')
    })
  })
})
