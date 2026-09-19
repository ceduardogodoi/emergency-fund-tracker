import { calendarDate } from '@/domain/dates/calendar-date'
import { MAXIMUM_NOTE_LENGTH, validateEntry, type EntryContext } from '@/domain/ledger/entry'
import type { EntryType, LedgerEntryInput } from '@/domain/ledger/types'
import { money } from '@/domain/money/money'
import { expectErr, expectOk } from '@tests/support/expect-result'

/**
 * What the app will accept into the ledger (FR-008 through FR-010).
 *
 * The rules live in the domain rather than in the form, because an entry also arrives from
 * an imported file (FR-046), where no form has been anywhere near it. A rule enforced only
 * by the screen is a rule the import path does not have.
 *
 * Withdrawal-specific rules — a reason, and the over-balance warning — are FR-016 and
 * FR-017, and arrive with User Story 5 at T117.
 */
const TODAY = calendarDate('2026-08-22')

/** A valid entry, for tests that break one thing about it. */
function entryInput(overrides: Partial<LedgerEntryInput> = {}): LedgerEntryInput {
  return {
    type: 'contribution',
    amount: money(50_000),
    date: TODAY,
    note: null,
    withdrawalReason: null,
    ...overrides,
  }
}

/** The context the rules that look beyond a single entry need. */
function context(hasOpening = false): EntryContext {
  return { today: TODAY, hasOpening }
}

describe('validateEntry', () => {
  it('accepts a contribution dated today', () => {
    expect(expectOk(validateEntry(entryInput(), context()))).toEqual(entryInput())
  })

  describe('the amount', () => {
    // FR-008: greater than zero. A zero entry is not a contribution, and the history would
    // carry a row that changed nothing.
    it.each([0, -1, -50_000])('refuses %d', (minorUnits) => {
      const failure = expectErr(validateEntry(entryInput({ amount: money(minorUnits) }), context()))

      expect(failure).toMatchObject({ kind: 'validation', field: 'amount' })
    })

    it('accepts the smallest amount the currency has', () => {
      expect(expectOk(validateEntry(entryInput({ amount: money(1) }), context()))).toBeTruthy()
    })
  })

  describe('the date', () => {
    // FR-009. Money the user has not moved yet is not in the fund, and dating it forward is
    // the mistake FR-033 then has to flag on every screen that counts.
    it('refuses a date after today', () => {
      const failure = expectErr(
        validateEntry(entryInput({ date: calendarDate('2026-08-23') }), context()),
      )

      expect(failure).toMatchObject({ kind: 'validation', field: 'date' })
    })

    it('accepts today, which is the boundary the rule turns on', () => {
      expect(expectOk(validateEntry(entryInput({ date: TODAY }), context()))).toBeTruthy()
    })

    it('accepts a past date, which is how a forgotten contribution is recorded', () => {
      expect(
        expectOk(validateEntry(entryInput({ date: calendarDate('2020-01-01') }), context())),
      ).toBeTruthy()
    })
  })

  describe('the note', () => {
    it('accepts a note at the limit', () => {
      const note = 'a'.repeat(MAXIMUM_NOTE_LENGTH)

      expect(expectOk(validateEntry(entryInput({ note }), context()))).toBeTruthy()
    })

    it('refuses a note past the limit', () => {
      const note = 'a'.repeat(MAXIMUM_NOTE_LENGTH + 1)
      const failure = expectErr(validateEntry(entryInput({ note }), context()))

      expect(failure).toMatchObject({ kind: 'validation', field: 'note' })
    })

    it('accepts no note at all, since FR-008 makes it optional', () => {
      expect(expectOk(validateEntry(entryInput({ note: null }), context()))).toBeTruthy()
    })
  })

  describe('the opening balance', () => {
    // FR-010, and the data model's partial unique index. Two openings would double-count
    // money that was set aside once, and the balance would be wrong with no visible cause.
    it('refuses a second opening entry', () => {
      const failure = expectErr(validateEntry(entryInput({ type: 'opening' }), context(true)))

      expect(failure).toMatchObject({ kind: 'validation', field: 'type' })
    })

    it('accepts the first opening entry', () => {
      expect(expectOk(validateEntry(entryInput({ type: 'opening' }), context(false)))).toBeTruthy()
    })

    // The constraint is about openings alone: a fund gains contributions forever.
    it.each<EntryType>(['contribution', 'withdrawal'])(
      'accepts a %s even once an opening exists',
      (type) => {
        const input = entryInput({
          type,
          withdrawalReason: type === 'withdrawal' ? 'Emergência' : null,
        })

        expect(expectOk(validateEntry(input, context(true)))).toBeTruthy()
      },
    )
  })
})
