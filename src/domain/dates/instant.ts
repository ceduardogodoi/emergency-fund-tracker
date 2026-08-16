/**
 * A precise moment in UTC, used only for audit fields — when a row was created, when a
 * goal was last changed, when a milestone was acknowledged.
 *
 * Deliberately a different type from `CalendarDate`: an entry's *date* is what the user
 * picked and must never shift with a timezone, whereas an audit timestamp is a real
 * instant that should stay comparable across zones. Keeping them distinct stops one
 * being used where the other belongs.
 */
export type Instant = string & { readonly __brand: 'Instant' }

/**
 * Validates and brands an ISO 8601 UTC instant.
 *
 * @param value An ISO 8601 timestamp ending in `Z`. A local offset is rejected rather
 *   than converted, because accepting one would let audit rows written in different
 *   places sort incorrectly against each other.
 * @throws {RangeError} If unparseable, or if it carries an offset instead of UTC.
 */
export function instant(value: string): Instant {
  if (Number.isNaN(Date.parse(value))) {
    throw new RangeError(`Expected an ISO 8601 instant, received "${value}"`)
  }
  if (!value.endsWith('Z')) {
    throw new RangeError(`Instants must be UTC and end with Z, received "${value}"`)
  }
  return value as Instant
}
