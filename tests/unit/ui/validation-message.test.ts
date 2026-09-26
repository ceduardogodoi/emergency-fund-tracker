import { calendarDate } from '@/domain/dates/calendar-date'
import { validationError, type ValidationError } from '@/domain/errors'
import { levelForCoverageMonths } from '@/domain/goal/levels'
import { validateCalculatedTarget } from '@/domain/goal/target'
import {
  validateCoverageMonths,
  validateMonthlyExpenses,
  validateTarget,
} from '@/domain/goal/validation'
import { MAXIMUM_NOTE_LENGTH, validateEntry } from '@/domain/ledger/entry'
import type { LedgerEntryInput } from '@/domain/ledger/types'
import { money } from '@/domain/money/money'
import { fieldMessage, strings, validationMessage } from '@/ui/strings'
import { expectErr } from '@tests/support/expect-result'

/** A contribution every entry rule accepts, so each rejection below breaks exactly one. */
const entry: LedgerEntryInput = {
  type: 'contribution',
  amount: money(1),
  date: calendarDate('2026-09-26'),
  note: null,
  withdrawalReason: null,
}
const entryContext = { today: calendarDate('2026-09-26'), hasOpening: false }

/**
 * The domain reports rejections as keys so it holds no opinion about language, which only
 * works if every key it can produce has something to say in the strings module. An unmapped
 * key is not a crash — it is a form that refuses to submit and never says why.
 *
 * The keys below are collected by *running* the validators rather than by listing them, so
 * a rule that starts reporting a new key fails this test instead of shipping silently.
 */
const rejections: readonly ValidationError[] = [
  expectErr(validateMonthlyExpenses(Number.NaN)),
  expectErr(validateMonthlyExpenses(0)),
  expectErr(validateCoverageMonths(1.5)),
  expectErr(validateCoverageMonths(0)),
  expectErr(validateTarget(Number.NaN)),
  expectErr(validateTarget(0)),
  expectErr(
    validateCalculatedTarget(
      {
        target: money(1),
        source: 'calculated',
        levelKey: levelForCoverageMonths(6),
        coverageMonths: 6,
        desiredCompletionDate: null,
      },
      money(200_000),
    ),
  ) as ValidationError,
  expectErr(validateEntry({ ...entry, amount: money(0) }, entryContext)),
  expectErr(validateEntry({ ...entry, date: calendarDate('2026-09-27') }, entryContext)),
  expectErr(validateEntry({ ...entry, note: 'a'.repeat(MAXIMUM_NOTE_LENGTH + 1) }, entryContext)),
  expectErr(validateEntry({ ...entry, type: 'opening' }, { ...entryContext, hasOpening: true })),
]

describe('validationMessage', () => {
  it.each(rejections)('has something to say about $messageKey', (rejection) => {
    const message = validationMessage(rejection)
    expect(message).not.toBe(strings.validation.unknown)
    expect(message.length).toBeGreaterThan(0)
  })

  // A key from an older stored value, or from a rule added without its copy. The field
  // still has to say that it is the problem — silence would leave the user pressing a
  // button that does nothing.
  it('falls back rather than showing the key itself', () => {
    const message = validationMessage(validationError('target', 'goal.some-future-rule'))
    expect(message).toBe(strings.validation.unknown)
  })
})

/**
 * The message a form shows under one field.
 *
 * A refusal names one field, and every other field on the form must stay quiet about it —
 * a message repeated under the wrong input sends the user to correct something that is fine.
 */
describe('fieldMessage', () => {
  const refused = validationError('amount', 'entry.amount-must-be-positive')

  it('speaks under the field that was refused', () => {
    expect(fieldMessage(refused, 'amount')).toBe(strings.validation.entryAmountMustBePositive)
  })

  it('stays quiet under every other field', () => {
    expect(fieldMessage(refused, 'note')).toBeUndefined()
  })

  it('stays quiet when nothing was refused', () => {
    expect(fieldMessage(null, 'amount')).toBeUndefined()
  })
})
