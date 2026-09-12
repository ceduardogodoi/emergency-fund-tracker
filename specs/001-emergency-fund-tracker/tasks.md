---

description: "Task list for Emergency Fund Tracker implementation"
---

# Tasks: Emergency Fund Tracker

**Input**: Design documents from `/specs/001-emergency-fund-tracker/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: Test tasks are **mandatory** in this project, not optional. Constitution Principle IV is marked NON-NEGOTIABLE and requires Red-Green-Refactor with the test observed failing for the intended reason before the implementing code is written. Every story phase therefore leads with failing tests.

**Organization**: Tasks are grouped by user story so each story can be implemented, tested, and shipped independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel — different files, no dependency on an incomplete task
- **[Story]**: Which user story the task serves (US1–US6). Setup, Foundational, Data Portability, and Polish phases carry no story label.
- Every task names an exact file path

## Path Conventions

Paths follow the structure in [plan.md](./plan.md): `app/` for Expo Router routes, `src/domain/` for pure rules, `src/data/` and `src/platform/` for adapters, `src/features/` and `src/ui/` for presentation, `tests/` mirroring `src/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and the quality gate that every later task must pass

- [X] T001 Initialize the Expo app with the TypeScript template at the repository root, installing `expo`, `react-native`, and `expo-router`
- [X] T002 [P] Create `.tool-versions` at the repository root pinning the Node version for asdf
- [X] T003 [P] Configure `tsconfig.json` with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and path aliases for `src/`
- [X] T004 [P] Configure Prettier in `.prettierrc`
- [X] T005 Configure ESLint in `eslint.config.mjs` with `typescript-eslint`, `complexity: 10`, `max-depth: 3`, and warnings treated as errors
- [X] T006 Add the layer-boundary ESLint rule in `eslint.config.mjs` forbidding any import of React, Expo, or `expo-sqlite` from within `src/domain/`
- [X] T007 Add the ESLint rule in `eslint.config.mjs` banning color, hex, and raw numeric spacing literals outside `src/ui/tokens/`
- [X] T008 Configure Jest in `jest.config.mjs` with the `jest-expo` preset, separate unit/integration/component projects, and coverage thresholds of 80% global and 95% for `src/domain/money`, `src/domain/dates`, `src/domain/statistics`, and `src/domain/forecast`
- [X] T009 [P] Install `better-sqlite3` as a dev dependency and configure the integration test project to run in a Node environment
- [X] T010 [P] Install Maestro and create `e2e/smoke.yaml` verifying the app launches
- [X] T011 Add npm scripts to `package.json` for `typecheck`, `lint`, `test`, `test:unit`, `test:integration`, `test:component`, `test:a11y`, `test:coverage`, `e2e`, `ios`, `android`, and `start`
- [X] T012 Configure a pre-commit hook in `lefthook.yml` running format, lint, typecheck, and tests, using the same commands CI runs
- [X] T013 [P] Add the CI workflow in `.github/workflows/ci.yml` running `asdf install`, `npm ci`, and the identical quality gate
- [X] T014 Create the source directory skeleton under `app/`, `src/`, and `tests/` per the structure in plan.md
- [X] T015 Resolve R-001 — record the exact Expo SDK, React Native, and React versions and the resulting iOS and Android minimums in the Technical Context of `specs/001-emergency-fund-tracker/plan.md`

**Checkpoint**: `npm run typecheck`, `npm run lint`, and `npm test` all pass on an empty project

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The money, date, error, persistence, and design-system infrastructure every user story depends on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Domain primitives

- [X] T016 [P] Write failing unit tests for the `Money` branded type and its arithmetic in `tests/unit/domain/money/money.test.ts`
- [X] T017 [P] Write failing unit tests for the rounding policy — amounts round down, month counts round up — in `tests/unit/domain/money/rounding.test.ts`
- [X] T018 [P] Write failing unit tests for `CalendarDate`, month bucketing, and complete-month boundaries in `tests/unit/domain/dates/calendar-date.test.ts`
- [X] T019 Implement the `Money` branded type and integer minor-unit arithmetic in `src/domain/money/money.ts`
- [X] T020 Implement the single rounding module in `src/domain/money/rounding.ts`
- [X] T021 Implement `CalendarDate` and month helpers over explicit UTC arithmetic in `src/domain/dates/calendar-date.ts`

### Ports

- [X] T022 [P] Define the `Clock` port in `src/domain/ports/clock.ts`
- [X] T023 [P] Define the `IdGenerator` port in `src/domain/ports/id-generator.ts`
- [X] T024 [P] Define `Result` and the `AppError` discriminated union in `src/domain/errors/index.ts`
- [X] T025 [P] Define the `Logger` port and the `SafeContext` type that cannot accept `Money` or `CalendarDate` in `src/domain/ports/logger.ts`
- [X] T026 Define all repository ports in `src/domain/ports/repositories.ts` per contracts/domain-ports.md
- [X] T027 Define the `UnitOfWork` port in `src/domain/ports/unit-of-work.ts`
- [X] T028 [P] Define the `FileGateway` and `Notifier` ports in `src/domain/ports/`

### Platform adapters

- [X] T029 [P] Implement the system `Clock` in `src/platform/clock/system-clock.ts`
- [X] T030 [P] Implement the UUID `IdGenerator` in `src/platform/id/uuid-generator.ts`
- [X] T031 [P] Implement the `Logger` — console in development, no-op in release — in `src/platform/logging/logger.ts`

### Persistence foundation

- [X] T032 Write a failing integration test for the `user_version` migration runner in `tests/integration/data/migration-runner.test.ts`
- [X] T033 Implement the forward-only migration runner in `src/data/sqlite/migrations/runner.ts`
- [X] T034 Write a failing integration test asserting migration 001 creates every table, constraint, and index in `tests/integration/data/migration-001.test.ts`
- [X] T035 Implement migration 001 creating `profile`, `goal`, `goal_change`, `ledger_entry`, `reminder_setting`, and `milestone_ack` with all constraints from data-model.md in `src/data/sqlite/migrations/001-initial.ts`
- [X] T036 Implement database bootstrap and the `UnitOfWork` transaction wrapper in `src/data/sqlite/database.ts`

### Test infrastructure

- [X] T037 [P] Create the in-memory test doubles — `FakeClock`, counting `IdGenerator`, array-backed repositories — in `tests/support/doubles/`
- [X] T038 [P] Create the `better-sqlite3` test harness that applies migrations to a fresh in-memory database in `tests/support/sqlite-harness.ts`

### Design system

- [X] T039 [P] Write failing unit tests for the money and date formatters in `tests/unit/ui/format.test.ts`
- [X] T040 Implement the single money and date formatters over `Intl` in `src/ui/format/index.ts`
- [X] T041 [P] Create the semantic design tokens — spacing, color, typography, radii — in `src/ui/tokens/index.ts` — retuned to a visual language rather than a neutral default, recorded under "Visual language" in `contracts/ui-contract.md`: a cool concrete ground with white slabs, square corners, and a single ultramarine accent used at most twice a screen. Archivo replaces the system face (`expo-font` + `@expo-google-fonts/archivo`, bundled so FR-041 still holds), so the type styles name a `fontFamily` per weight — React Native resolves a weight by family, not by `fontWeight`, and Android ignores the latter. The elevation token is gone: nothing in this language floats, and a shadow token left in the module is how a card acquires one on the screen someone builds in a hurry. The contrast audit T042 wrote covered the whole palette change without an edit
- [X] T042 Write the failing test asserting every token color pair meets 4.5:1 contrast in `tests/unit/ui/tokens-contrast.test.ts`
- [X] T043 [P] Implement the `Screen`, `Text`, `Button`, and `Card` primitives in `src/ui/primitives/` — later joined by `CoverageMeter`, which draws months of coverage as countable units so four levels compare without reading four numbers, and by a `prominent` mode on `Field` that `MoneyInput` always sets, because the amount is the subject of every screen it appears on. The meter is decorative and hidden from assistive technology, which its test proves by querying for it without `includeHiddenElements`. It sits with the custom duration field rather than inside the custom option: an option that grows when chosen pushes the field out from under the finger reaching for it, which is the same reason `Choice` keeps its border width constant — found by `e2e/us1-set-target.yaml` failing on iOS. Two Android-only defects followed, both reported from a device and neither visible to any existing test: the keyboard covered the field being typed into, since `automaticallyAdjustKeyboardInsets` is iOS-only and `edgeToEdgeEnabled` stops the window resizing — `Screen` now pads through a `KeyboardAvoidingView` on Android; and `Voltar à meta calculada` painted as `Voltar à meta`, because Android mismeasures a content-sized text box carrying an app-loaded font, which `Text`'s new `align` prop fixes by giving the box a definite width. Both are guarded in `tests/component/primitives.test.tsx`, and the keyboard also in the e2e flow (Maestro's tree omits what the keyboard covers, so the assertion fails on the defect). The keyboard guard took two attempts: the first read `behavior` off the element carrying the testID, which is the host view `KeyboardAvoidingView` renders and which never receives that prop — so it read `undefined` on every platform and passed while asserting nothing. It asserts the container's rendered inset now, which also catches the behaviour being unwired altogether
- [X] T044 [P] Implement the `Field` and `MoneyInput` primitives, with `MoneyInput` emitting `Money` in minor units, in `src/ui/primitives/`
- [X] T045 Implement the `StateView` primitive with a required `empty` renderer and no default, in `src/ui/primitives/state-view.tsx`
- [X] T046 [P] Implement the `ConfirmSheet` primitive in `src/ui/primitives/confirm-sheet.tsx`
- [X] T047 [P] Create the centralized user-facing strings module in `src/ui/strings/index.ts`

### Application shell

- [X] T048 Implement the composition root wiring every port to its adapter in `src/runtime/composition-root.ts` — the formatters take BRL per research decision D-019; there is no currency picker in this release. Split by dependency direction into `src/runtime/services.ts` (the port bundle), `src/runtime/services-context.tsx` (provider and hook), and `src/runtime/composition-root.ts` (the wiring, and the only module under `src/` importing a native Expo module); `.ts` rather than `.tsx` because the wiring holds no JSX. `unitOfWork` is deferred to T059 — see the note there
- [X] T049 Configure the TanStack Query client, the query-key registry, and the `ViewState` mapping in `src/runtime/query.ts`
- [X] T050 Implement the Expo Router root layout with providers in `app/_layout.tsx`

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 - Set a personalized emergency fund target (Priority: P1) 🎯 MVP

**Goal**: A user enters their monthly essential expenses, picks a conservativeness level, and gets a target they can adjust or override — persisted across restarts.

**Independent Test**: On a fresh install, enter an expense figure, cycle through every level confirming the target recalculates, override it manually, then relaunch and confirm it survived.

### Tests for User Story 1

> Write these FIRST and confirm they fail for the intended reason before implementing

- [X] T051 [P] [US1] Unit tests for `calculateTarget` and level-to-months mapping in `tests/unit/domain/goal/target.test.ts`
- [X] T052 [P] [US1] Unit tests for goal validation — zero, negative, and non-numeric expenses, custom months outside 1–24, zero target — in `tests/unit/domain/goal/validation.test.ts`
- [X] T053 [P] [US1] Integration tests for `ProfileRepository` including the single-row constraint in `tests/integration/data/profile-repository.test.ts`
- [X] T054 [P] [US1] Integration tests for `GoalRepository` including the `goal_change` audit row on every revision in `tests/integration/data/goal-repository.test.ts`
- [X] T055 [P] [US1] Component tests for the onboarding expenses and level screens in `tests/component/onboarding.test.tsx` — also adds `tests/component/home.test.tsx` for the Home screen T065 builds, and `tests/support/app-harness.tsx`, which stands up the providers and shuts the query client down in the order teardown requires
- [X] T056 [P] [US1] Maestro flow covering the Story 1 journey in `e2e/us1-set-target.yaml` — runs inside Expo Go (`openLink` on the dev server, since the app has no package of its own until there is a development build); `e2e/open-app.yaml` holds the launch and Expo Go's developer sheet, and `e2e/config.yaml` keeps it out of the run set. `APP_ID` and `DEV_URL` come from `npm run e2e` / `e2e:ios` rather than a flow `env:` block, which silently wins over `-e`. It found two bugs on its first run: the goal invisible after saving (fixed in `useSubmitGoal` — see T061), and, on iOS only, the keyboard covering the controls below it (fixed in `Screen` with `keyboardDismissMode`). Passes on both platforms

### Implementation for User Story 1

- [X] T057 [P] [US1] Implement the four conservativeness levels with their explanations in `src/domain/goal/levels.ts` — the durations live there; the names and FR-003 explanations are user-facing text and live in `src/ui/strings/strings.ts`, which the domain may not import. `tests/unit/ui/strings.test.ts` asserts the two stay in step
- [X] T058 [US1] Implement `calculateTarget` and the calculated-target invariant in `src/domain/goal/target.ts` — also adds `src/domain/goal/validation.ts`, which T052 tests but no task named
- [X] T059 [P] [US1] Implement `ProfileRepository` in `src/data/sqlite/repositories/profile-repository.ts` — also closed the two gaps T048 left open: the `expo-sqlite` adapter for the `SqliteDatabase` port now lives in `src/data/sqlite/expo-driver.ts` (no task had covered it), and `Services` carries `unitOfWork`, wired through `createUnitOfWork` and `createRepositoriesFactory`. `createServices` now takes an open database and `openServices` opens one, so the root layout boots through `useBootstrap` and renders the four-state contract over its own startup
- [X] T060 [US1] Implement `GoalRepository` including `recordChange` and `listChanges` in `src/data/sqlite/repositories/goal-repository.ts`
- [X] T061 [US1] Implement the goal query and mutation hooks with invalidation in `src/features/goal/hooks.ts` — invalidation alone was not enough: `refetchType` defaults to `active`, so the goal query, whose only reader (Home) is unmounted during onboarding, was marked stale and never refetched. Home then mounted, read the null it had left behind, and redirected the user back to step one with their saved goal invisible until the next cold start. The invalidations now use `refetchType: 'all'` and are awaited, so success means every reader is already correct. Found by T056 on a device
- [X] T062 [P] [US1] Build the onboarding expenses screen with inline validation in `app/onboarding/expenses.tsx` — the currency is BRL per research decision D-019 and the screen asks nothing about it. It does **not** write the profile: `submitGoal` (T061) writes the profile and the goal in one transaction at the end of the flow, so the figure travels to the level step in the route instead. A profile stored at step one would describe expenses no target derives from if the user stopped there
- [X] T063 [P] [US1] Build the onboarding level screen showing who each level suits in `app/onboarding/level.tsx` — the draft's state machine lives in `src/features/goal/use-goal-draft.ts`, because the goal revision screen (T066) makes the same three decisions and has to reach the same target from them. Adds the `Choice` primitive (announced as a radio, carrying its own name, explanation, and selected state) and the `borderWidth`/`opacity` tokens it needs, both recorded in `contracts/ui-contract.md`
- [X] T064 [US1] Build the target preview showing the derivation, with manual override, in `src/features/goal/target-preview.tsx`
- [X] T065 [US1] Build the Home screen showing the target in `app/index.tsx`
- [ ] T066 [US1] Build the goal revision screen with its impact-on-progress preview in `app/settings/goal.tsx`
- [X] T067 [US1] Wire first-launch routing — onboarding when no goal exists, Home when one does — landed in `app/index.tsx` rather than `app/_layout.tsx`: `/` is the route that owns the question, and the redirect is its empty state per the screen inventory. A guard in the layout would run on every screen including the onboarding screens it redirects to, and would have to know which of them to leave alone. Getting there took fixing where the router looks: it prefers `src/app` over `app/` whenever that directory exists, and the composition root lived at `src/app/`, so Expo Router had been treating those five modules as the app's routes — no `index`, no default exports, "Unmatched Route" on iOS and "Element type is invalid" on Android. That directory is `src/runtime/` now (T048, T049 renamed with it) and `app.json` names the root explicitly. `tests/unit/app/router-root.test.ts` and `tests/component/routes.test.tsx` guard both halves, since component tests import screens directly and pass whatever the router is pointed at

**Checkpoint**: Story 1 is fully functional and independently testable. This is the MVP.

---

## Phase 4: User Story 2 - Record savings and see progress (Priority: P2)

**Goal**: The user logs contributions with a date and note, sees balance, remaining, and percentage on Home, and can correct any past entry.

**Independent Test**: With a target set, log three contributions, verify all derived figures, then edit one and delete another and verify everything recalculates.

### Tests for User Story 2

- [ ] T068 [P] [US2] Unit tests for balance calculation including the opening-entry rules in `tests/unit/domain/ledger/balance.test.ts`
- [ ] T069 [P] [US2] Unit tests for progress summary — remaining, surplus, percentage, reached, and the exact-target boundary — in `tests/unit/domain/ledger/progress.test.ts`
- [ ] T070 [P] [US2] Unit tests for entry validation — amount above zero, no future dates, at most one opening, note length — in `tests/unit/domain/ledger/entry.test.ts`
- [ ] T071 [P] [US2] Integration tests for `LedgerRepository` covering CRUD, ordering, and the future-dated query in `tests/integration/data/ledger-repository.test.ts`
- [ ] T072 [P] [US2] Reconciliation test running at least 1,000 randomized entry sequences and asserting exact balances with zero rounding drift (SC-007) in `tests/integration/data/reconciliation.test.ts`
- [ ] T073 [P] [US2] Component tests for the contribute form and the history list in `tests/component/entries.test.tsx`
- [ ] T074 [P] [US2] Maestro flow covering the Story 2 journey in `e2e/us2-record-progress.yaml`

### Implementation for User Story 2

- [ ] T075 [P] [US2] Implement the `LedgerEntry` model and its validation rules in `src/domain/ledger/entry.ts`
- [ ] T076 [US2] Implement `calculateBalance`, excluding future-dated entries, in `src/domain/ledger/balance.ts`
- [ ] T077 [US2] Implement `summarizeProgress` in `src/domain/ledger/progress.ts`
- [ ] T078 [US2] Implement `LedgerRepository` in `src/data/sqlite/repositories/ledger-repository.ts` — and delete its placeholder from `src/data/sqlite/repositories/pending.ts`, which fails every call so an unimplemented repository can never be mistaken for an empty fund
- [ ] T079 [US2] Implement the ledger query hooks and mutation invalidation in `src/features/entries/hooks.ts`
- [ ] T080 [P] [US2] Build the opening balance onboarding screen, skippable, in `app/onboarding/opening-balance.tsx`
- [ ] T081 [P] [US2] Build the add contribution screen in `app/entries/contribute.tsx`
- [ ] T082 [US2] Build the history list distinguishing contributions from withdrawals by icon and label, never by color alone, in `app/entries/index.tsx`
- [ ] T083 [US2] Build the edit and delete flow using `ConfirmSheet` in `src/features/entries/edit-entry.tsx`
- [ ] T084 [US2] Extend Home with balance, remaining, progress percentage, and the goal-reached surplus state in `app/index.tsx`
- [ ] T085 [US2] Build the future-dated entry warning surface in `src/features/entries/future-dated-banner.tsx`
- [ ] T086 [US2] Announce the new balance through a live region after a save in `src/features/entries/hooks.ts`
- [ ] T087 [US2] Implement the seed script with `--months`, `--pattern steady|erratic`, and `--reset` in `scripts/seed.ts`

**Checkpoint**: Stories 1 and 2 both work independently. The core saving loop is complete.

---

## Phase 5: User Story 3 - Monitor progress with statistics (Priority: P3)

**Goal**: The user sees balance growth, totals, averages, streaks, and a month-by-month breakdown, filterable by period, with milestones acknowledged as they are crossed.

**Independent Test**: Seed several months of history, open Statistics, and verify every figure against a hand calculation of the same data; then filter to a shorter period and verify everything recalculates.

### Tests for User Story 3

- [ ] T088 [P] [US3] Unit tests for statistics aggregates, asserting the opening entry is excluded from contribution count and total contributed, in `tests/unit/domain/statistics/summary.test.ts`
- [ ] T089 [P] [US3] Unit tests for current and longest streaks, including the rule that an incomplete current month does not break a streak, in `tests/unit/domain/statistics/streaks.test.ts`
- [ ] T090 [P] [US3] Unit tests for the per-month breakdown including zero-activity months in `tests/unit/domain/statistics/breakdown.test.ts`
- [ ] T091 [P] [US3] Unit tests for milestone crossing and re-crossing after a withdrawal or a raised target in `tests/unit/domain/ledger/milestones.test.ts`
- [ ] T092 [P] [US3] Integration tests for `MilestoneRepository` including `clearAbove` in `tests/integration/data/milestone-repository.test.ts`
- [ ] T093 [P] [US3] Component tests for the statistics screen states and the period filter in `tests/component/statistics.test.tsx`
- [ ] T094 [P] [US3] Accessibility test asserting every chart exposes an equivalent text summary and data table in `tests/component/chart-frame.test.tsx`
- [ ] T095 [P] [US3] Maestro flow covering the Story 3 journey in `e2e/us3-statistics.yaml`

### Implementation for User Story 3

- [ ] T096 [P] [US3] Implement the statistics summary aggregates in `src/domain/statistics/summary.ts` — also re-enable the commented-out 95% coverage threshold for `./src/domain/statistics/` in `jest.config.mjs`
- [ ] T097 [P] [US3] Implement current and longest streak calculation in `src/domain/statistics/streaks.ts`
- [ ] T098 [US3] Implement the per-month breakdown in `src/domain/statistics/breakdown.ts`
- [ ] T099 [P] [US3] Implement `crossedMilestones` in `src/domain/ledger/milestones.ts`
- [ ] T100 [US3] Implement `MilestoneRepository` in `src/data/sqlite/repositories/milestone-repository.ts` — and delete its placeholder from `src/data/sqlite/repositories/pending.ts`, which fails every call so an unimplemented repository can never be mistaken for an empty fund
- [ ] T101 [US3] Implement `ChartFrame` rendering the chart, a text summary, and a screen-reader data table from the same data in `src/ui/components/chart-frame.tsx`
- [ ] T102 [P] [US3] Build the balance-over-time chart in `src/features/statistics/balance-chart.tsx`
- [ ] T103 [P] [US3] Build the month-by-month bar chart in `src/features/statistics/month-chart.tsx`
- [ ] T104 [US3] Build the statistics screen with the period filter and a purposeful empty state per card in `app/statistics.tsx`
- [ ] T105 [US3] Wire milestone acknowledgement into the entry save path in `src/features/entries/hooks.ts`

**Checkpoint**: Stories 1–3 all work independently

---

## Phase 6: User Story 4 - Forecast when the goal will be reached (Priority: P4)

**Goal**: The user sees a projected completion date derived from their trailing pace, the pace it assumes, and what monthly contribution a chosen target date would demand.

**Independent Test**: Seed histories of differing length and consistency and verify the projected date, the stated pace, and the required-monthly figure against hand calculation — including the too-short and zero-pace cases.

### Tests for User Story 4

- [ ] T106 [P] [US4] Unit tests for `calculatePace` over complete calendar months only, asserting the in-progress month is excluded, in `tests/unit/domain/forecast/pace.test.ts`
- [ ] T107 [P] [US4] Unit tests for `project` covering all four `ForecastState` cases in `tests/unit/domain/forecast/project.test.ts`
- [ ] T108 [P] [US4] Unit tests for `requiredMonthly` and the exceeds-pace indication in `tests/unit/domain/forecast/required.test.ts`
- [ ] T109 [P] [US4] Component tests rendering the forecast screen in all four states in `tests/component/forecast.test.tsx`
- [ ] T110 [P] [US4] Maestro flow covering the Story 4 journey in `e2e/us4-forecast.yaml`

### Implementation for User Story 4

- [ ] T111 [US4] Implement `calculatePace` in `src/domain/forecast/pace.ts` — also re-enable the commented-out 95% coverage threshold for `./src/domain/forecast/` in `jest.config.mjs`
- [ ] T112 [US4] Implement `project` and the `ForecastState` union in `src/domain/forecast/project.ts`
- [ ] T113 [US4] Implement `requiredMonthly` in `src/domain/forecast/required.ts`
- [ ] T114 [US4] Implement forecast hooks invalidating on any ledger or goal change in `src/features/forecast/hooks.ts`
- [ ] T115 [US4] Build the forecast screen rendering all four states, always stating the assumed pace alongside the date, in `app/forecast.tsx`
- [ ] T116 [US4] Add the desired completion date setting and its required-contribution readout to `app/settings/goal.tsx`

**Checkpoint**: Stories 1–4 all work independently

---

## Phase 7: User Story 5 - Handle withdrawals and recovery (Priority: P5)

**Goal**: The user records a withdrawal with a reason and sees the reduced balance, the shortfall, and how long recovery will take at their current pace.

**Independent Test**: From a positive balance, record a withdrawal and verify balance, progress, shortfall, and recovery estimate; then attempt to overdraw and verify the warning and confirmation.

### Tests for User Story 5

- [ ] T117 [P] [US5] Unit tests for withdrawal validation and the over-balance rule in `tests/unit/domain/ledger/withdrawal.test.ts`
- [ ] T118 [P] [US5] Unit tests for shortfall and the recovery estimate in `tests/unit/domain/forecast/recovery.test.ts`
- [ ] T119 [P] [US5] Component tests for the withdraw screen and the over-balance confirmation in `tests/component/withdraw.test.tsx`
- [ ] T120 [P] [US5] Maestro flow covering the Story 5 journey in `e2e/us5-withdrawal.yaml`

### Implementation for User Story 5

- [ ] T121 [US5] Implement withdrawal rules and the required reason in `src/domain/ledger/withdrawal.ts`
- [ ] T122 [US5] Implement the shortfall and recovery estimate in `src/domain/forecast/recovery.ts`
- [ ] T123 [US5] Build the withdraw screen with predefined and free-text reasons in `app/entries/withdraw.tsx`
- [ ] T124 [US5] Build the over-balance warning and explicit confirmation in `src/features/entries/withdraw-confirm.tsx`
- [ ] T125 [US5] Surface the shortfall and recovery estimate on Home in `app/index.tsx`

**Checkpoint**: Stories 1–5 all work independently

---

## Phase 8: User Story 6 - Stay on track with reminders (Priority: P6)

**Goal**: The user opts into a recurring local reminder to contribute, and can change or switch it off at any time.

**Independent Test**: Enable a reminder, verify the permission flow including denial, confirm delivery at the scheduled time, then disable and confirm nothing further arrives.

### Tests for User Story 6

- [ ] T126 [P] [US6] Unit tests for reminder schedule validation, including the day-of-month cap at 28, in `tests/unit/domain/reminders/schedule.test.ts`
- [ ] T127 [P] [US6] Integration tests for `ReminderRepository` in `tests/integration/data/reminder-repository.test.ts`
- [ ] T128 [P] [US6] Component tests for the reminders settings screen including the permission-denied state in `tests/component/reminders.test.tsx`
- [ ] T129 [P] [US6] Maestro flow covering the Story 6 journey in `e2e/us6-reminders.yaml`

### Implementation for User Story 6

- [ ] T130 [US6] Implement the reminder schedule model in `src/domain/reminders/schedule.ts`
- [ ] T131 [US6] Implement `ReminderRepository` in `src/data/sqlite/repositories/reminder-repository.ts` — and delete its placeholder from `src/data/sqlite/repositories/pending.ts`, which fails every call so an unimplemented repository can never be mistaken for an empty fund
- [ ] T132 [US6] Implement the `Notifier` adapter over `expo-notifications`, scheduling local notifications only, in `src/platform/notifications/notifier.ts`
- [ ] T133 [US6] Build the reminders settings screen with the permission request and denial explanation in `app/settings/reminders.tsx`
- [ ] T134 [US6] Resolve R-003 — verify scheduling behavior after device restart and force-quit and confirm Android exact-alarm requirements, recording findings in `specs/001-emergency-fund-tracker/research.md`

**Checkpoint**: All six user stories are independently functional

---

## Phase 9: Data Portability (Cross-Cutting)

**Purpose**: Export, import, and erase — FR-044 through FR-047 and SC-015. Required for release, but serves no single user story.

### Tests

- [ ] T135 [P] Unit tests for the export document builder in `tests/unit/domain/transfer/export.test.ts`
- [ ] T136 [P] Unit tests for the import schema covering every rejection case in contracts/fund-export-v1.md in `tests/unit/domain/transfer/import-schema.test.ts`
- [ ] T137 [P] Unit tests for merge deduplication and replace semantics in `tests/unit/domain/transfer/merge.test.ts`
- [ ] T138 [P] Integration test asserting an export imported into a fresh database reproduces the goal, every entry, the balance, and every statistic (SC-015) in `tests/integration/data/round-trip.test.ts`
- [ ] T139 [P] Integration test asserting a failed import leaves the database exactly as it was in `tests/integration/data/import-atomicity.test.ts`

### Implementation

- [ ] T140 Implement the export document builder in `src/domain/transfer/export.ts`
- [ ] T141 Implement the `zod` import schema and the cross-field rules in `src/domain/transfer/import-schema.ts`
- [ ] T142 Implement merge and replace application inside a single `UnitOfWork` transaction in `src/domain/transfer/apply-import.ts`
- [ ] T143 Implement the `FileGateway` adapter over `expo-file-system`, `expo-sharing`, and `expo-document-picker` in `src/platform/files/file-gateway.ts`
- [ ] T144 Build the data settings screen with export, import, and the replace-or-merge choice stating what each will do, in `app/settings/data.tsx`
- [ ] T145 Build the erase-all-data flow with `ConfirmSheet` in `src/features/data-transfer/erase.tsx`

**Checkpoint**: A fund survives a reinstall and a platform switch

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: The verification the success criteria demand, and the checks that only make sense once everything exists

- [ ] T146 [P] Walk all eleven screens with VoiceOver and TalkBack and fix every finding, in the affected files under `app/` and `src/features/`
- [ ] T147 [P] Add maximum text-scale component tests for every screen in `tests/component/text-scale.test.tsx`
- [ ] T148 [P] Verify SC-014 by exercising every screen with a proxy attached and confirming zero outbound requests, recording the result in `specs/001-emergency-fund-tracker/quickstart.md`
- [ ] T149 [P] Verify FR-040 by running every scenario in `specs/001-emergency-fund-tracker/quickstart.md` with the device in airplane mode
- [ ] T150 Verify SC-012 — cold launch under 2 seconds and 60fps history scrolling on a 3-year-old mid-range Android with a ten-year seeded history from `scripts/seed.ts`
- [ ] T151 Resolve R-002 — verify `Intl` currency and date formatting in an Android release build, recording the outcome in `specs/001-emergency-fund-tracker/research.md`
- [ ] T152 Run the full validation suite in `specs/001-emergency-fund-tracker/quickstart.md` on a physical iOS device and a physical Android device
- [ ] T153 Verify coverage thresholds in `jest.config.mjs` are met and no `skip`, `only`, or `todo` marker remains in any file under `tests/`
- [ ] T154 [P] Write `README.md` documenting asdf setup, the command reference, and the architecture boundary rule
- [ ] T155 Final compliance review against all six principles in `.specify/memory/constitution.md` before release

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup. **Blocks every user story.**
- **User Stories (Phases 3–8)**: All depend on Foundational. Then either sequentially by priority, or in parallel with enough people.
- **Data Portability (Phase 9)**: Depends on Foundational and on every entity existing — realistically after Phase 8, though it only strictly needs the repositories
- **Polish (Phase 10)**: Depends on every story intended for the release

### User Story Dependencies

- **US1 (P1)**: Depends only on Foundational. No dependency on another story.
- **US2 (P2)**: Depends only on Foundational. Reads the goal US1 creates, but is testable against a seeded goal.
- **US3 (P3)**: Depends only on Foundational. Needs ledger entries to be interesting, but is testable against seeded entries.
- **US4 (P4)**: Depends only on Foundational. Same — testable against seeded history.
- **US5 (P5)**: Depends only on Foundational. Shares the ledger with US2 and reuses the pace from US4's recovery estimate; if built before US4, T122 brings `calculatePace` forward with it.
- **US6 (P6)**: Depends only on Foundational. Fully independent of every other story.

### Within Each User Story

- Tests are written and observed failing before any implementation — non-negotiable per Principle IV
- Domain rules before repositories, repositories before hooks, hooks before screens
- The story is complete and validated before moving to the next priority

### Parallel Opportunities

- Setup: T002, T003, T004, T009, T010, and T013 all run in parallel
- Foundational: the three domain-primitive test files (T016–T018) in parallel; all seven port definitions (T022–T028) in parallel once `Result` exists; the three platform adapters (T029–T031) in parallel; primitives T043, T044, T046, T047 in parallel
- Every story: all test tasks within a story run in parallel — they touch different files
- Across stories: once Phase 2 is done, six developers could take one story each

---

## Parallel Example: User Story 1

```bash
# All Story 1 tests together — they fail, which is the point:
Task: "Unit tests for calculateTarget in tests/unit/domain/goal/target.test.ts"
Task: "Unit tests for goal validation in tests/unit/domain/goal/validation.test.ts"
Task: "Integration tests for ProfileRepository in tests/integration/data/profile-repository.test.ts"
Task: "Integration tests for GoalRepository in tests/integration/data/goal-repository.test.ts"
Task: "Component tests for onboarding screens in tests/component/onboarding.test.tsx"
Task: "Maestro flow in e2e/us1-set-target.yaml"

# Then the independent implementation pieces:
Task: "Implement conservativeness levels in src/domain/goal/levels.ts"
Task: "Implement ProfileRepository in src/data/sqlite/repositories/profile-repository.ts"
Task: "Build onboarding expenses screen in app/onboarding/expenses.tsx"
Task: "Build onboarding level screen in app/onboarding/level.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1: Setup
2. Phase 2: Foundational — the largest phase, and the one that makes every later phase small
3. Phase 3: User Story 1
4. **STOP and VALIDATE** — run the Story 1 scenarios in quickstart.md
5. A user can now size their emergency fund, which is the single most common unanswered question this product addresses

### Incremental Delivery

Each story is a shippable increment:

1. Setup + Foundational → foundation ready
2. + US1 → **MVP**: know your target
3. + US2 → the core saving loop: track progress toward it
4. + US3 → motivation and insight
5. + US4 → a projected finish date
6. + US5 → correct behavior when the fund is actually used
7. + US6 → consistency support
8. + Phase 9 → data survives a reinstall
9. + Phase 10 → release-ready

A reasonable public release is US1–US3 plus Phase 9. US4 and US5 are what make it a considered product rather than a ledger; US5 in particular should not be deferred indefinitely, because a user who withdraws before it exists will see a wrong balance.

### Parallel Team Strategy

Phases 1 and 2 are hard to parallelize across people — they are foundations with tight interdependencies, and one person should own them for coherence. After that, six stories can proceed independently. Phase 9 is a natural parallel track for a second developer once the repositories exist.

---

## Notes

- **[P]** means a different file with no dependency on incomplete work
- **[Story]** labels map tasks to spec.md stories for traceability
- Every test must be observed failing for the intended reason before its implementation is written — a test that passes on first run is not evidence of anything
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently
- Coverage floors are enforced by the Jest config, not by discipline: 80% global, 95% on money, dates, statistics, and forecast
- Three research items resolve inside these tasks: R-001 at T015, R-003 at T134, R-002 at T151
