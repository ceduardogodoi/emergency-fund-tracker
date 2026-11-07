import { fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native'

import { calendarDate } from '@/domain/dates/calendar-date'
import { storageError } from '@/domain/errors/app-error'
import { calculateBalance } from '@/domain/ledger/balance'
import type { LedgerEntry } from '@/domain/ledger/types'
import { MAXIMUM_REASON_LENGTH, WITHDRAWAL_REASONS } from '@/domain/ledger/withdrawal'
import { money } from '@/domain/money/money'
import { err } from '@/domain/result'
import { strings, validationMessage } from '@/ui/strings'
import { createAppHarness, type AppHarness } from '@tests/support/app-harness'
import { expectOk } from '@tests/support/expect-result'
import WithdrawScreen from '../../app/entries/withdraw'

/**
 * Recording a withdrawal (FR-016, FR-017): an amount, a day, and why — from the predefined
 * reasons or in the user's own words — and a question first when it is more than the fund
 * holds.
 *
 * Today is the first of a month, as in the contribute suite, so "Ontem" crosses into the
 * previous one.
 */
const TODAY = '2026-10-01'
const YESTERDAY = '2026-09-30'

const mockBack = jest.fn()
const mockReplace = jest.fn()
let mockCanGoBack = true

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockBack,
    replace: mockReplace,
    canGoBack: () => mockCanGoBack,
  }),
}))

let harness: AppHarness

beforeEach(() => {
  harness = createAppHarness(TODAY)
  mockBack.mockClear()
  mockReplace.mockClear()
  mockCanGoBack = true
})

afterEach(async () => {
  await harness.teardown()
})

/** Saves a contribution directly, so the fund holds `minorUnits`. */
async function fundHolds(minorUnits: number): Promise<void> {
  expectOk(
    await harness.repositories.ledger.add({
      type: 'contribution',
      amount: money(minorUnits),
      date: calendarDate('2026-09-05'),
      note: null,
      withdrawalReason: null,
    }),
  )
}

async function stored(): Promise<readonly LedgerEntry[]> {
  return expectOk(await harness.repositories.ledger.list())
}

async function withdrawals(): Promise<readonly LedgerEntry[]> {
  return (await stored()).filter((entry) => entry.type === 'withdrawal')
}

async function render(): Promise<void> {
  await harness.render(<WithdrawScreen />)
}

/** Types an amount the way the money input reads it: the digits are minor units. */
async function typeAmount(minorUnits: number): Promise<void> {
  await fireEvent.changeText(screen.getByTestId('amount-input'), String(minorUnits))
}

async function chooseReason(label: string): Promise<void> {
  await userEvent.press(screen.getByRole('radio', { name: label }))
}

async function writeReason(text: string): Promise<void> {
  await chooseReason(strings.withdrawal.otherReason)
  await fireEvent.changeText(screen.getByTestId('reason-input'), text)
}

async function save(): Promise<void> {
  await userEvent.press(screen.getByRole('button', { name: strings.withdrawal.saveAction }))
}

function formatted(minorUnits: number): string {
  return harness.services.format.money(money(minorUnits))
}

describe('the withdraw screen', () => {
  // Spec, Story 5 scenario 1: a balance of 8,000 and a withdrawal of 3,000 with a reason.
  it('records a withdrawal with a predefined reason, dated today, and leaves', async () => {
    await fundHolds(800_000)
    await render()

    await typeAmount(300_000)
    await chooseReason(strings.withdrawal.reasons['car-repair'].label)
    await save()

    await waitFor(() => {
      expect(mockBack).toHaveBeenCalled()
    })
    expect(await withdrawals()).toEqual([
      expect.objectContaining({
        type: 'withdrawal',
        amount: 300_000,
        date: TODAY,
        note: null,
        withdrawalReason: 'car-repair',
      }),
    ])
    expect(calculateBalance(await stored(), calendarDate(TODAY))).toBe(500_000)
  })

  // Each one, by the key it is stored as: a label stored instead would be text the export
  // carries in one language, and a renamed label would orphan every entry that used it.
  it.each(WITHDRAWAL_REASONS)('stores %s by its key', async (key) => {
    await fundHolds(800_000)
    await render()

    await typeAmount(10_000)
    await chooseReason(strings.withdrawal.reasons[key].label)
    await save()

    await waitFor(async () => {
      expect(await withdrawals()).toEqual([expect.objectContaining({ withdrawalReason: key })])
    })
  })

  it('offers every predefined reason, explained, and one for the user to write', async () => {
    await render()

    for (const key of WITHDRAWAL_REASONS) {
      expect(
        screen.getByRole('radio', { name: strings.withdrawal.reasons[key].label }),
      ).toBeTruthy()
      expect(screen.getByText(strings.withdrawal.reasons[key].description)).toBeTruthy()
    }
    expect(screen.getByRole('radio', { name: strings.withdrawal.otherReason })).toBeTruthy()
  })

  // Nothing is chosen for the user. A reason picked by default is a reason nobody gave.
  it('opens with no reason chosen', async () => {
    await render()

    const labels = [
      ...WITHDRAWAL_REASONS.map((key) => strings.withdrawal.reasons[key].label),
      strings.withdrawal.otherReason,
    ]
    for (const label of labels) {
      expect(screen.getByRole('radio', { name: label })).not.toBeSelected()
    }
  })

  it('keeps the text field out of the way until the user chooses to write a reason', async () => {
    await render()

    expect(screen.queryByTestId('reason-input')).toBeNull()

    await chooseReason(strings.withdrawal.otherReason)

    expect(screen.getByTestId('reason-input')).toBeTruthy()
  })

  it('records a reason in the user own words, without the whitespace around it', async () => {
    await fundHolds(800_000)
    await render()

    await typeAmount(10_000)
    await writeReason('  Dentista  ')
    await save()

    await waitFor(async () => {
      expect(await withdrawals()).toEqual([
        expect.objectContaining({ withdrawalReason: 'Dentista' }),
      ])
    })
  })

  // The text was written while "Outro motivo" was chosen. Choosing a predefined reason
  // afterwards is the answer, and the text must not be what gets stored.
  it('records the predefined reason chosen after some text was written', async () => {
    await fundHolds(800_000)
    await render()

    await typeAmount(10_000)
    await writeReason('Dentista')
    await chooseReason(strings.withdrawal.reasons.medical.label)
    await save()

    await waitFor(async () => {
      expect(await withdrawals()).toEqual([
        expect.objectContaining({ withdrawalReason: 'medical' }),
      ])
    })
  })

  it('refuses a withdrawal with no reason, says so by the reasons, and writes nothing', async () => {
    await fundHolds(800_000)
    await render()

    await typeAmount(10_000)
    await save()

    expect(
      screen.getByText(
        validationMessage({
          kind: 'validation',
          field: 'reason',
          messageKey: 'entry.reason-required',
        }),
      ),
    ).toBeTruthy()
    expect(await withdrawals()).toEqual([])
    expect(mockBack).not.toHaveBeenCalled()
  })

  it('refuses a written reason left blank', async () => {
    await fundHolds(800_000)
    await render()

    await typeAmount(10_000)
    await writeReason('   ')
    await save()

    expect(
      screen.getByText(
        validationMessage({
          kind: 'validation',
          field: 'reason',
          messageKey: 'entry.reason-required',
        }),
      ),
    ).toBeTruthy()
    expect(await withdrawals()).toEqual([])
  })

  it('refuses a written reason over the limit', async () => {
    await fundHolds(800_000)
    await render()

    await typeAmount(10_000)
    await writeReason('a'.repeat(MAXIMUM_REASON_LENGTH + 1))
    await save()

    expect(
      screen.getByText(
        validationMessage({
          kind: 'validation',
          field: 'reason',
          messageKey: 'entry.reason-too-long',
        }),
      ),
    ).toBeTruthy()
    expect(await withdrawals()).toEqual([])
  })

  it('clears the refusal once a reason is chosen', async () => {
    await render()

    await typeAmount(10_000)
    await save()
    await chooseReason(strings.withdrawal.reasons.family.label)

    expect(
      screen.queryByText(
        validationMessage({
          kind: 'validation',
          field: 'reason',
          messageKey: 'entry.reason-required',
        }),
      ),
    ).toBeNull()
  })

  it('refuses an amount of zero, under the amount', async () => {
    await render()

    await chooseReason(strings.withdrawal.reasons.family.label)
    await save()

    expect(
      screen.getByText(
        validationMessage({
          kind: 'validation',
          field: 'amount',
          messageKey: 'entry.amount-must-be-positive',
        }),
      ),
    ).toBeTruthy()
    expect(await withdrawals()).toEqual([])
  })

  it('records yesterday with one tap', async () => {
    await fundHolds(800_000)
    await render()

    await typeAmount(10_000)
    await chooseReason(strings.withdrawal.reasons.family.label)
    await userEvent.press(screen.getByRole('radio', { name: strings.entries.yesterday }))
    await save()

    await waitFor(async () => {
      expect(await withdrawals()).toEqual([expect.objectContaining({ date: YESTERDAY })])
    })
  })

  it('records a day picked from the calendar', async () => {
    await fundHolds(800_000)
    await render()

    await typeAmount(10_000)
    await chooseReason(strings.withdrawal.reasons.family.label)
    await userEvent.press(screen.getByRole('radio', { name: strings.entries.otherDate }))
    await fireEvent(screen.getByTestId('entry-date-picker'), 'dateChange', {
      nativeEvent: { date: '2026-09-14T00:00:00.000Z' },
    })
    await save()

    await waitFor(async () => {
      expect(await withdrawals()).toEqual([expect.objectContaining({ date: '2026-09-14' })])
    })
  })

  // The explanation under "Outra data" is about a withdrawal here, not a contribution.
  it('explains another date in terms of a withdrawal', async () => {
    await render()

    expect(screen.getByText(strings.withdrawal.otherDateExplanation)).toBeTruthy()
    expect(screen.queryByText(strings.entries.otherDateExplanation)).toBeNull()
  })

  it('says so when storage fails, and keeps what was typed', async () => {
    await fundHolds(800_000)
    jest
      .spyOn(harness.repositories.ledger, 'add')
      .mockResolvedValue(err(storageError('ledger.write-failed')))
    await render()

    await typeAmount(10_000)
    await chooseReason(strings.withdrawal.reasons.family.label)
    await save()

    expect(await screen.findByText(strings.state.errorBody)).toBeTruthy()
    expect(screen.getByTestId('amount-input').props.value).toBe(formatted(10_000))
    expect(mockBack).not.toHaveBeenCalled()
  })

  it('goes home after saving when there is nowhere to go back to', async () => {
    mockCanGoBack = false
    await fundHolds(800_000)
    await render()

    await typeAmount(10_000)
    await chooseReason(strings.withdrawal.reasons.family.label)
    await save()

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/')
    })
  })
})

/** Spec, Story 5 scenario 2: a balance of 5,000 and a withdrawal of 6,000. */
describe('the over-balance confirmation (FR-017)', () => {
  async function overdraw(): Promise<void> {
    await fundHolds(500_000)
    await render()
    await typeAmount(600_000)
    await chooseReason(strings.withdrawal.reasons['income-loss'].label)
    await save()
  }

  it('warns, saying the balance and how far below zero it would leave the fund, and writes nothing yet', async () => {
    await overdraw()

    expect(await screen.findByText(strings.withdrawal.overBalanceTitle)).toBeTruthy()
    expect(
      screen.getByText(strings.withdrawal.overBalanceBody(formatted(500_000), formatted(100_000))),
    ).toBeTruthy()
    expect(await withdrawals()).toEqual([])
    expect(mockBack).not.toHaveBeenCalled()
  })

  // Not a failure: the warning is the answer, and "could not load" beside it would be false.
  it('does not report the warning as a failure', async () => {
    await overdraw()

    await screen.findByText(strings.withdrawal.overBalanceTitle)
    expect(screen.queryByText(strings.state.errorBody)).toBeNull()
  })

  it('records the withdrawal once confirmed, and leaves', async () => {
    await overdraw()

    await userEvent.press(
      await screen.findByRole('button', { name: strings.withdrawal.overBalanceConfirm }),
    )

    await waitFor(() => {
      expect(mockBack).toHaveBeenCalled()
    })
    expect(await withdrawals()).toEqual([
      expect.objectContaining({ amount: 600_000, withdrawalReason: 'income-loss' }),
    ])
  })

  it('records nothing when cancelled, and keeps the form as it was', async () => {
    await overdraw()

    await userEvent.press(await screen.findByRole('button', { name: strings.action.cancel }))

    expect(screen.queryByText(strings.withdrawal.overBalanceTitle)).toBeNull()
    expect(screen.getByTestId('amount-input').props.value).toBe(formatted(600_000))
    expect(await withdrawals()).toEqual([])
    expect(mockBack).not.toHaveBeenCalled()
  })

  // Corrected to fit after cancelling, the next save goes straight through.
  it('asks again only if the corrected amount is still too much', async () => {
    await overdraw()
    await userEvent.press(await screen.findByRole('button', { name: strings.action.cancel }))

    await typeAmount(400_000)
    await save()

    await waitFor(() => {
      expect(mockBack).toHaveBeenCalled()
    })
    expect(screen.queryByText(strings.withdrawal.overBalanceTitle)).toBeNull()
    expect(await withdrawals()).toEqual([expect.objectContaining({ amount: 400_000 })])
  })

  // Emptying the fund is not overdrawing it.
  it('does not ask about a withdrawal of exactly the balance', async () => {
    await fundHolds(500_000)
    await render()

    await typeAmount(500_000)
    await chooseReason(strings.withdrawal.reasons.family.label)
    await save()

    await waitFor(() => {
      expect(mockBack).toHaveBeenCalled()
    })
    expect(screen.queryByText(strings.withdrawal.overBalanceTitle)).toBeNull()
  })
})
