/**
 * An ISO 4217 currency code — three uppercase letters.
 *
 * A fund has exactly one currency, chosen at setup and changeable only by erasing the
 * fund (FR-039), so the code lives on the profile rather than being carried by every
 * amount. Pairing it with each `Money` would be noise that never varies.
 */
export type CurrencyCode = string & { readonly __brand: 'CurrencyCode' }

const CURRENCY_PATTERN = /^[A-Z]{3}$/

/**
 * Validates and brands a currency code.
 *
 * Checks shape only, deliberately: the ISO register changes over time, and rejecting a
 * well-formed but unrecognized code would lock a user out of their own currency.
 * `Intl.NumberFormat` degrades gracefully for codes it does not know.
 *
 * @param value A three-letter uppercase code, such as `USD` or `BRL`.
 * @throws {RangeError} If not exactly three uppercase letters.
 */
export function currencyCode(value: string): CurrencyCode {
  if (!CURRENCY_PATTERN.test(value)) {
    throw new RangeError(`Expected a three-letter ISO 4217 code, received "${value}"`)
  }
  return value as CurrencyCode
}
