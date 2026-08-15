/**
 * Money is an integer count of the currency's minor unit (cents) — never a float.
 *
 * The brand makes it a compile error to pass a raw `number` where an amount is expected,
 * which is what stops the class of bug SC-007 tests for. JavaScript integers are exact
 * to 2^53 — roughly 90 trillion in cents — so addition and subtraction, which is all the
 * ledger needs, are exact with no dependency and no decimal library.
 *
 * The type carries no currency code. A fund has exactly one currency (FR-039), held on
 * the profile, so pairing it with every amount would be noise that never varies.
 */
export type Money = number & { readonly __brand: 'Money' }

/**
 * Constructs an amount from a count of minor units.
 *
 * Throws rather than returning a `Result` because a fractional or unsafe value here is a
 * programmer error, not a user error — user input is parsed and validated at the edge,
 * where a typed failure is the right answer.
 *
 * @param minorUnits Whole cents. May be negative: deltas and corrections are amounts too.
 * @returns The branded amount.
 * @throws {RangeError} If not an integer, or beyond exact integer precision.
 */
export function money(minorUnits: number): Money {
  if (!Number.isInteger(minorUnits)) {
    throw new RangeError(`Money requires integer minor units, received ${minorUnits}`)
  }
  if (!Number.isSafeInteger(minorUnits)) {
    throw new RangeError(`Money exceeds exact integer precision: ${minorUnits}`)
  }
  return minorUnits as Money
}

/** The additive identity. Use instead of `money(0)` so the empty case reads as intent. */
export const zero: Money = money(0)

/**
 * Adds two amounts exactly.
 *
 * @returns The sum.
 * @throws {RangeError} If the result exceeds exact integer precision.
 */
export function add(a: Money, b: Money): Money {
  return money(a + b)
}

/**
 * Subtracts `b` from `a` exactly. The result may be negative — callers that need a
 * floor (such as "amount remaining", which must never display below zero) clamp it.
 *
 * @returns The difference, which may be negative.
 * @throws {RangeError} If the result exceeds exact integer precision.
 */
export function subtract(a: Money, b: Money): Money {
  return money(a - b)
}

/**
 * Multiplies an amount by a whole number — the operation behind a target of
 * monthly expenses × months of coverage (FR-004).
 *
 * @param factor A whole number. Fractional scaling would reintroduce rounding, so it is
 *   rejected; anything needing division goes through the rounding module instead.
 * @throws {RangeError} If `factor` is not an integer, or the result is not exact.
 */
export function multiply(amount: Money, factor: number): Money {
  if (!Number.isInteger(factor)) {
    throw new RangeError(`Money can only be multiplied by an integer, received ${factor}`)
  }
  return money(amount * factor)
}

/**
 * Totals a list of amounts. This is the operation the balance is built from, so its
 * exactness across long sequences is what SC-007 verifies.
 *
 * @returns The total, or {@link zero} for an empty list.
 * @throws {RangeError} If the total exceeds exact integer precision.
 */
export function sum(amounts: readonly Money[]): Money {
  return money(amounts.reduce<number>((total, amount) => total + amount, 0))
}

/** True when the amount is exactly zero. */
export function isZero(amount: Money): boolean {
  return amount === 0
}

/** True when the amount is below zero — a net loss over a period, or an overdrawn delta. */
export function isNegative(amount: Money): boolean {
  return amount < 0
}

/** True when the amount is above zero. A saving pace must be positive to project a date. */
export function isPositive(amount: Money): boolean {
  return amount > 0
}

/**
 * Orders two amounts, in the shape `Array.prototype.sort` expects.
 *
 * @returns Negative when `a < b`, positive when `a > b`, zero when equal.
 */
export function compare(a: Money, b: Money): number {
  return a - b
}

/** The larger of two amounts. */
export function maxOf(a: Money, b: Money): Money {
  return a >= b ? a : b
}

/** The smaller of two amounts. */
export function minOf(a: Money, b: Money): Money {
  return a <= b ? a : b
}
