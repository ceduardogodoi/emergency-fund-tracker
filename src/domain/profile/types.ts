import type { Instant } from '../dates/instant'
import type { CurrencyCode } from '../money/currency'
import type { Money } from '../money/money'

/**
 * The person's saving context: what they spend in a typical month and which currency
 * they track in. Exactly one exists per install — there is no account and no second user
 * (FR-041), which is why nothing here carries an owner id.
 */
export interface Profile {
  /** Average monthly essential expenses. Always above zero (FR-001). */
  readonly monthlyExpenses: Money
  /** Fixed at setup; changing it requires erasing the fund (FR-039). */
  readonly currency: CurrencyCode
  readonly createdAt: Instant
  readonly updatedAt: Instant
}

/**
 * The caller-supplied half of a {@link Profile}. Audit timestamps are set by the
 * repository from the injected clock, never passed in, so they cannot be forged or
 * accidentally back-dated.
 */
export interface ProfileInput {
  readonly monthlyExpenses: Money
  readonly currency: CurrencyCode
}
