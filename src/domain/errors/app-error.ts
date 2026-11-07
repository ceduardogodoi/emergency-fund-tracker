import type { Money } from '../money/money'

/**
 * Every way an operation in this app can fail for a reason worth telling the user about.
 *
 * A discriminated union rather than an error class hierarchy: `switch` over `kind` is
 * exhaustiveness-checked by the compiler, so adding a failure mode makes every call site
 * that must handle it fail to build. That is the property keeping the import-failure and
 * withdrawal-overdraw paths from silently degrading.
 *
 * Messages are carried as keys, never as prose. Copy lives in the strings module, so the
 * domain holds no opinion about wording and stays free of presentation concerns.
 */
export type AppError =
  | ValidationError
  | NotFoundError
  | ConflictError
  | StorageError
  | ImportInvalidError
  | ImportUnsupportedVersionError
  | PermissionDeniedError
  | CancelledError
  | OverBalanceError
  | DeviceError

/** User input that failed a rule — the amount, the date, the expense figure. */
export interface ValidationError {
  readonly kind: 'validation'
  /** Which field to attach the message to, so the UI can show it inline (FR-052). */
  readonly field: string
  readonly messageKey: string
}

/** A record the caller expected to exist does not. */
export interface NotFoundError {
  readonly kind: 'not-found'
  /** The missing entity, for diagnosis — `goal`, `ledger-entry`, `profile`. */
  readonly entity: string
}

/** The operation contradicts current state — a second opening balance, for instance. */
export interface ConflictError {
  readonly kind: 'conflict'
  readonly messageKey: string
}

/** The database refused the operation. Always unexpected, always worth logging. */
export interface StorageError {
  readonly kind: 'storage'
  readonly messageKey: string
  /** The underlying driver error, for the log only — never shown to the user. */
  readonly cause?: unknown
}

/**
 * An import file was malformed. Carries every problem found, each with its path, so the
 * user learns *what* was wrong rather than only that something was (FR-046).
 */
export interface ImportInvalidError {
  readonly kind: 'import-invalid'
  readonly problems: readonly ImportProblem[]
}

/** One specific defect in an import document. */
export interface ImportProblem {
  /** Where in the document, e.g. `entries[7].amountMinor`. */
  readonly path: string
  readonly messageKey: string
}

/**
 * The file came from a newer version of the app. Refused rather than guessed at, since a
 * v1 reader cannot know what a later schema changed.
 */
export interface ImportUnsupportedVersionError {
  readonly kind: 'import-unsupported-version'
  readonly found: number
  readonly supported: number
}

/** A device capability the app asks the OS for, rather than one it has by default. */
export type DeviceCapability = 'notifications' | 'file-access'

/** The OS denied a capability the user asked for. Never fatal — the feature stays off. */
export interface PermissionDeniedError {
  readonly kind: 'permission-denied'
  readonly capability: DeviceCapability
}

/**
 * The device would not do what was asked of it — schedule a notification, write a file.
 *
 * Not a {@link StorageError}: nothing was being stored, and the copy for a storage failure
 * would send the user looking in the wrong place. Not a {@link PermissionDeniedError}
 * either: the permission may well be granted, and the system failed anyway.
 */
export interface DeviceError {
  readonly kind: 'device'
  readonly capability: DeviceCapability
  readonly messageKey: string
  /** The platform's error. Logged, never displayed. */
  readonly cause?: unknown
}

/** The user backed out. Not a failure to report — nothing changed, so say nothing. */
export interface CancelledError {
  readonly kind: 'cancelled'
}

/**
 * A withdrawal larger than the balance, refused until the user confirms it (FR-017).
 *
 * Not a validation failure: nothing about the entry is wrong, and the user may record it as
 * it is. It is a question, and it carries the figures the question states, measured against
 * the ledger in storage rather than a balance a screen happened to have cached.
 */
export interface OverBalanceError {
  readonly kind: 'over-balance'
  /** The balance as of today, which may already be zero or below. */
  readonly balance: Money
  /** How far below zero the withdrawal would leave the fund. Always above zero. */
  readonly belowZeroBy: Money
}

/**
 * Builds a validation failure.
 *
 * @param field The form field to attach the message to.
 * @param messageKey A key into the strings module, not user-facing prose.
 */
export function validationError(field: string, messageKey: string): ValidationError {
  return { kind: 'validation', field, messageKey }
}

/**
 * Builds an over-balance refusal (FR-017).
 *
 * @param balance The balance the withdrawal was measured against.
 * @param belowZeroBy How far below zero it would leave the fund, above zero.
 */
export function overBalanceError(balance: Money, belowZeroBy: Money): OverBalanceError {
  return { kind: 'over-balance', balance, belowZeroBy }
}

/**
 * Builds a permission refusal (FR-035).
 *
 * @param capability What the user was asked to allow.
 */
export function permissionDeniedError(capability: DeviceCapability): PermissionDeniedError {
  return { kind: 'permission-denied', capability }
}

/**
 * Builds a device failure.
 *
 * Omits `cause` entirely when there is none, as {@link storageError} does.
 *
 * @param capability The capability the failed call was using.
 * @param messageKey A key into the strings module, not user-facing prose.
 * @param cause The platform's error. Logged, never displayed.
 */
export function deviceError(
  capability: DeviceCapability,
  messageKey: string,
  cause?: unknown,
): DeviceError {
  return cause === undefined
    ? { kind: 'device', capability, messageKey }
    : { kind: 'device', capability, messageKey, cause }
}

/** Builds a not-found failure for the named entity. */
export function notFoundError(entity: string): NotFoundError {
  return { kind: 'not-found', entity }
}

/** Builds a conflict failure. */
export function conflictError(messageKey: string): ConflictError {
  return { kind: 'conflict', messageKey }
}

/**
 * Builds a storage failure.
 *
 * Omits `cause` entirely when there is none rather than setting it to `undefined`, which
 * `exactOptionalPropertyTypes` treats as a different thing from absent.
 *
 * @param cause The driver error. Logged, never displayed.
 */
export function storageError(messageKey: string, cause?: unknown): StorageError {
  return cause === undefined
    ? { kind: 'storage', messageKey }
    : { kind: 'storage', messageKey, cause }
}

/**
 * Asserts that a switch over a union is exhaustive.
 *
 * Call it in the `default` branch: if a new {@link AppError} kind is added and a call
 * site does not handle it, the argument stops being `never` and the build fails — which
 * is the entire reason this is a union rather than a class hierarchy.
 *
 * @throws {Error} Always, if execution somehow reaches it at runtime.
 */
export function assertNever(value: never): never {
  throw new Error(`Unhandled case: ${JSON.stringify(value)}`)
}
