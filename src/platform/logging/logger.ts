import type { Logger, SafeContext } from '@/domain/ports/logger'

/**
 * Where log lines actually go.
 *
 * Abstracted so the logger can be tested without spying on the global console, and so
 * that the destination is a single obvious place to audit when checking that nothing
 * leaves the device.
 */
export interface LogSink {
  /** Development-time detail. */
  debug(event: string, context?: SafeContext): void
  /** Something recoverable that should not have happened. */
  warn(event: string, context?: SafeContext): void
  /** A failure the user was told about, recorded for diagnosis. */
  error(event: string, context?: SafeContext): void
}

/**
 * The default sink: the device console, visible only to a developer with the device
 * attached. Nothing here transmits anywhere, which is what keeps SC-014 true.
 */
export const consoleSink: LogSink = {
  /* eslint-disable no-console -- the one place console is the intended destination */
  debug: (event, context) => console.debug(event, context),
  warn: (event, context) => console.warn(event, context),
  error: (event, context) => console.error(event, context),
  /* eslint-enable no-console */
}

/** How to build the application logger. */
export interface LoggerOptions {
  /**
   * Whether to emit at all. False in release builds, where the app should be silent —
   * there is no crash reporter to feed and no one attached to read the output.
   */
  readonly enabled: boolean
  /** Destination for emitted lines. Defaults to {@link consoleSink}. */
  readonly sink?: LogSink
}

/**
 * Builds the application logger — the single logging interface Principle V requires.
 *
 * Deliberately offers no transport, no buffering, and no remote destination. FR-041 says
 * no user data leaves the device and SC-014 verifies it with a network monitor, so an
 * analytics or crash-reporting SDK behind this would falsify a success criterion the
 * moment it initialized.
 *
 * @returns A logger forwarding to the sink, or one discarding everything when disabled.
 */
export function createLogger({ enabled, sink = consoleSink }: LoggerOptions): Logger {
  if (!enabled) {
    return {
      debug: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    }
  }

  return {
    debug: (event, context) => sink.debug(event, context),
    warn: (event, context) => sink.warn(event, context),
    error: (event, context) => sink.error(event, context),
  }
}
