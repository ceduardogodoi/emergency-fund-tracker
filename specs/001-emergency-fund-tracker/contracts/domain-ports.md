# Contract: Domain Ports

**Feature**: `specs/001-emergency-fund-tracker` | **Date**: 2026-08-15

These are the interfaces the domain owns and the outside world implements. Principle III requires that domain logic depend on abstractions defined by the domain and never on concrete I/O, framework, or vendor types — this file is where that boundary is written down. Everything here lives in `src/domain/ports/`; every implementation lives in `src/data/` or `src/platform/` and is wired in the single composition root at `src/runtime/`.

Nothing in `src/domain/` may import from React, Expo, `expo-sqlite`, or any adapter module. An ESLint boundary rule enforces this; it is not a convention.

## Core types

```ts
/** Integer minor units (cents). Never a float, never a bare number. */
export type Money = number & { readonly __brand: 'Money' }

/** A calendar date with no time and no timezone: 'YYYY-MM-DD'. */
export type CalendarDate = string & { readonly __brand: 'CalendarDate' }

/** An ISO 8601 UTC instant, used only for audit fields — never for entry dates. */
export type Instant = string & { readonly __brand: 'Instant' }

export type CurrencyCode = string & { readonly __brand: 'CurrencyCode' }

export type Result<T, E = AppError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E }
```

## Errors

One discriminated union, exhaustively handled at every call site. Principle II forbids swallowed failures; Principle V requires exactly one error strategy.

```ts
export type AppError =
  | { readonly kind: 'validation'; readonly field: string; readonly messageKey: string }
  | { readonly kind: 'not-found'; readonly entity: string }
  | { readonly kind: 'conflict'; readonly messageKey: string }
  | { readonly kind: 'storage'; readonly messageKey: string; readonly cause?: unknown }
  | { readonly kind: 'import-invalid'; readonly problems: readonly ImportProblem[] }
  | { readonly kind: 'import-unsupported-version'; readonly found: number; readonly supported: number }
  | { readonly kind: 'permission-denied'; readonly capability: 'notifications' | 'file-access' }
  | { readonly kind: 'cancelled' }

export interface ImportProblem {
  readonly path: string        // e.g. 'entries[7].amountMinor'
  readonly messageKey: string
}
```

`import-invalid` carries a path-and-message list rather than a single string because FR-046 requires telling the user *what* was wrong with the file, not just that it was wrong.

## Clock

```ts
export interface Clock {
  today(): CalendarDate
  now(): Instant
  /** IANA timezone id, used only to resolve 'today' — never stored on an entry. */
  timeZone(): string
}
```

Every "now" in the codebase comes from here. Principle IV forbids tests that depend on wall-clock time or timezone, and streaks, pace windows, and projections are all functions of today's date — none of them is testable deterministically without this port.

## Id generation

```ts
export interface IdGenerator {
  uuid(): string
}
```

Injected for the same reason as the clock: `Math.random()` in domain code makes a test non-deterministic, and Principle IV forbids that. The test double returns a counted sequence.

## Repositories

Each returns domain types. No SQL type, row shape, or driver object crosses this boundary — mapping happens in `src/data/sqlite/mappers/`.

```ts
export interface ProfileRepository {
  get(): Promise<Result<Profile | null>>
  save(profile: ProfileInput): Promise<Result<Profile>>
}

export interface GoalRepository {
  get(): Promise<Result<Goal | null>>
  save(goal: GoalInput): Promise<Result<Goal>>
  /** Appends the audit row required when expenses, level, or target change. */
  recordChange(change: GoalChangeInput): Promise<Result<void>>
  listChanges(): Promise<Result<readonly GoalChange[]>>
}

export interface LedgerRepository {
  add(entry: LedgerEntryInput): Promise<Result<LedgerEntry>>
  update(id: string, patch: LedgerEntryPatch): Promise<Result<LedgerEntry>>
  remove(id: string): Promise<Result<void>>
  getById(id: string): Promise<Result<LedgerEntry | null>>
  /** Ordered by entry_date then created_at. Both bounds inclusive. */
  list(range?: DateRange): Promise<Result<readonly LedgerEntry[]>>
  /** Entries dated after today — surfaced for correction, excluded from every calculation. */
  listFutureDated(today: CalendarDate): Promise<Result<readonly LedgerEntry[]>>
}

export interface ReminderRepository {
  get(): Promise<Result<ReminderSetting>>
  save(setting: ReminderSetting): Promise<Result<ReminderSetting>>
}

export interface MilestoneRepository {
  listAcknowledged(): Promise<Result<readonly MilestoneThreshold[]>>
  acknowledge(threshold: MilestoneThreshold): Promise<Result<void>>
  /** Clears thresholds now above the balance, so a re-crossing is acknowledged again. */
  clearAbove(percent: number): Promise<Result<void>>
}

export type MilestoneThreshold = 25 | 50 | 75 | 100
```

### Transactions

```ts
export interface UnitOfWork {
  /** Commits if the callback resolves; rolls back entirely if it throws or returns an error. */
  run<T>(work: (repos: Repositories) => Promise<Result<T>>): Promise<Result<T>>
}
```

FR-046 requires that a failed import leave existing data untouched, with no partial application ever. That guarantee lives here — the import path runs inside exactly one `UnitOfWork.run`, so partial application is structurally impossible rather than a matter of careful ordering.

## Platform ports

```ts
export interface FileGateway {
  /** Writes the document and hands it to the OS share sheet. */
  exportDocument(fileName: string, contents: string): Promise<Result<void>>
  /** Opens the document picker; 'cancelled' when the user backs out. */
  pickDocument(): Promise<Result<{ readonly name: string; readonly contents: string }>>
}

export interface Notifier {
  requestPermission(): Promise<Result<'granted' | 'denied'>>
  schedule(setting: ReminderSetting): Promise<Result<void>>
  cancelAll(): Promise<Result<void>>
}

export interface Logger {
  debug(event: string, context?: SafeContext): void
  warn(event: string, context?: SafeContext): void
  error(event: string, context?: SafeContext): void
}

/** Primitives only. Money, CalendarDate, notes, and reasons are not assignable here. */
export type SafeContext = Record<string, string | number | boolean | null>
```

`SafeContext` is deliberately narrow. The constitution forbids logging sensitive values, and `Money` and `CalendarDate` are branded types that will not satisfy `string | number` — so logging a balance is a type error rather than a code-review catch.

## Domain services

Pure functions over the types above. No I/O, no async, no ports except values passed in.

```ts
// goal
calculateTarget(expenses: Money, coverageMonths: number): Result<Money>
levelToCoverageMonths(level: LevelKey): number

// ledger
calculateBalance(entries: readonly LedgerEntry[], today: CalendarDate): Money
summarizeProgress(balance: Money, target: Money): ProgressSummary
crossedMilestones(previous: ProgressSummary, next: ProgressSummary): readonly MilestoneThreshold[]

// statistics
summarize(entries: readonly LedgerEntry[], period: Period, today: CalendarDate): SavingStatistics
currentStreak(entries: readonly LedgerEntry[], today: CalendarDate): number
longestStreak(entries: readonly LedgerEntry[]): number

// forecast
calculatePace(entries: readonly LedgerEntry[], today: CalendarDate): PaceResult
project(remaining: Money, pace: PaceResult, today: CalendarDate): ForecastState
requiredMonthly(remaining: Money, desired: CalendarDate, today: CalendarDate): Result<Money>

export type ForecastState =
  | { readonly kind: 'insufficient-history'; readonly monthsAvailable: number; readonly monthsNeeded: number }
  | { readonly kind: 'no-pace' }
  | { readonly kind: 'reached' }
  | { readonly kind: 'projected'; readonly pace: Money; readonly monthsToTarget: number; readonly projectedDate: CalendarDate }
```

`ForecastState` is a union rather than a nullable projection so that the "not enough history" and "pace is zero" cases in FR-029 and FR-030 cannot be forgotten at the call site — the compiler requires both to be rendered.

## Test doubles

Each port ships an in-memory fake in `tests/` — a fixed `Clock`, a counting `IdGenerator`, and array-backed repositories. Domain and component tests use the fakes. Repository tests use the real SQL against `better-sqlite3` (D-006). Nothing uses a mocking framework to stub a port, because a hand-written fake that satisfies the interface cannot drift from it the way a mock can.
