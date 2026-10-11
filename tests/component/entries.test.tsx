import { fireEvent, screen, userEvent, within } from '@testing-library/react-native'

import { calendarDate } from '@/domain/dates/calendar-date'
import { storageError } from '@/domain/errors/app-error'
import { MAXIMUM_NOTE_LENGTH } from '@/domain/ledger/entry'
import type { LedgerEntryInput } from '@/domain/ledger/types'
import { money } from '@/domain/money/money'
import { err } from '@/domain/result'
import { strings, validationMessage } from '@/ui/strings'
import { createAppHarness, type AppHarness } from '@tests/support/app-harness'
import { expectOk } from '@tests/support/expect-result'
import ContributeScreen from '../../app/entries/contribute'
import HistoryScreen from '../../app/entries/index'

/**
 * Recording a contribution (FR-008, FR-009, FR-010), and reading back what was recorded
 * (FR-014).
 *
 * Today is the first of a month, so "Ontem" has to cross into the previous one: a date that
 * could be produced by editing the last digit would pass against arithmetic that is wrong.
 */
const TODAY = '2026-10-01'
const YESTERDAY = '2026-09-30'

const mockBack = jest.fn()
const mockPush = jest.fn()
const mockReplace = jest.fn()
let mockCanGoBack = true

// Where the screen goes once it has saved is the router's business; the screen is tested
// for asking to go there.
jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockBack,
    push: mockPush,
    replace: mockReplace,
    canGoBack: () => mockCanGoBack,
  }),
}))

let harness: AppHarness

beforeEach(() => {
  harness = createAppHarness(TODAY)
  mockBack.mockClear()
  mockPush.mockClear()
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

describe('the history screen', () => {
  /** Stores an entry directly, the way a screen's save would have. */
  async function record(entry: Partial<LedgerEntryInput>): Promise<void> {
    expectOk(
      await harness.repositories.ledger.add({
        type: 'contribution',
        amount: money(12_345),
        date: calendarDate('2026-09-15'),
        note: null,
        withdrawalReason: null,
        ...entry,
      }),
    )
  }

  /** For what is on screen but kept from assistive technology, which queries skip by default. */
  const DRAWN = { includeHiddenElements: true }

  /** An amount as the formatter renders it, before the row says which way it moved. */
  function formatted(minorUnits: number): string {
    return harness.services.format.money(money(minorUnits))
  }

  // Recorded out of order on purpose, and in neither direction the screen could fall into
  // by doing nothing: the ledger hands entries over oldest first, and these were not
  // written that way round either.
  it('lists every entry, the most recent first', async () => {
    await record({ date: calendarDate('2026-09-10') })
    await record({ date: calendarDate('2026-09-30') })
    await record({ date: calendarDate('2026-09-20') })

    await harness.render(<HistoryScreen />)

    const rows = await screen.findAllByTestId('entry-row')
    expect(rows).toHaveLength(3)
    expect(within(rows[0]!).getByText(shown('2026-09-30'))).toBeTruthy()
    expect(within(rows[1]!).getByText(shown('2026-09-20'))).toBeTruthy()
    expect(within(rows[2]!).getByText(shown('2026-09-10'))).toBeTruthy()
  })

  // FR-014, and the ui-contract's rule that colour is never the only signal. The two
  // entries carry the same amount on the same day, so the words, the mark, and the sign are
  // all that can tell them apart — which is the position of a reader who cannot see the
  // colours.
  it('tells a contribution from a withdrawal in words, by a mark, and by a sign', async () => {
    await record({ type: 'contribution', amount: money(50_000) })
    await record({ type: 'withdrawal', amount: money(50_000), withdrawalReason: 'Conserto' })

    await harness.render(<HistoryScreen />)

    const [withdrawal, contribution] = await screen.findAllByTestId('entry-row')
    expect(within(withdrawal!).getByText(strings.entries.kinds.withdrawal.label)).toBeTruthy()
    expect(within(withdrawal!).getByText(strings.entries.kinds.withdrawal.mark, DRAWN)).toBeTruthy()
    expect(
      within(withdrawal!).getByText(strings.entries.kinds.withdrawal.amount(formatted(50_000))),
    ).toBeTruthy()
    expect(within(contribution!).getByText(strings.entries.kinds.contribution.label)).toBeTruthy()
    expect(
      within(contribution!).getByText(strings.entries.kinds.contribution.mark, DRAWN),
    ).toBeTruthy()
    expect(
      within(contribution!).getByText(strings.entries.kinds.contribution.amount(formatted(50_000))),
    ).toBeTruthy()
  })

  // The mark repeats the word beside it, for the eye. Announced, it would be a stray
  // "mais" in front of every contribution.
  it('keeps the mark from a screen reader, which is told the kind in words', async () => {
    await record({ type: 'contribution' })

    await harness.render(<HistoryScreen />)

    const row = await screen.findByTestId('entry-row')
    expect(within(row).queryByText(strings.entries.kinds.contribution.mark)).toBeNull()
    expect(within(row).getByText(strings.entries.kinds.contribution.label)).toBeTruthy()
  })

  // The three kinds read differently, or the test above proves only that each row reads
  // its own copy.
  it('has a different word, mark, and signed amount for each kind of entry', () => {
    const kinds = Object.values(strings.entries.kinds)

    expect(new Set(kinds.map((kind) => kind.label)).size).toBe(kinds.length)
    expect(new Set(kinds.map((kind) => kind.mark)).size).toBe(kinds.length)
    expect(new Set(kinds.map((kind) => kind.amount('R$ 1,00'))).size).toBe(kinds.length)
  })

  it('names the opening balance as what it is', async () => {
    await record({ type: 'opening', amount: money(300_000) })

    await harness.render(<HistoryScreen />)

    const row = await screen.findByTestId('entry-row')
    expect(within(row).getByText(strings.entries.kinds.opening.label)).toBeTruthy()
    expect(
      within(row).getByText(strings.entries.kinds.opening.amount(formatted(300_000))),
    ).toBeTruthy()
  })

  it('shows what the user wrote about an entry: a note, or why money was withdrawn', async () => {
    await record({ date: calendarDate('2026-09-30'), note: 'Décimo terceiro' })
    await record({
      type: 'withdrawal',
      date: calendarDate('2026-09-20'),
      withdrawalReason: 'Conserto do carro',
    })

    await harness.render(<HistoryScreen />)

    const [noted, withdrawn] = await screen.findAllByTestId('entry-row')
    expect(within(noted!).getByText('Décimo terceiro')).toBeTruthy()
    expect(within(withdrawn!).getByText('Conserto do carro')).toBeTruthy()
  })

  // FR-025: an empty view says what will appear and what produces it, and offers the action.
  it('says what will appear when nothing has been recorded, and offers the way to record it', async () => {
    await harness.render(<HistoryScreen />)

    expect(await screen.findByText(strings.entries.historyEmptyTitle)).toBeTruthy()
    expect(screen.getByText(strings.entries.historyEmptyBody)).toBeTruthy()
    expect(screen.queryByTestId('entry-row')).toBeNull()

    await userEvent.press(screen.getByRole('button', { name: strings.home.contributeAction }))

    expect(mockPush).toHaveBeenCalledWith('/entries/contribute')
  })

  // An unreadable ledger is not an empty one, and saying "nothing recorded yet" to someone
  // with years of entries would be the worst thing this screen could do.
  it('reports a ledger it cannot read, rather than an empty history', async () => {
    jest
      .spyOn(harness.repositories.ledger, 'list')
      .mockResolvedValue(err(storageError('ledger.read-failed')))

    await harness.render(<HistoryScreen />)

    expect(await screen.findByText(strings.state.errorTitle)).toBeTruthy()
    expect(screen.queryByText(strings.entries.historyEmptyTitle)).toBeNull()
  })
})
