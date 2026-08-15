# Implementation Plan: Emergency Fund Tracker

**Branch**: `main` *(no branch hook configured; work tracked by feature directory)* | **Date**: 2026-08-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-emergency-fund-tracker/spec.md`

## Summary

A single-codebase React Native application, built with Expo in TypeScript, that helps a person size and fill an emergency fund. The user enters their monthly essential expenses and picks a conservativeness level; the app derives a target, tracks contributions and withdrawals in a local ledger, reports statistics over that ledger, and projects a completion date from the trailing saving pace.

The whole product runs on the device. There is no backend, no account, and no network call of any kind — a constraint that shapes the architecture more than any other decision. The technical approach is a pure TypeScript domain core containing every money, date, statistics, and forecast rule, sitting behind port interfaces that the SQLite persistence layer and the Expo platform wrappers implement. React never touches SQL and the domain never imports React or Expo, which is what makes the money math testable in milliseconds and keeps the eventual accounts-and-sync release from being a rewrite.

All six user stories are in scope. They remain independently shippable in priority order.

## Technical Context

**Language/Version**: TypeScript 5.x in `strict` mode, with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` enabled

**Primary Dependencies**: Expo SDK (version pinned at init — see R-001), React Native, Expo Router, `expo-sqlite`, TanStack Query, `zod`, `date-fns`, `react-native-gifted-charts`, `expo-notifications`, `expo-file-system`, `expo-sharing`, `expo-document-picker`

**Storage**: `expo-sqlite` on device, accessed only through repository modules implementing domain-owned ports; schema versioned by the `user_version` pragma with forward-only migrations

**Testing**: Jest with `jest-expo` for unit and component tests, `@testing-library/react-native` for component behavior, `better-sqlite3` for repository and migration tests in Node, Maestro for end-to-end flows on device

**Target Platform**: iOS and Android phones. Minimum OS versions inherit from the pinned Expo SDK rather than being declared independently (see R-001)

**Project Type**: Mobile application, single codebase, no backend and no API surface

**Performance Goals**: Any primary screen interactive within 2 seconds of launch on a 3-year-old mid-range device (SC-012); visible feedback within 100ms of every user action (FR-052); displayed figures reflect a saved entry within 1 second (SC-005); 60fps scrolling through entry history

**Constraints**: Fully offline — no network permission is needed and no outbound request may exist (FR-040, SC-014); device-only storage with no account (FR-041); no in-app lock (FR-042); exact integer money arithmetic with zero rounding drift (FR-038, SC-007); WCAG 2.1 AA on every screen (FR-049)

**Scale/Scope**: One user per device, one fund. Sized for a decade of history — roughly 2,000–5,000 ledger entries — which comfortably fits SQLite and rules out any need for pagination beyond simple list virtualization. Approximately 11 screens.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

Constitution version at time of planning: **1.0.1**.

| Principle | Gate | Status |
|-----------|------|--------|
| I. Code Quality Gates | Prettier, ESLint (`typescript-eslint`, `react-native-a11y`), `tsc --noEmit` under strict, and Jest all run in a pre-commit hook and identically in CI, with warnings as errors and every suppression carrying a scoped inline reason | **PASS** (planned) |
| II. Clean Code | Lint enforces `complexity: 10`, `max-depth: 3`, and a function-length ceiling; the `Result`/`AppError` union in D-014 makes an unhandled failure path a compile error rather than a silent catch | **PASS** |
| III. SOLID Design | `src/domain` imports nothing from React, Expo, or SQLite. Persistence, clock, notifications, and file access are domain-owned port interfaces implemented in `src/data` and `src/platform` and wired in one composition root. No module constructs its own I/O collaborator or reads a global | **PASS** |
| IV. Test-First & Testing Standards | Red-Green-Refactor with the pyramid from D-006; coverage thresholds set in Jest at 80% global and 95% on `domain/money`, `domain/dates`, `domain/statistics`, `domain/forecast`; every clock reads through the injected `Clock` port so no test depends on wall-clock time, timezone, or ordering | **PASS** |
| V. Consistent Code Patterns | One data-access pattern (repository over hand-written SQL), one async-state pattern (TanStack Query over the repositories), one error strategy (`Result`), one logging interface, one money type (branded integer minor units), one date representation (`YYYY-MM-DD`) | **PASS** |
| VI. UI & UX Consistency | A single token module is the only source of style values, enforced by a lint rule banning color and spacing literals outside it; the `StateView` primitive makes loading, empty, error, and populated exhaustive at the type level; every chart ships a screen-reader-equivalent table; destructive actions confirm | **PASS** |

**Quality Standards check**: Money is integer minor units with all rounding funnelled through one module (D-003). Strict type checking is on and is not relaxed globally. Every dependency is justified in the table below. No secrets or real financial data exist in the repository — all fixtures are synthetic. Logging goes through one port that cannot accept money or ledger fields by type (D-015). The simplicity rule was applied explicitly in D-005 and D-016, where an ORM and an i18n framework were both rejected as unjustified for current requirements.

### Dependency justifications

The constitution requires each third-party dependency to be justified by the plan that introduces it.

| Dependency | What it replaces | Why the simpler option was rejected |
|------------|------------------|-------------------------------------|
| `expo-sqlite` | Hand-rolled file persistence | Relational aggregation over a growing ledger is what SQL is for; JSON-in-storage degrades and gives up transactional integrity that FR-046 needs |
| TanStack Query | Per-screen `useEffect` state machines | FR-051's four states and FR-032's recalculate-on-change would otherwise be rewritten on ~11 screens (D-008) |
| `zod` | Hand-written import validators | FR-046 requires rejecting a malformed file *with an explanation of what was wrong*; hand-rolled nested validation either loses that detail or reimplements a schema library (D-012) |
| `date-fns` | Hand-rolled month arithmetic | Month bucketing, streak boundaries, and month-offset projection are easy to get subtly wrong; tree-shakeable so only the used functions ship |
| `react-native-gifted-charts` | Hand-built SVG charts | FR-019 requires a visual form; reimplementing axes and scales costs more than the library, and it needs no Skia native dependency (D-011) |
| `expo-notifications` | — | Only way to deliver the local reminders in FR-034 |
| `expo-file-system`, `expo-sharing`, `expo-document-picker` | — | Only way to write, hand off, and select the export/import files in FR-044 and FR-045 |
| `better-sqlite3` (dev only) | On-device-only repository tests | Principle IV requires a fast integration test at the persistence boundary; on-device-only runs are slow enough that they stop being run (D-006) |

Deliberately **not** added: an ORM (D-005), a UI kit (D-010), an i18n framework (D-016), a state-management library (D-008), a decimal library (D-003), and any analytics or crash-reporting SDK — the last of which would falsify SC-014 the moment it initialized (D-015).

### Post-Phase 1 re-check

Re-evaluated after the data model, contracts, and quickstart were written. All six gates still **PASS**. The design added no dependency beyond the table above and introduced no module that reaches around a port. Two points were tightened during design rather than deferred:

- The four-state rule moved from a review checklist item to a type-level obligation in the `StateView` primitive contract.
- The all-or-nothing import guarantee in FR-046 became a single explicit transaction boundary in the import contract, rather than an ordering convention that a future edit could quietly break.

## Project Structure

### Documentation (this feature)

```text
specs/001-emergency-fund-tracker/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output — 17 decisions, 4 open init-time items
├── data-model.md        # Phase 1 output — entities, schema, derivations, algorithms
├── quickstart.md        # Phase 1 output — setup and per-story validation guide
├── contracts/           # Phase 1 output
│   ├── domain-ports.md      # Port interfaces the domain owns
│   ├── fund-export-v1.md    # Export/import file contract
│   └── ui-contract.md       # Screen state, token, and accessibility contract
├── checklists/
│   └── requirements.md  # Spec quality checklist (16/16)
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
app/                             # Expo Router routes — thin, each renders one feature component
├── _layout.tsx
├── index.tsx                    # Home: balance, progress, milestone
├── onboarding/
│   ├── expenses.tsx
│   ├── level.tsx
│   └── opening-balance.tsx
├── entries/
│   ├── index.tsx                # History
│   ├── contribute.tsx
│   └── withdraw.tsx
├── statistics.tsx
├── forecast.tsx
└── settings/
    ├── index.tsx
    ├── goal.tsx                 # Revise expenses / level / target
    ├── reminders.tsx
    └── data.tsx                 # Export, import, erase

src/
├── domain/                      # Pure TypeScript. No React, no Expo, no SQL.
│   ├── money/                   # Money type, arithmetic, the one rounding module
│   ├── dates/                   # CalendarDate, month bucketing, Clock port
│   ├── goal/                    # Target derivation, conservativeness levels
│   ├── ledger/                  # Entry rules, balance, progress, milestones
│   ├── statistics/              # Totals, averages, streaks, per-month breakdown
│   ├── forecast/                # Pace, projection, required contribution
│   ├── transfer/                # Export/import document model and merge rules
│   ├── ports/                   # Repository, Clock, Notifier, FileGateway, Logger
│   └── errors/                  # AppError union, Result
├── data/                        # Adapters implementing domain ports
│   └── sqlite/
│       ├── migrations/
│       ├── repositories/
│       └── mappers/
├── platform/                    # Expo wrappers behind ports
│   ├── notifications/
│   ├── files/
│   └── clock/
├── features/                    # Feature UI: hooks, view models, screen components
│   ├── goal/
│   ├── entries/
│   ├── statistics/
│   ├── forecast/
│   ├── reminders/
│   └── data-transfer/
├── ui/                          # Design system
│   ├── tokens/                  # The only place style values exist
│   ├── primitives/              # Screen, Text, Button, Card, Field, StateView
│   └── components/              # Shared composites, incl. accessible chart wrapper
└── app/                         # Composition root: providers, DI wiring, query client

tests/
├── unit/                        # Mirrors src/domain — no I/O
├── integration/                 # Repositories and migrations via better-sqlite3
├── component/                   # Screens and primitives via Testing Library
└── e2e/                         # Maestro flows, one per user story journey
```

**Structure Decision**: A single Expo application with a layered internal structure — `app/` for routing, `src/domain/` for rules, `src/data/` and `src/platform/` for adapters, `src/features/` and `src/ui/` for presentation. There is no `api/` or `backend/` directory because this release has no server (FR-041), and no per-platform `ios/`/`android/` source trees because one codebase serves both (FR-037).

The layering is what Principle III's dependency-inversion rule buys: dependencies point inward only, `src/domain` has no imports from any other layer, and an ESLint boundary rule enforces that mechanically rather than by convention. It is also the reason the deferred accounts-and-sync release is additive — a sync adapter becomes another implementation of the same repository ports rather than a change to the rules.

Tests are centralized under `tests/` mirroring `src/` rather than colocated, so there is exactly one convention for where a test lives (Principle V).

## Complexity Tracking

No constitution violations. No deviations to justify, and the Complexity Tracking table is intentionally empty.

Two decisions were close enough to warrant recording the reasoning where a reviewer will look for it:

- **TanStack Query accepted while an ORM was rejected** — both are dependencies that could be argued away, and accepting one while rejecting the other needs to be principled rather than arbitrary. The distinction is what each replaces: the ORM would replace SQL that is already small and typed at the repository boundary, while the query layer replaces a four-state async machine that would otherwise be hand-written on every screen (D-005, D-008).
- **`better-sqlite3` as a test-only stand-in for `expo-sqlite`** — testing repositories against a different driver than production uses is a real, if narrow, fidelity gap. It is accepted deliberately, bounded to driver-level behavior since both are SQLite, and covered by an on-device smoke test (D-006).
