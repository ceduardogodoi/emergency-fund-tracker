import { validationError, type ValidationError } from '@/domain/errors'
import { levelForCoverageMonths } from '@/domain/goal/levels'
import { validateCalculatedTarget } from '@/domain/goal/target'
import {
  validateCoverageMonths,
  validateMonthlyExpenses,
  validateTarget,
} from '@/domain/goal/validation'
import { money } from '@/domain/money/money'
import { strings, validationMessage } from '@/ui/strings'
import { expectErr } from '@tests/support/expect-result'

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
