# Phase 0 Research: Emergency Fund Tracker

**Feature**: `specs/001-emergency-fund-tracker` | **Date**: 2026-08-15 | **Plan**: [plan.md](./plan.md)

This document resolves every unknown in the plan's Technical Context. Each decision records what was chosen, why, and what was rejected. Decisions are constrained by the [constitution](../../.specify/memory/constitution.md) — in particular the simplicity rule (every dependency must be justified), Principle III (domain logic depends on abstractions, never on framework or vendor types), and Principle V (one canonical way per concern).

## D-001: Platform and framework

**Decision**: React Native with Expo, written in TypeScript, one codebase for both platforms, no custom native modules.

**Rationale**: Chosen by the project owner. It satisfies FR-037 (both platforms) and SC-013 (feature parity) from a single source, and Expo's managed modules cover every platform capability this feature needs — local database, local notifications, file export, and file import — with no native code to maintain. TypeScript in strict mode gives the static analysis the constitution's Quality Standards require.

**Alternatives considered**: Flutter (stronger built-in test tooling and charting, single rendering engine so visual parity is nearly free; rejected because the owner chose the TypeScript ecosystem); Kotlin Multiplatform with native UI (best native feel, cleanest domain/UI split; rejected for the cost of two UI layers); fully native twin codebases (highest per-platform quality; rejected at roughly double the work with no shared money logic).

**Consequences**: Visual parity between platforms is not automatic — RN maps to platform primitives, so Principle VI's consistency requirement has to be enforced deliberately through the design-token layer and shared primitives rather than assumed.

## D-002: Expo SDK version and platform minimums

**Decision**: Pin whatever `create-expo-app` installs as the current stable SDK at project init, and record the exact SDK, React Native, and React versions in plan.md's Technical Context once initialized. Adopt that SDK's own minimum OS versions as the app's minimums rather than declaring lower ones.

**Rationale**: Expo's supported iOS and Android minimums move with each SDK, and the app has no requirement that argues for supporting anything older than the SDK does. Deriving the minimums from the SDK avoids claiming support that is not tested.

**Alternatives considered**: Naming specific version numbers now (rejected — they would be guesses, and a wrong minimum in a spec becomes a wrong test matrix); supporting older OS versions than the SDK targets (rejected — no requirement justifies the cost).

**Verification at init (R-001) — resolved 2026-08-15**: Expo SDK 57.0.13, React Native 0.86.2, React 19.2.3, TypeScript 5.9.3. Recorded in plan.md's Technical Context. Two findings worth carrying forward: TypeScript 7 is available but `typescript-eslint` still requires `<6.1.0`, so the project pins 5.x rather than lose the lint gate; and `expo-router` in this SDK peer-depends on `react-dom` through its Radix dependencies, so `react-dom` is installed even though there is no web target. Platform minimums inherit from the SDK and are confirmed when the first native build runs.

## D-003: Money representation

**Decision**: All monetary values are integers in the currency's minor unit (cents), carried by a branded TypeScript type `Money` that also carries the ISO 4217 currency code. No floating-point arithmetic anywhere, and no decimal library.

**Rationale**: The constitution's Quality Standards mandate exact decimal or integer minor units and forbid floats for money. JavaScript integers are exact to 2^53, which covers roughly 90 trillion in cents — far beyond any emergency fund. Addition and subtraction, which is all the ledger needs, are therefore exact with zero dependencies. A branded type makes it a compile error to pass a raw number where money is expected, which is what stops the class of bug SC-007 tests for.

**Alternatives considered**: `decimal.js` or `big.js` (rejected — a dependency that buys nothing once amounts are integers, and it invites treating money as a decimal string, which is slower and easier to misuse); `BigInt` (rejected — no range benefit at this scale, and it serializes and formats awkwardly); floating-point with rounding at the edges (rejected outright by the constitution).

**Consequence**: Division appears in exactly three places — average monthly contribution, saving pace, and required monthly contribution. Every one of them rounds through a single shared module with one documented rule, so the rounding policy has one home and one test suite, as the constitution requires.

## D-004: Date representation

**Decision**: Entry dates are calendar dates stored as `YYYY-MM-DD` strings with no time and no timezone. `date-fns` provides month arithmetic and bucketing. All "now" values come from an injected `Clock` port, never from `new Date()` in domain code.

**Rationale**: The spec's timezone edge case requires that an entry stay on the calendar date the user picked, regardless of device timezone changes — which a timestamp cannot guarantee and a date string can. Principle IV forbids tests that depend on wall-clock time or timezone, and an injected clock is what makes streaks, pace windows, and projections deterministically testable.

**Alternatives considered**: Unix timestamps (rejected — reintroduces the timezone drift the edge case forbids); `Temporal` (attractive and the right long-term answer, but availability across the Hermes engine cannot be assumed at this SDK version — revisit later); Luxon or Day.js (rejected — heavier than the handful of operations needed).

**Amendment (2026-08-15, during implementation)**: `date-fns` was installed and then removed without being used. Implementing `src/domain/dates/calendar-date.ts` showed that every operation needed — month keys, month arithmetic with day clamping, complete-month windows — is a few lines over explicit UTC `Date.UTC` calls, and that doing it directly is *safer* than adapting a library whose functions operate in local time, given the spec's timezone edge case. Keeping an unused dependency would violate the constitution's rule that each dependency be justified by a present need. The decision above stands in substance — calendar dates as `YYYY-MM-DD`, arithmetic through one module, all "now" values from the injected `Clock` — only the library is gone.

**Verification at init (R-002)**: Confirm `Intl.NumberFormat` and `Intl.DateTimeFormat` with non-default locales work on Hermes for Android release builds, since FR-039 depends on locale-aware currency formatting. Expo builds normally include the necessary ICU data; if a release build turns out to lack it, the fallback is to enable full ICU rather than to hand-roll formatting.

## D-005: Local storage

**Decision**: `expo-sqlite` with hand-written SQL, reached only through repository modules that implement domain-owned port interfaces. Schema versioning via SQLite's `user_version` pragma with forward-only migration steps.

**Rationale**: The data is relational and the statistics are aggregations over a ledger, which is what SQL is for. The schema is three small tables plus two single-row settings tables — well under the threshold where an ORM pays for itself, and the constitution's simplicity rule rejects abstraction that no current requirement demands. Migrations matter because FR-043 requires data to survive app updates, and `user_version` is the standard, dependency-free mechanism.

**Alternatives considered**: Drizzle ORM with its expo-sqlite driver (typed schema and a generated migration story; rejected as an unjustified dependency and codegen step for a five-table schema — revisit if the schema grows); WatermelonDB (built for large datasets and sync; rejected as far heavier than needed and aimed at a sync model this release explicitly excludes); AsyncStorage or MMKV holding JSON (rejected — recomputing every statistic by loading and scanning the whole history in JavaScript degrades as history grows, and it gives up transactional integrity that FR-046's all-or-nothing import depends on).

## D-006: Testing the persistence boundary

**Decision**: Three layers. Domain logic is tested in Jest with no database at all. Repository and migration tests run the identical SQL against `better-sqlite3` in Node, exercising real SQLite semantics in CI without a device or emulator. A thin Maestro suite runs the critical journeys on a real device build, including at least one that proves the actual `expo-sqlite` driver works end to end.

**Rationale**: Principle IV requires an integration test at every persistence boundary, and requires that tests be fast and deterministic. `expo-sqlite` cannot run in a Node test process, so testing repositories only on-device would make the constitution's persistence-boundary requirement slow enough to be skipped. Both drivers are SQLite, so the SQL under test is the same engine; the on-device smoke test covers the narrow gap that remains — the driver binding itself.

**Alternatives considered**: Mocking the database in repository tests (rejected — it tests the mock, not the SQL, and would not catch a migration or constraint error); running all persistence tests on-device via Detox or Maestro (rejected — minutes per run instead of seconds, which is how test suites stop being run); skipping repository tests and covering persistence only through E2E (rejected by Principle IV outright).

**Risk accepted**: A behavioral difference between `better-sqlite3` and `expo-sqlite` could pass CI and fail on device. It is bounded to driver-level concerns rather than SQL semantics, and the on-device smoke test is the control. Documented as a known tradeoff rather than an oversight.

## D-007: Test tooling

**Decision**: Jest with `jest-expo` for unit and component tests, `@testing-library/react-native` for component behavior, `better-sqlite3` for repository tests, and Maestro for end-to-end flows. Coverage thresholds enforced in Jest config: 80% globally, 95% for `src/domain/money`, `src/domain/dates`, `src/domain/statistics`, and `src/domain/forecast`.

**Rationale**: Directly implements Principle IV's stated pyramid and coverage floors, with the higher floor applied to exactly the modules the constitution names — money, dates, and balance calculation. Maestro is chosen over Detox for a managed Expo project because its YAML flows need no native test harness build.

**Alternatives considered**: Detox (more powerful, significantly more setup and maintenance for a managed workflow; rejected for a thin E2E layer); Vitest (faster, but `jest-expo` is the supported preset for the RN transform pipeline; rejected to avoid fighting the toolchain).

## D-008: Async state and cache invalidation

**Decision**: TanStack Query wraps every read from the repository layer, treating the local database as the async source. Every mutation invalidates the affected query keys. Ephemeral UI state stays in React component state. No global store.

**Rationale**: Two requirements make this pay for itself. FR-051 demands loading, empty, error, and populated states on every data-backed view — hand-rolling that state machine on roughly ten screens is exactly the duplication Principle V exists to prevent. FR-032 demands that the pace, projection, and required-contribution figures recalculate on every ledger change, which is a cache-invalidation problem; centralizing it in query-key invalidation makes "did we forget to refresh that screen?" a structural impossibility rather than a review checklist item.

**Alternatives considered**: Zustand or Redux holding a materialized copy of the ledger (rejected — creates a second source of truth alongside SQLite, and the constitution forbids parallel canonical patterns); plain `useEffect` with local state per screen (rejected — repeats the four-state machine everywhere, the duplication Principle V forbids); React Context alone (rejected — no invalidation or request-deduplication story, so it re-solves the same problem worse).

**Note on consistency**: An ORM was rejected in D-005 as an unjustified dependency while this one is accepted. The distinction is what each replaces — the ORM would replace SQL that is already simple and typed at the repository boundary, whereas this replaces per-screen state machinery that would otherwise be written ten times.

## D-009: Navigation

**Decision**: Expo Router, with route files kept thin — a route renders a feature component and nothing else.

**Rationale**: It is the default navigation for new Expo projects, it makes the screen inventory legible from the filesystem, and keeping routes thin keeps navigation out of the feature logic, which is what makes features testable without a navigator.

**Alternatives considered**: React Navigation directly (rejected — Expo Router is built on it and is the supported default; using both would be two ways to do one thing).

## D-010: Design system and tokens

**Decision**: A hand-built token module (`src/ui/tokens`) as the single source for spacing, color, typography, radii, and elevation, consumed through a theme provider, with a small set of primitives — Screen, Text, Button, Card, Field, StateView — built on those tokens. No third-party UI kit. A lint rule bans hard-coded color and spacing literals outside the token module.

**Rationale**: Principle VI requires a single source of truth for design values and forbids hard-coded style values. A UI kit ships its own token system that would then compete with ours, which is the parallel-pattern problem the constitution forbids. The primitive set is small enough that building it costs less than bending a kit to the tokens.

**Alternatives considered**: React Native Paper or Tamagui (rejected — each brings an opinionated theme system that would either replace or duplicate the token layer); NativeWind (rejected — utility classes scattered through components make the "no hard-coded values" rule harder to lint, not easier).

**Consequence**: The `StateView` primitive is what operationalizes FR-051 — it takes loading, empty, error, and populated cases and refuses to compile if a case is unhandled, making the four-state rule structural.

## D-011: Charts and their accessible equivalents

**Decision**: `react-native-gifted-charts` for the balance-over-time line and the month-by-month bars. Every chart is paired with an equivalent accessible summary — a text description plus a data table reachable by screen reader — rendered from the same data.

**Rationale**: The library is pure React Native with no Skia dependency, keeping the build simple for two charts. The accessible pairing is not optional polish: FR-049 requires full screen-reader operability and forbids color as the sole carrier of meaning, and no charting library satisfies that on its own.

**Alternatives considered**: Victory Native XL on `@shopify/react-native-skia` (better rendering and animation; rejected — a large native dependency for two charts); `react-native-svg` charts hand-built (rejected — reimplementing axes and scales is more work than the library saves); no charts, tables only (rejected — FR-019 requires a visual form).

## D-012: Export and import format

**Decision**: A single JSON document, pretty-printed, carrying a `schemaVersion`, the goal, the profile, every ledger entry with its stable UUID, and the reminder setting. Export writes through `expo-file-system` and hands off via `expo-sharing`; import selects through `expo-document-picker`. Every imported document is parsed and validated with `zod` before anything is written, inside a single database transaction.

**Rationale**: FR-044 requires portable and human-readable; JSON is both, and unlike CSV it can carry the goal, settings, and a version field in one file. `schemaVersion` is what lets FR-046 reject a file from a newer app version with a clear explanation instead of misreading it. The transaction is what makes FR-046's "no partial import may ever be applied" true rather than aspirational. Stable UUIDs on entries are what make FR-047's merge deduplication exact rather than heuristic.

**Alternatives considered**: CSV (more human-readable for the ledger alone, but cannot carry goal, settings, or a version without inventing a multi-section convention; rejected); SQLite file copy (exact and trivial to restore, but opaque to the user and brittle across schema versions; rejected against the human-readable requirement); both JSON and CSV (rejected by the simplicity rule — one format, one code path, one test suite).

**Justification for `zod`**: An import file is untrusted input that can be hand-edited, truncated, or produced by a different app version. FR-046 requires validation with a specific explanation of what was wrong. Hand-written validators for a nested document either lose the error detail or reimplement a schema library badly.

## D-013: Reminders

**Decision**: `expo-notifications` scheduling local notifications only. No push service, no server, no notification tokens. Permission is requested only at the moment the user enables reminders.

**Rationale**: FR-040 requires every feature to work with no connectivity, which rules out push. FR-035 requires that permission be requested only on enable, which also avoids the cold-start permission prompt that suppresses opt-in rates.

**Alternatives considered**: Push notifications via Expo's service (rejected — needs a network and a backend, both excluded from this release).

**Verification at init (R-003)**: Confirm the exact behavior of local notification scheduling on both platforms in a release build, including what happens after a device restart and after the app is force-quit, and confirm whether Android exact-alarm permissions apply to the chosen scheduling trigger. Reminder reliability claims in FR-036 depend on this.

## D-014: Error handling

**Decision**: One canonical pattern. Domain and repository operations that can fail return a `Result<T, AppError>` rather than throwing. `AppError` is a discriminated union with a stable code and a user-facing message key. Exceptions are reserved for programmer errors and are caught at a single top-level boundary that logs and shows a recovery path.

**Rationale**: Principle II forbids swallowed failures and requires every failure path to surface a typed, actionable error, and Principle V requires exactly one error-handling strategy. A discriminated union makes exhaustive handling a compile-time check, which is what keeps the import-failure and withdrawal-overdraw paths from silently degrading.

**Alternatives considered**: Throwing typed exceptions everywhere (rejected — TypeScript cannot type what a function throws, so exhaustiveness is unverifiable); returning `null` on failure (rejected outright — discards the reason, which FR-046 requires reporting).

## D-015: Logging and diagnostics

**Decision**: A single `Logger` port in the domain, with a console implementation in development and a no-op in release. No crash reporting, no analytics, no telemetry of any kind in this release. Logging a value of type `Money` or any ledger field is prevented by the logger's own type signature.

**Rationale**: FR-041 states that no user data is transmitted off the device, and SC-014 verifies it by network monitoring. Any analytics or crash SDK would falsify SC-014 the moment it initialized. The constitution's observability requirement is met by structured local logging; its rule against logging sensitive values is enforced by the type signature rather than by reviewer vigilance.

**Alternatives considered**: Sentry or a similar crash reporter (rejected — it would send data off-device and break SC-014; genuinely worth revisiting when the accounts release introduces a backend and a privacy policy that can cover it); local crash log file the user can attach to a support mail (deferred — no support channel exists yet).

## D-016: Localization

**Decision**: All user-facing strings live in one module keyed by identifier, but no i18n library and one language ship in this release. Number, currency, and date formatting are locale-aware from the device locale via `Intl`.

**Rationale**: FR-039 requires locale-consistent formatting, which `Intl` provides without a translation framework. Centralizing strings costs nothing now and is what makes adding a translation library later a configuration change rather than a sweep through every component. Shipping a translation framework with one language is the speculative generality the simplicity rule rejects.

**Alternatives considered**: `i18next` now (rejected — no second language is requested); scattering literals in components (rejected — makes the eventual translation a full-codebase edit).

## D-017: Pace window definition

**Decision**: The saving pace is the net amount saved across the most recent **complete** calendar months, up to six of them, divided by the number of complete months in that window. The current, in-progress month is excluded from the pace calculation. Entries in the current month still count toward the balance and the remaining amount. FR-029's three-month minimum means three complete months.

**Rationale**: Including a partial month drags the average down purely because the month has not finished, which would show every user a pessimistic projection that improves on the last day of each month for no real reason. Excluding it makes the pace a statement about finished months, which is both more accurate and easier to explain — and FR-028 requires the app to explain what the projection assumes.

**Alternatives considered**: Including the current month at face value (rejected — systematically pessimistic and visibly jumpy); scaling the current month up by the fraction elapsed (rejected — extrapolates from a few days and is unexplainable to a user); a rolling 180-day window rather than calendar months (rejected — most people save on a monthly cycle tied to payday, so calendar months match the behavior being measured).

**Spec reconciliation**: FR-026 says "the most recent 6 calendar months". This decision refines that to complete months and should be reflected back into the spec text so the acceptance tests and the implementation agree.

## D-018: One theme

**Decision**: The app ships one light palette. No dark theme, no theme provider switching between palettes, no `useColorScheme`. Tokens are named for the role a colour plays rather than the colour it is, so the palette can gain a second set of values later without any component changing.

**Rationale**: A dark theme appears nowhere in spec.md — no functional requirement, no success criterion, no user story mentions it. Building the indirection for a second palette before one is asked for is exactly the speculative generality the simplicity principle rejects, and it doubles the surface the contrast audit has to cover. Semantic naming is the cheap half of the preparation and is already done; the expensive half can wait until there is a requirement.

**Alternatives considered**: Light and dark from the start (rejected — no requirement, and it doubles every contrast pair to audit); a theme provider with a single theme registered (rejected — the indirection without the benefit, and every component pays the lookup cost to support a case that does not exist).

## D-019: A single currency for this release

**Decision**: Every amount is BRL. The currency is not chosen during onboarding and cannot be changed in settings. The `profile` row still carries a currency column and `Money` still carries a currency code, so the value is stored rather than assumed, but exactly one value is ever written in this release.

**Rationale**: Currency selection is a feature in its own right, not a field — it needs a picker, a migration path for existing amounts, and a decision about what happens to history when the currency changes. None of that is specified, and the app is device-only and single-user, so a fixed currency is not a limitation anyone hits by accident. Keeping the column and the branded code means adding selection later is a screen plus a migration, not a data-model change.

**Reconciliation with D-016 and D-020**: the currency *code* is fixed at BRL rather than derived from the device locale. D-020 then pins the formatting *locale* to pt-BR as well, so both halves of an amount — which currency it is, and how it is written — are constants in this release rather than device reads.

**Alternatives considered**: Deriving the currency from the device locale (rejected — a user travelling or with an English-locale device would silently reinterpret their balance in another currency); asking during onboarding (rejected — adds a step to the critical path for a choice with one answer in this release); dropping the currency column entirely (rejected — removes the record of what the stored integers mean, and makes adding selection a data migration rather than a screen).

**Resolves**: analyze finding C1.

## D-020: pt-BR as the only language, and the formatting locale pinned to match

**Decision**: The interface ships in pt-BR only. `Intl` formatting is pinned to the `pt-BR` locale rather than read from the device, so amounts and dates render in Brazilian conventions on every device regardless of its system language. Identifiers, comments, and documentation stay in English.

**Rationale**: The release targets Brazil and BRL (D-019), so a single language matches the audience. Pinning the formatting locale is what keeps the screen internally consistent: with Portuguese text and device-derived formatting, a phone set to en-US would render `R$1,234.56` beside Portuguese labels — the decimal comma and the thousands point would disagree with every number the user writes by hand. Formatting and language are one decision, not two.

**Reconciliation with D-016**: D-016 said number, currency, and date formatting are locale-aware from the device locale. That is superseded here. The mechanism is unchanged — `Intl` still does the work, and `createFormatters` still takes a locale — but the locale is now a constant rather than a device read. Adding language selection later means passing a different value to a function that already accepts one.

**Alternatives considered**: Device locale for formatting with pt-BR text (rejected — internally inconsistent, as above); English text with BRL amounts (rejected — the audience implied by a BRL-only release reads Portuguese); shipping both languages (rejected — D-016's reasoning stands, no second language is requested).

## Open items carried into implementation

| ID | Item | Resolved by |
|----|------|-------------|
| R-001 | Record exact Expo SDK, RN, and React versions and the resulting iOS and Android minimums | Project init |
| R-002 | Confirm `Intl` currency and date formatting on Hermes in Android release builds | First release build |
| R-003 | Confirm local notification scheduling behavior after restart and force-quit, and Android exact-alarm requirements | Story 6 implementation |
| R-004 | Reflect the complete-months pace refinement (D-017) back into FR-026 | **Done** — FR-026, FR-029, and Story 4's third scenario updated during this planning pass |

None of these block Phase 1 design or implementation. R-001 through R-003 are verifications to perform against the real toolchain and devices, each recorded here so they are not quietly skipped.
