/**
 * Context attached to a log line.
 *
 * Deliberately narrow. `Money`, `CalendarDate`, `Instant`, and `CurrencyCode` are branded
 * types that do **not** satisfy `string | number`, so logging a balance, an entry date, or
 * an amount is a compile error rather than something a reviewer has to catch. The
 * constitution forbids logging sensitive values; this is that rule expressed in the type
 * system.
 *
 * Note that a plain `string` still fits, so a note or a withdrawal reason could be passed
 * by a caller determined to do so. The brands stop the accidental case, which is the one
 * that actually happens.
 */
export type SafeContext = Record<string, string | number | boolean | null>

/**
 * The single logging interface (Principle V).
 *
 * Backed by the console in development and by a no-op in release. Nothing is transmitted
 * anywhere: FR-041 states no user data leaves the device and SC-014 verifies it with a
 * network monitor, so no analytics or crash-reporting SDK may sit behind this.
 */
export interface Logger {
  /** Development-time detail. Compiled out in release builds. */
  debug(event: string, context?: SafeContext): void

  /** Something recoverable that should not have happened. */
  warn(event: string, context?: SafeContext): void

  /** A failure the user was told about, recorded for diagnosis. */
  error(event: string, context?: SafeContext): void
}
