import { coveredMonths } from '@/domain/ledger/coverage'
import { money } from '@/domain/money/money'

/**
 * How many months of the plan the balance covers, as Home's meter draws it (T157).
 *
 * The plan is six months of R$ 2.000,00 throughout, so a count that escaped the cap, or a
 * division that rounded up, lands on a number these tests do not expect.
 */
const EXPENSES = money(200_000)
const PLANNED_MONTHS = 6

describe('coveredMonths', () => {
  it('counts the whole months of expenses the balance covers', () => {
    expect(coveredMonths(money(590_000), EXPENSES, PLANNED_MONTHS)).toBe(2)
  })

  // Eight months of expenses in a six-month plan. The meter has six units, and the caption
  // says "de 6 meses"; "8 de 6" would be a sentence nobody can read.
  it('stops at the plan when the balance covers more', () => {
    expect(coveredMonths(money(1_650_000), EXPENSES, PLANNED_MONTHS)).toBe(PLANNED_MONTHS)
  })

  it('covers the whole plan at exactly its cost', () => {
    expect(coveredMonths(money(1_200_000), EXPENSES, PLANNED_MONTHS)).toBe(PLANNED_MONTHS)
  })

  it('covers nothing for an empty or overdrawn fund', () => {
    expect(coveredMonths(money(0), EXPENSES, PLANNED_MONTHS)).toBe(0)
    expect(coveredMonths(money(-50_000), EXPENSES, PLANNED_MONTHS)).toBe(0)
  })
})
