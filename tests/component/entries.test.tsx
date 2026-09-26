import { fireEvent, screen, userEvent } from '@testing-library/react-native'

import { calendarDate } from '@/domain/dates/calendar-date'
import { storageError } from '@/domain/errors/app-error'
import { MAXIMUM_NOTE_LENGTH } from '@/domain/ledger/entry'
import { money } from '@/domain/money/money'
import { err } from '@/domain/result'
import { strings, validationMessage } from '@/ui/strings'
import { createAppHarness, type AppHarness } from '@tests/support/app-harness'
import { expectOk } from '@tests/support/expect-result'
import ContributeScreen from '../../app/entries/contribute'

/**
 * Recording a contribution (FR-008, FR-009, FR-010).
 *
 * Today is the first of a month, so "Ontem" has to cross into the previous one: a date that
 * could be produced by editing the last digit would pass against arithmetic that is wrong.
 */
const TODAY = '2026-10-01'
const YESTERDAY = '2026-09-30'

const mockBack = jest.fn()
const mockReplace = jest.fn()
let mockCanGoBack = true

// Where the screen goes once it has saved is the router's business; the screen is tested
// for asking to go there.
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, replace: mockReplace, canGoBack: () => mockCanGoBack }),
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

/** Types an amount the way the money input reads it: the digits are minor units. */
async function typeAmount(minorUnits: number): Promise<void> {
  await fireEvent.changeText(screen.getByTestId('amount-input'), String(minorUnits))
}

async function save(): Promise<void> {
  await userEvent.press(screen.getByRole('button', { name: strings.action.save }))
}

async function stored(): Promise<readonly unknown[]> {
  return expectOk(await harness.repositories.ledger.list())
}

/** A date as the screen renders it. */
function shown(date: string): string {
  return harness.services.format.date(calendarDate(date))
}

/** Reports a tap on a calendar day, the way the native view does. */
async function pickDay(isoInstant: string): Promise<void> {
  await fireEvent(screen.getByTestId('entry-date-picker'), 'dateChange', {
    nativeEvent: { date: isoInstant },
  })
}

describe('the contribute screen', () => {
  it('records a contribution dated today, and leaves', async () => {
    await harness.render(<ContributeScreen />)

    await typeAmount(12_345)
    await save()

    expect(await stored()).toEqual([
      expect.objectContaining({
        type: 'contribution',
        amount: 12_345,
        date: TODAY,
        note: null,
        withdrawalReason: null,
      }),
    ])
    expect(mockBack).toHaveBeenCalled()
  })

  // Most contributions are made the day they happen, so the default has to be visible as
  // a date rather than as the word "Hoje" alone — a user saving at 00:05 should be able to
  // see which day that means.
  it('opens on today, and says which day that is', async () => {
    await harness.render(<ContributeScreen />)

    expect(screen.getByRole('radio', { name: strings.entries.today })).toBeSelected()
    expect(screen.getByText(shown(TODAY))).toBeTruthy()
  })

  it('records yesterday with one tap', async () => {
    await harness.render(<ContributeScreen />)

    await typeAmount(12_345)
    await userEvent.press(screen.getByRole('radio', { name: strings.entries.yesterday }))
    await save()

    expect(await stored()).toEqual([expect.objectContaining({ date: YESTERDAY })])
  })

  it('keeps the calendar out of the way until another day is asked for', async () => {
    await harness.render(<ContributeScreen />)

    expect(screen.queryByTestId('entry-date-picker')).toBeNull()

    await userEvent.press(screen.getByRole('radio', { name: strings.entries.otherDate }))

    expect(screen.getByTestId('entry-date-picker')).toBeTruthy()
  })

  it('records a day picked from the calendar, and shows which one', async () => {
    await harness.render(<ContributeScreen />)

    await typeAmount(12_345)
    await userEvent.press(screen.getByRole('radio', { name: strings.entries.otherDate }))
    await pickDay('2026-09-14T00:00:00.000Z')

    expect(screen.getByText(shown('2026-09-14'))).toBeTruthy()

    await save()

    expect(await stored()).toEqual([expect.objectContaining({ date: '2026-09-14' })])
  })

  // The picked day is kept while another choice is in force, so returning to the calendar
  // finds it where it was left — but it must not leak into the entry once "Hoje" is chosen.
  it('records today once today is chosen again, whatever was picked before', async () => {
    await harness.render(<ContributeScreen />)

    await typeAmount(12_345)
    await userEvent.press(screen.getByRole('radio', { name: strings.entries.otherDate }))
    await pickDay('2026-09-14T00:00:00.000Z')
    await userEvent.press(screen.getByRole('radio', { name: strings.entries.today }))
    await save()

    expect(await stored()).toEqual([expect.objectContaining({ date: TODAY })])
  })

  // FR-009, at the control rather than on save: tomorrow is not a day the user can reach.
  it('offers no day after today', async () => {
    await harness.render(<ContributeScreen />)

    await userEvent.press(screen.getByRole('radio', { name: strings.entries.otherDate }))

    expect(screen.getByTestId('entry-date-picker').props.range).toEqual({
      end: `${TODAY}T12:00:00.000Z`,
    })
  })

  // The calendar cannot offer tomorrow, but today can become tomorrow under the user: a
  // device clock that was ahead and is corrected while the form is open. The rule is
  // checked against the clock at the moment of saving, and the refusal lands under the
  // date rather than as a storage failure that sends the user nowhere.
  it('refuses a picked day that the clock has since put in the future', async () => {
    await harness.render(<ContributeScreen />)

    await typeAmount(12_345)
    await userEvent.press(screen.getByRole('radio', { name: strings.entries.otherDate }))
    harness.clock.setToday(YESTERDAY)
    await save()

    expect(screen.getByText(strings.validation.entryDateInFuture)).toBeTruthy()
    expect(await stored()).toHaveLength(0)
  })

  // Pressing save on an untouched form is the most likely way to reach this message.
  it('refuses an amount of zero, says why, and writes nothing', async () => {
    await harness.render(<ContributeScreen />)

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
    expect(await stored()).toHaveLength(0)
    expect(mockBack).not.toHaveBeenCalled()
  })

  it('clears the refusal once the amount is changed', async () => {
    await harness.render(<ContributeScreen />)
    await save()

    await typeAmount(12_345)

    expect(screen.queryByText(strings.validation.entryAmountMustBePositive)).toBeNull()
  })

  it('keeps a note, without the whitespace around it', async () => {
    await harness.render(<ContributeScreen />)

    await typeAmount(12_345)
    await fireEvent.changeText(screen.getByTestId('note-input'), '  Décimo terceiro  ')
    await save()

    expect(await stored()).toEqual([expect.objectContaining({ note: 'Décimo terceiro' })])
  })

  // A note of spaces is not a note, and stored as one it would show in the history as an
  // entry with something to say and nothing said.
  it('stores a blank note as no note at all', async () => {
    await harness.render(<ContributeScreen />)

    await typeAmount(12_345)
    await fireEvent.changeText(screen.getByTestId('note-input'), '   ')
    await save()

    expect(await stored()).toEqual([expect.objectContaining({ note: null })])
  })

  it('refuses a note over the limit, under the note', async () => {
    await harness.render(<ContributeScreen />)

    await typeAmount(12_345)
    await fireEvent.changeText(
      screen.getByTestId('note-input'),
      'a'.repeat(MAXIMUM_NOTE_LENGTH + 1),
    )
    await save()

    expect(screen.getByText(strings.validation.entryNoteTooLong)).toBeTruthy()
    expect(await stored()).toHaveLength(0)
  })

  // Storage failed rather than a value being refused. The amount stays on screen, so the
  // user can retry without typing it again.
  it('says so when storage fails, and keeps what was typed', async () => {
    jest
      .spyOn(harness.repositories.ledger, 'add')
      .mockResolvedValue(err(storageError('ledger.write-failed')))
    await harness.render(<ContributeScreen />)

    await typeAmount(12_345)
    await save()

    expect(await screen.findByText(strings.state.errorBody)).toBeTruthy()
    expect(screen.getByTestId('amount-input').props.value).toBe(
      harness.services.format.money(money(12_345)),
    )
    expect(mockBack).not.toHaveBeenCalled()
  })

  // Arriving by deep link leaves no history, and `back()` there would leave a blank stack.
  it('goes home after saving when there is nowhere to go back to', async () => {
    mockCanGoBack = false
    await harness.render(<ContributeScreen />)

    await typeAmount(12_345)
    await save()

    expect(await stored()).toHaveLength(1)
    expect(mockReplace).toHaveBeenCalledWith('/')
  })
})
