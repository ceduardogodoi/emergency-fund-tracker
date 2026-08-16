/**
 * Source of identifiers for ledger entries and goal changes.
 *
 * Injected for the same reason as the clock: `Math.random()` inside domain code makes a
 * test non-deterministic, which Principle IV forbids. The test double returns a counted
 * sequence, so a test can assert on exact ids instead of matching a pattern.
 *
 * The ids it produces outlive the install — they travel in the export file and are what
 * merge deduplication matches on (FR-047), so they must be globally unique rather than
 * merely unique within one database.
 */
export interface IdGenerator {
  /** A new UUID v4. */
  uuid(): string
}
