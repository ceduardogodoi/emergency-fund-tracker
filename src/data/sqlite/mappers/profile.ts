import { instant } from '@/domain/dates/instant'
import { currencyCode } from '@/domain/money/currency'
import { money } from '@/domain/money/money'
import type { Profile } from '@/domain/profile/types'

/**
 * The `profile` row as SQLite hands it back.
 *
 * Every field is a driver primitive. Nothing branded appears here, because branding a
 * value is the mapping — a row type that already spoke in `Money` would be claiming the
 * check had happened before it had.
 */
export interface ProfileRow {
  readonly monthly_expenses_minor: number
  readonly currency_code: string
  readonly created_at: string
  readonly updated_at: string
}

/**
 * Turns a stored row into a {@link Profile}.
 *
 * The branded constructors are called rather than the values cast, so a row that violated
 * the schema — a fractional amount, a malformed timestamp — fails here rather than
 * travelling on as a value the domain believes it has already validated.
 *
 * @param row The row as read.
 * @returns The domain profile.
 * @throws {RangeError} If a stored value is not what the schema promised.
 */
export function toProfile(row: ProfileRow): Profile {
  return {
    monthlyExpenses: money(row.monthly_expenses_minor),
    currency: currencyCode(row.currency_code),
    createdAt: instant(row.created_at),
    updatedAt: instant(row.updated_at),
  }
}
