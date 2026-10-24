import { fireEvent, screen, userEvent, waitFor, within } from '@testing-library/react-native'

import { queryKeys } from '@/runtime/query'
import { calendarDate } from '@/domain/dates/calendar-date'
import { storageError } from '@/domain/errors/app-error'
import { MAXIMUM_NOTE_LENGTH } from '@/domain/ledger/entry'
import type { LedgerEntry, LedgerEntryInput } from '@/domain/ledger/types'
import { money } from '@/domain/money/money'
import { err } from '@/domain/result'
import { strings, validationMessage } from '@/ui/strings'
import { createAppHarness, type AppHarness } from '@tests/support/app-harness'
import { expectOk } from '@tests/support/expect-result'
import EditEntryScreen from '../../app/entries/[id]'
import ContributeScreen from '../../app/entries/contribute'
import HistoryScreen from '../../app/entries/index'

/**
 * Recording a contribution (FR-008, FR-009, FR-010), reading back what was recorded
 * (FR-014), and correcting or deleting it (FR-011).
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
let mockParams: { id: string } = { id: '' }

// Where the screen goes once it has saved is the router's business; the screen is tested
// for asking to go there.
jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockBack,
    push: mockPush,
    replace: mockReplace,
    canGoBack: () => mockCanGoBack,
  }),
  useLocalSearchParams: () => mockParams,
}))

let harness: AppHarness

beforeEach(() => {
  harness = createAppHarness(TODAY)
  mockBack.mockClear()
  mockPush.mockClear()
  mockReplace.mockClear()
  mockCanGoBack = true
  mockParams = { id: '' }
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

/** Stores an entry directly, the way a screen's save would have. */
async function record(entry: Partial<LedgerEntryInput> = {}): Promise<LedgerEntry> {
  return expectOk(
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

/** An amount as the formatter renders it, before a row says which way it moved. */
function formatted(minorUnits: number): string {
  return harness.services.format.money(money(minorUnits))
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
  /** For what is on screen but kept from assistive technology, which queries skip by default. */
  const DRAWN = { includeHiddenElements: true }

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
    // Nothing to press, so nothing to say about pressing it.
    expect(screen.queryByText(strings.entries.historyHint)).toBeNull()

    await userEvent.press(screen.getByRole('button', { name: strings.home.contributeAction }))

    expect(mockPush).toHaveBeenCalledWith('/entries/contribute')
  })

  // FR-011's way in. Three rows and the middle one pressed, so that neither end of the
  // list — in the order shown or the order stored — is the right answer by accident.
  it('opens the entry whose row is pressed', async () => {
    await record({ date: calendarDate('2026-09-10') })
    const pressed = await record({ date: calendarDate('2026-09-20') })
    await record({ date: calendarDate('2026-09-30') })
    await harness.render(<HistoryScreen />)

    const rows = await screen.findAllByRole('button')
    expect(rows).toHaveLength(3)
    await userEvent.press(rows[1]!)

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/entries/[id]',
      params: { id: pressed.id },
    })
  })

  // T158. A row opens its entry, and until this said so only a screen reader was told: the
  // hint on the row is announced and never drawn. In words, so it holds without colour.
  it('says above the list that an entry can be corrected or deleted by pressing it', async () => {
    await record()

    await harness.render(<HistoryScreen />)

    expect(await screen.findByText(strings.entries.historyHint)).toBeTruthy()
  })

  // And the row looks like the control it is. The mark is drawn and not announced: the row
  // already tells a screen reader what pressing it does, and a stray "›" would be read out
  // on every row.
  it('marks every row as something that opens, for the eye only', async () => {
    await record({ type: 'contribution' })
    await record({ type: 'withdrawal', withdrawalReason: 'Conserto' })

    await harness.render(<HistoryScreen />)

    const rows = await screen.findAllByTestId('entry-row')
    expect(rows).toHaveLength(2)
    for (const row of rows) {
      expect(within(row).getByText(strings.entries.rowOpens, DRAWN)).toBeTruthy()
      expect(within(row).queryByText(strings.entries.rowOpens)).toBeNull()
    }
  })

  // FR-033. Seeded through the repository, because the app refuses a future date at entry:
  // these arrive by import, or from a device clock that was ahead and has been corrected.
  // One past entry beside it, so a banner counting every entry would say two.
  it('warns about an entry dated after today, and says it is left out of the balance', async () => {
    await record({ date: calendarDate('2026-09-20') })
    await record({ date: calendarDate('2026-10-05') })

    await harness.render(<HistoryScreen />)

    expect(await screen.findByText(strings.entries.futureDated.title(1))).toBeTruthy()
    expect(screen.getByText(strings.entries.futureDated.body(1))).toBeTruthy()
  })

  // Counted, and in the plural's own words: two future entries beside a past one, so
  // neither "every entry" nor "one" is the right answer by accident.
  it('counts every entry dated after today', async () => {
    await record({ date: calendarDate('2026-11-12') })
    await record({ date: calendarDate('2026-09-20') })
    await record({ date: calendarDate('2026-10-05') })

    await harness.render(<HistoryScreen />)

    expect(await screen.findByText(strings.entries.futureDated.title(2))).toBeTruthy()
    expect(screen.getByText(strings.entries.futureDated.body(2))).toBeTruthy()
  })

  // Today is not the future: an entry dated today counts in the balance, so warning about
  // it would be false. Waits for the check to finish, since a banner that has not arrived
  // yet is also absent.
  it('says nothing about an entry dated today', async () => {
    await record({ date: calendarDate(TODAY) })

    await harness.render(<HistoryScreen />)

    await screen.findByTestId('entry-row')
    await waitFor(() => {
      expect(
        harness.queryClient.getQueryState(queryKeys.futureDatedEntries(calendarDate(TODAY)))
          ?.status,
      ).toBe('success')
    })
    expect(screen.queryByTestId('future-dated-banner')).toBeNull()
    expect(screen.queryByText(strings.entries.futureDated.unavailable)).toBeNull()
  })

  // A check that could not be made is not a check that found nothing. The history itself
  // still reads, so it stays; the banner's place says the check failed.
  it('says when it cannot check for future-dated entries, and still lists the history', async () => {
    await record()
    jest
      .spyOn(harness.repositories.ledger, 'listFutureDated')
      .mockResolvedValue(err(storageError('ledger.read-failed')))

    await harness.render(<HistoryScreen />)

    expect(await screen.findByText(strings.entries.futureDated.unavailable)).toBeTruthy()
    expect(screen.getByTestId('entry-row')).toBeTruthy()
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

describe('the edit screen', () => {
  /** Stores an entry and opens the screen on it, as a press on its row would. */
  async function open(entry: Partial<LedgerEntryInput> = {}): Promise<LedgerEntry> {
    const recorded = await record({ amount: money(43_210), note: 'Décimo terceiro', ...entry })
    mockParams = { id: recorded.id }
    await harness.render(<EditEntryScreen />)
    await screen.findByTestId('amount-input')
    return recorded
  }

  async function readBack(id: string): Promise<LedgerEntry | null> {
    return expectOk(await harness.repositories.ledger.getById(id))
  }

  async function askToDelete(): Promise<void> {
    await userEvent.press(screen.getByRole('button', { name: strings.entries.deleteAction }))
  }

  async function confirmDeletion(): Promise<void> {
    await userEvent.press(screen.getByRole('button', { name: strings.action.delete }))
  }

  // None of these is what an empty form would hold: the amount is not zero, the day is not
  // today, and the note is not blank.
  it('opens on the entry as it is stored', async () => {
    await open()

    expect(screen.getByTestId('amount-input').props.value).toBe(formatted(43_210))
    expect(screen.getByTestId('note-input').props.value).toBe('Décimo terceiro')
    expect(screen.getByText(shown('2026-09-15'))).toBeTruthy()
    expect(screen.getByTestId('entry-date-picker').props.selection).toBe('2026-09-15T00:00:00.000Z')
  })

  // Stated, since it cannot be changed here: a form that showed only an amount would not
  // say whether correcting it moves the balance up or down.
  it('says which kind of entry is being corrected', async () => {
    await open({ type: 'withdrawal', note: null, withdrawalReason: 'Conserto' })

    expect(screen.getByText(strings.entries.kinds.withdrawal.label)).toBeTruthy()
    expect(screen.queryByText(strings.entries.kinds.contribution.label)).toBeNull()
  })

  // User Story 2, scenario 2.
  it('saves a corrected amount, leaves everything else alone, and leaves', async () => {
    const entry = await open()

    await typeAmount(70_000)
    await save()

    await waitFor(() => {
      expect(mockBack).toHaveBeenCalled()
    })
    expect(await stored()).toEqual([
      expect.objectContaining({
        id: entry.id,
        type: 'contribution',
        amount: 70_000,
        date: '2026-09-15',
        note: 'Décimo terceiro',
      }),
    ])
  })

  it('moves the entry to a day picked from the calendar, and shows which one', async () => {
    const entry = await open()

    await pickDay('2026-09-03T00:00:00.000Z')

    expect(screen.getByText(shown('2026-09-03'))).toBeTruthy()

    await save()

    await waitFor(() => {
      expect(mockBack).toHaveBeenCalled()
    })
    expect(await readBack(entry.id)).toMatchObject({ date: '2026-09-03', amount: 43_210 })
  })

  // FR-009 holds for a correction as it does for a new entry.
  it('offers no day after today', async () => {
    await open()

    expect(screen.getByTestId('entry-date-picker').props.range).toEqual({
      end: `${TODAY}T12:00:00.000Z`,
    })
  })

  it('rewrites the note, without the whitespace around it', async () => {
    const entry = await open()

    await fireEvent.changeText(screen.getByTestId('note-input'), '  Bônus de setembro  ')
    await save()

    await waitFor(() => {
      expect(mockBack).toHaveBeenCalled()
    })
    expect(await readBack(entry.id)).toMatchObject({ note: 'Bônus de setembro' })
  })

  it('removes a note that is emptied', async () => {
    const entry = await open()

    await fireEvent.changeText(screen.getByTestId('note-input'), '   ')
    await save()

    await waitFor(() => {
      expect(mockBack).toHaveBeenCalled()
    })
    expect(await readBack(entry.id)).toMatchObject({ note: null })
  })

  it('refuses an amount of zero under the amount, and changes nothing', async () => {
    const entry = await open()

    await typeAmount(0)
    await save()

    expect(await screen.findByText(strings.validation.entryAmountMustBePositive)).toBeTruthy()
    expect(screen.queryByText(strings.state.errorBody)).toBeNull()
    expect(await readBack(entry.id)).toEqual(entry)
    expect(mockBack).not.toHaveBeenCalled()
  })

  it('clears the refusal once the amount is changed', async () => {
    await open()
    await typeAmount(0)
    await save()
    await screen.findByText(strings.validation.entryAmountMustBePositive)

    await typeAmount(70_000)

    expect(screen.queryByText(strings.validation.entryAmountMustBePositive)).toBeNull()
  })

  it('refuses a note over the limit, under the note', async () => {
    const entry = await open()

    await fireEvent.changeText(
      screen.getByTestId('note-input'),
      'a'.repeat(MAXIMUM_NOTE_LENGTH + 1),
    )
    await save()

    expect(await screen.findByText(strings.validation.entryNoteTooLong)).toBeTruthy()
    expect(await readBack(entry.id)).toEqual(entry)
  })

  // The calendar cannot offer a day after today, but today can move back under an open
  // form — a device clock that was ahead and is corrected. The refusal belongs under the
  // date, where the thing to change is, and not in the line that reports a storage failure.
  it('refuses a day the clock has since put in the future, under the date', async () => {
    const entry = await open({ date: calendarDate(YESTERDAY) })

    harness.clock.setToday('2026-09-20')
    await save()

    expect(await screen.findByText(strings.validation.entryDateInFuture)).toBeTruthy()
    expect(screen.queryByText(strings.state.errorBody)).toBeNull()
    expect(await readBack(entry.id)).toEqual(entry)
  })

  it('says so when the correction cannot be stored, and keeps what was typed', async () => {
    jest
      .spyOn(harness.repositories.ledger, 'update')
      .mockResolvedValue(err(storageError('ledger.update-failed')))
    await open()

    await typeAmount(70_000)
    await save()

    expect(await screen.findByText(strings.state.errorBody)).toBeTruthy()
    expect(screen.getByTestId('amount-input').props.value).toBe(formatted(70_000))
    expect(mockBack).not.toHaveBeenCalled()
  })

  // A withdrawal has a reason where the others have a note, and what a reason may be is
  // User Story 5's to say (FR-016). Until then the form does not offer one to edit — and
  // must not wipe the one that is there by saving a note over it.
  it('corrects a withdrawal without touching why it was made', async () => {
    const entry = await open({ type: 'withdrawal', note: null, withdrawalReason: 'Conserto' })

    expect(screen.queryByTestId('note-input')).toBeNull()

    await typeAmount(70_000)
    await save()

    await waitFor(() => {
      expect(mockBack).toHaveBeenCalled()
    })
    expect(await readBack(entry.id)).toMatchObject({
      amount: 70_000,
      note: null,
      withdrawalReason: 'Conserto',
    })
  })

  // User Story 2, scenario 3: deletion requires explicit confirmation.
  it('asks before deleting, and says what is lost', async () => {
    const entry = await open()

    expect(screen.queryByText(strings.entries.deleteTitle)).toBeNull()

    await askToDelete()

    expect(screen.getByText(strings.entries.deleteTitle)).toBeTruthy()
    expect(screen.getByText(strings.entries.deleteBody)).toBeTruthy()
    expect(await readBack(entry.id)).toEqual(entry)
  })

  it('keeps the entry when the question is answered with cancel', async () => {
    const entry = await open()

    await askToDelete()
    await userEvent.press(screen.getByRole('button', { name: strings.action.cancel }))

    expect(screen.queryByText(strings.entries.deleteTitle)).toBeNull()
    expect(await readBack(entry.id)).toEqual(entry)
    expect(mockBack).not.toHaveBeenCalled()
  })

  // The entry is gone from the cache before the screen has left, so for a moment this is
  // a screen about an entry that does not exist. It must still leave, and it must not
  // spend that moment telling the user the entry could not be found.
  it('deletes once confirmed, and leaves without calling the entry missing', async () => {
    const entry = await open()
    const kept = await record({ amount: money(900) })

    await askToDelete()
    await confirmDeletion()

    await waitFor(() => {
      expect(mockBack).toHaveBeenCalled()
    })
    expect(await readBack(entry.id)).toBeNull()
    expect(await stored()).toEqual([expect.objectContaining({ id: kept.id })])
    expect(screen.queryByText(strings.entries.missingTitle)).toBeNull()
  })

  it('says so when the entry cannot be deleted, and stays', async () => {
    jest
      .spyOn(harness.repositories.ledger, 'remove')
      .mockResolvedValue(err(storageError('ledger.remove-failed')))
    const entry = await open()

    await askToDelete()
    await confirmDeletion()

    expect(await screen.findByText(strings.state.errorBody)).toBeTruthy()
    expect(screen.queryByText(strings.entries.deleteTitle)).toBeNull()
    expect(await readBack(entry.id)).toEqual(entry)
    expect(mockBack).not.toHaveBeenCalled()
  })

  it('says so when there is no such entry', async () => {
    await record()
    mockParams = { id: 'no-such-entry' }

    await harness.render(<EditEntryScreen />)

    expect(await screen.findByText(strings.entries.missingTitle)).toBeTruthy()
    expect(screen.queryByTestId('amount-input')).toBeNull()
  })

  it('reports a ledger it cannot read, rather than a missing entry', async () => {
    jest
      .spyOn(harness.repositories.ledger, 'list')
      .mockResolvedValue(err(storageError('ledger.read-failed')))
    mockParams = { id: 'any' }

    await harness.render(<EditEntryScreen />)

    expect(await screen.findByText(strings.state.errorTitle)).toBeTruthy()
    expect(screen.queryByText(strings.entries.missingTitle)).toBeNull()
  })
})
