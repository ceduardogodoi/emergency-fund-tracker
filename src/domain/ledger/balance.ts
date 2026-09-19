import type { CalendarDate } from '../dates/calendar-date'
import { isAfter } from '../dates/calendar-date'
import { money, zero, type Money } from '../money/money'
import type { LedgerEntry } from './types'

/**
 * The fund, as of today (FR-012).
 *
 * Summed from the entries every time it is asked for rather than stored. That is what makes
 * an edit or a deletion correct by construction: there is no running total to forget to
 * adjust, and no way for a stored balance to disagree with the rows it came from. SC-007
 * checks that over a thousand randomised sequences.
 *
 * Future-dated entries are excluded (FR-033). Money the user has not moved yet is not money
 * they have, and counting it would overstate the fund on the screen they trust most. Those
 * entries are surfaced separately for correction rather than silently dropped.
 *
 * The result may be negative: a withdrawal larger than everything saved is a real state
 * that FR-017 warns about but does not forbid, and clamping it here would hide it from
 * every caller.
 *
 * @param entries Every entry in the fund, in any order — addition commutes, so a repository
 *   that changes its sort cannot change the balance.
 * @param today The current date, from the `Clock` port.
 * @returns Opening plus contributions minus withdrawals, over entries dated today or earlier.
 */
export function calculateBalance(entries: readonly LedgerEntry[], today: CalendarDate): Money {
  return money(
    entries.reduce<number>((total, entry) => {
      if (isAfter(entry.date, today)) {
        return total
      }
      return entry.type === 'withdrawal' ? total - entry.amount : total + entry.amount
    }, zero),
  )
}
