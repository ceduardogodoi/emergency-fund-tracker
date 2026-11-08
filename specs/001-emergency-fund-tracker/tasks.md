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
- [X] T066 [US1] Build the goal revision screen with its impact-on-progress preview in `app/settings/goal.tsx` — the impact it previews is the target's, not progress: FR-006's progress percentage needs a balance, and the ledger does not exist until US2, where `pending.ts` fails every call rather than returning a plausible zero. A percentage computed from a balance the app cannot read would be a number invented to satisfy the requirement, so T156 picks that half up alongside the ledger. Adds `GoalImpact` (the stored target and the size of the step; the new figure is already the largest thing on the screen, so repeating it would say nothing), `useStoredGoal` (goal and profile as one query, so the screen handles four states rather than sixteen), and `storedGoalDraft`. `useGoalDraft` now opens on a `GoalDraftStart` and carries the expenses as editable state, since FR-006 names the expense figure as well as the level; its five `useState` calls became one `useReducer`, because every edit also clears the refusal message and that is a rule about the draft rather than about any one field. `LevelOptions` moved to `src/features/goal/` — the choice is made twice, and two lists could offer different levels. Home gains the way in (`revise-goal`), without which the screen exists only in the route table. `e2e/us1-revise-target.yaml` covers the journey on both platforms, including the part only a device checks: Home is already mounted when the revision saves, so a stale cache there would show the old target on the screen the user lands on
- [X] T067 [US1] Wire first-launch routing — onboarding when no goal exists, Home when one does — landed in `app/index.tsx` rather than `app/_layout.tsx`: `/` is the route that owns the question, and the redirect is its empty state per the screen inventory. A guard in the layout would run on every screen including the onboarding screens it redirects to, and would have to know which of them to leave alone. Getting there took fixing where the router looks: it prefers `src/app` over `app/` whenever that directory exists, and the composition root lived at `src/app/`, so Expo Router had been treating those five modules as the app's routes — no `index`, no default exports, "Unmatched Route" on iOS and "Element type is invalid" on Android. That directory is `src/runtime/` now (T048, T049 renamed with it) and `app.json` names the root explicitly. `tests/unit/app/router-root.test.ts` and `tests/component/routes.test.tsx` guard both halves, since component tests import screens directly and pass whatever the router is pointed at

**Checkpoint**: Story 1 is fully functional and independently testable. This is the MVP.

---

## Phase 4: User Story 2 - Record savings and see progress (Priority: P2)

**Goal**: The user logs contributions with a date and note, sees balance, remaining, and percentage on Home, and can correct any past entry.

**Independent Test**: With a target set, log three contributions, verify all derived figures, then edit one and delete another and verify everything recalculates.

### Tests for User Story 2

- [X] T068 [P] [US2] Unit tests for balance calculation including the opening-entry rules in `tests/unit/domain/ledger/balance.test.ts` — covers the FR-033 exclusion and its boundary (today counts, tomorrow does not), a negative balance after an overdrawing withdrawal, and order independence, since addition commutes and a repository that changes its sort must not change the fund
- [X] T069 [P] [US2] Unit tests for progress summary — remaining, surplus, percentage, reached, and the exact-target boundary — in `tests/unit/domain/ledger/progress.test.ts` — the exact-target case is the one FR-015 turns on: both figures zero and the goal reached. Also pins the negative-balance case to no progress rather than a negative share, and the spec's own 4.17% example
- [X] T070 [P] [US2] Unit tests for entry validation — amount above zero, no future dates, at most one opening, note length — in `tests/unit/domain/ledger/entry.test.ts` — withdrawal-specific rules are deliberately absent: a reason (FR-016) and the over-balance warning (FR-017) need the balance rather than one entry, and belong to T117
- [X] T071 [P] [US2] Integration tests for `LedgerRepository` covering CRUD, ordering, and the future-dated query in `tests/integration/data/ledger-repository.test.ts` — the ordering test inserts two same-date entries in the opposite order to their creation times, because SQLite returns rows in insertion order when nothing tells it otherwise and a test whose two orders agree passes with the `ORDER BY` deleted. Also pins that a failed read surfaces as a storage failure rather than a not-found: telling a user their entry was deleted when the disk is the problem offers them nothing to retry
- [X] T072 [P] [US2] Reconciliation test running at least 1,000 randomized entry sequences and asserting exact balances with zero rounding drift (SC-007) in `tests/integration/data/reconciliation.test.ts` — the expectation is summed in `BigInt`, which cannot lose precision, because recomputing it with the same arithmetic the code uses would agree with itself however wrong both were. Every sequence round-trips through SQLite, so a value that survives addition but is widened by the driver fails here and nowhere else. Seeded rather than `Math.random`, so a failure is reproducible on the machine that has to fix it. Runs in under half a second
- [X] T073 [P] [US2] Component tests for the contribute form and the history list in `tests/component/entries.test.tsx`
- [X] T074 [P] [US2] Maestro flow covering the Story 2 journey in `e2e/us2-record-progress.yaml` — grown with the screens rather than written ahead of them: the opening balance at T080, the history at T082, and the correction and the deletion at T083, which is where it became the story's Independent Test and this closed. An opening balance and two contributions; one corrected from R$ 500,00 to R$ 700,00, the other deleted behind its confirmation; the balance checked on Home after each save and again after a restart. Rows are matched by their text, since a row is one node on iOS and several on Android. Passes on both

### Implementation for User Story 2

- [X] T075 [P] [US2] Implement the `LedgerEntry` model and its validation rules in `src/domain/ledger/entry.ts` — the rules take an `EntryContext` (`today` and `hasOpening`) rather than reading a clock or a repository, which is what keeps them pure and lets the import path (FR-046) apply the same rules a form does. Checks run in the order a user would correct them: amount, date, note, then type
- [X] T076 [US2] Implement `calculateBalance`, excluding future-dated entries, in `src/domain/ledger/balance.ts` — never stored, summed on every call, which is what makes an edit or deletion correct by construction rather than by remembering to adjust a total. Returns a negative balance rather than clamping: an overdrawing withdrawal is a real state FR-017 warns about but does not forbid
- [X] T077 [US2] Implement `summarizeProgress` in `src/domain/ledger/progress.ts` — also adds the `ProgressSummary` type the domain-ports contract names but nothing had declared. `remaining` and `surplus` are clamped at zero so FR-015's ban on a negative remaining holds for every caller rather than at each screen, and the percentage routes through `percentOf`, the one place division happens
- [X] T078 [US2] Implement `LedgerRepository` in `src/data/sqlite/repositories/ledger-repository.ts` — and delete its placeholder from `src/data/sqlite/repositories/pending.ts`, which fails every call so an unimplemented repository can never be mistaken for an empty fund. `update` and `remove` read before writing, since an UPDATE or DELETE matching no rows succeeds as far as SQLite is concerned and the caller would be told an edit landed that never did. Split into reads and writes like `goal-repository.ts`, with the bind lists beside the statements whose column order they have to match. Adds `mappers/ledger.ts`; the factory now wires the real repository, and `repositories-factory.test.ts` moves the ledger from the group that must fail loudly to the group that works
- [X] T079 [US2] Implement the ledger query hooks and mutation invalidation in `src/features/entries/hooks.ts` — `useBalance` derives from `useEntries` through `select` rather than querying separately, so both read one cache entry: two would be two things to invalidate and two moments at which a screen could show a balance disagreeing with the history beside it. `useFutureDatedEntries` is keyed by today's date, because an entry dated tomorrow stops being future-dated at midnight. Every mutation invalidates the `entries` prefix with `refetchType: 'all'`, awaited — the US1 defect again, where the readers that matter are the ones with no observer. Statistics and forecast are deliberately not invalidated yet: nothing computes them, and invalidating a query that does not exist is a no-op dressed as correctness, so they join at T096 and T111. Also adds `src/domain/ledger/record-entry.ts`, which validates before writing the way `submitGoal` does — the rule has to reach the import path (FR-046), not only the form. Writing a future-dated entry turns out to be impossible through the app, since FR-009 refuses it; the ones FR-033 flags arrive by import or from a device clock that was ahead and has since been corrected, which is why that requirement asks for correction rather than prevention
- [X] T080 [P] [US2] Build the opening balance onboarding screen, skippable, in `app/onboarding/opening-balance.tsx` — the third step of setup: the level screen now leaves for it rather than for Home, so the goal is already stored when it opens and skipping, or closing the app there, leaves a working fund at zero. Nothing is validated in the form. `recordEntry` applies every rule, and the one that matters here — that no opening balance exists yet — only it can answer, so the mutation's refusal is shown under the amount and a storage failure is told apart from it. Adds `src/features/entries/use-opening-balance.ts`. Both US1 flows decline the step, and `e2e/us2-record-progress.yaml` is started with it: opening balance, one contribution, a restart. T074 stays open until that flow also edits and deletes (T082, T083)
- [X] T081 [P] [US2] Build the add contribution screen in `app/entries/contribute.tsx`
- [X] T082 [US2] Build the history list distinguishing contributions from withdrawals by icon and label, never by color alone, in `app/entries/index.tsx` — most recent first, the reverse of the order the ledger hands over: what a reader comes to check is what they just recorded. Each kind is told apart three ways that survive without colour — a word, a mark beside it, and a sign on the amount — with the copy keyed by `EntryType` in the strings module. The mark is a glyph in the app's own face inside a square, not an icon from a set: no icon library is installed, and three shapes did not justify one. A row is one accessible element and the mark is kept out of it. The list is a `FlatList` under `Screen scrolls={false}`, the first screen to opt out. Adds `src/features/entries/entry-row.tsx` and the way in from Home; the history tests join `tests/component/entries.test.tsx`, which T073 named for them, and `e2e/us2-record-progress.yaml` now opens the history
- [X] T083 [US2] Build the edit and delete flow using `ConfirmSheet` in `src/features/entries/edit-entry.tsx` — reached by pressing a row in the history, which makes the whole row the control, at `app/entries/[id].tsx`. Amount, day, and note can be corrected; the kind is stated and not offered, since an id must go on meaning the same movement (FR-047). A withdrawal's reason is left alone until User Story 5 says what a reason may be. The calendar is open from the start, unlike on the contribute screen: there the common answer is today, here the entry already has a day. Adds `src/domain/ledger/revise-entry.ts`, because `useUpdateEntry` wrote straight to the repository and a correction could set an amount to zero or a date to next week — it now checks the entry as the patch would leave it, so the fields a patch does not name are held to the rules too. The form validates nothing itself; the mutation's refusal is shown under the field it names (`use-entry-edit.ts`). Deleting asks through `ConfirmSheet`, and the deletion is owned above the form so the screen does not call the entry missing in the moment between the deletion landing and the screen leaving. Adds `useEntry`, which finds the entry in the list every other reader shares
- [X] T158 [US2] Tell the user that history entries can be corrected or deleted, in `app/entries/index.tsx` — after T083 a row opens its entry when pressed, and nothing visible says so: the hint exists only for a screen reader (`strings.entries.rowHint`), and a row looks the way it did when it was not a control. A line of text above the list, an affordance on the row, or both; whichever it is must not depend on colour alone (FR-049) and has to hold at the largest text size (FR-050). Raised in review of T083. Numbered out of sequence for the reason T156 is. Both: a line above the rows (`strings.entries.historyHint`), which is the list's header so at the largest size it scrolls away rather than holding a share of the screen, and a `›` at the end of every row, drawn and kept from a screen reader that already hears `rowHint`. Checked on Android at the largest font scale: the line wraps, the amount drops under the label, nothing clips
- [X] T156 [US2] Add the progress half of the revision screen's impact preview to `src/features/goal/goal-impact.tsx` — FR-006 asks for the change in progress percentage, and T066 could not honestly show it: the percentage needs a balance and the ledger did not exist, so the preview states the target's change alone. With `summarizeProgress` (T077) it states both, and `tests/component/goal-revision.test.tsx` asserts the percentage against a seeded balance rather than against zero. Numbered out of sequence because every id through T155 is taken and renumbering would invalidate the references tasks make to each other. The preview reads the balance itself through `useBalance`, not through the screen's query: the goal can be revised without it, so an unreadable ledger costs the progress line — which then says the effect could not be worked out — rather than the screen, and never shows a percentage of a balance nobody read. A change that leaves the percentage where it was (an empty fund, or one past both targets) says progress stays at it rather than "de 100% para 100%"
- [X] T084 [US2] Extend Home with balance, remaining, progress percentage, and the goal-reached surplus state in `app/index.tsx` — the balance leads, at display size, and the target steps down to title: the balance is what moves. Reached is said in words as well as colour, and the surplus line is omitted at exactly the target, where it would read "R$ 0,00 além da meta". Adds `useStanding` (goal and balance as one query, so a ledger that cannot be read is Home's error rather than a zero balance) over a new `combineQueries`, which `useStoredGoal` now uses too, and `format.percent`. Also fixes `percentOf`: rounded to nearest, a fund one unit short of a large target read 100% — reached, to the reader and to the 100% milestone. It stays to-nearest, as the spec's 4,17% example requires, but anything short of the target stops at 99,99. Home also gains the way in to the contribute screen
- [X] T157 [US2] Fill Home's coverage meter with the months the balance covers, in `app/index.tsx` — today every unit is filled, because until the ledger existed the meter could only show the plan. With a balance it can show progress: the balance in months of the stored expenses, rounded down through `src/domain/money/rounding.ts` and capped at the plan, with the caption stating both numbers. Split from T084 so that task stayed the figures FR-013 names. Numbered out of sequence for the reason T156 is. Adds `wholeMonthsCovered` to `rounding.ts`, the fifth division, and a third rule beside its two: months still to save round up, months already saved round down, so neither promises what the fund lacks. The cap is `coveredMonths` in `src/domain/ledger/coverage.ts`, because the caption states both numbers and "8 de 6 meses" is unreadable. `useStanding` now reads the goal with the stored expenses (`useStoredGoal`) rather than the goal alone. The meter's test helpers move to `tests/support/coverage-meter.ts`, shared with the primitive's own tests
- [X] T085 [US2] Build the future-dated entry warning surface in `src/features/entries/future-dated-banner.tsx` — on the history, where the ui-contract lists the state, as the list's header above the hint so it scrolls away with the rows at the largest text size. It counts the entries dated after today, says they are left out of the balance until their day arrives, and says where to correct them: the history is the most recent first, so they are always at the top. Nothing while the check runs or when it finds none, so no warning flashes and goes; a check that fails says so in the banner's place, since silence there would read as none, and the history still lists. An entry dated today is not flagged — it counts. Seeded through the repository in the tests, because FR-009 refuses a future date at entry
- [X] T086 [US2] Announce the new balance through a live region after a save in `src/features/entries/hooks.ts` — an announcement (`AccessibilityInfo.announceForAccessibilityWithOptions`) rather than a live region, because every write is followed by the screen leaving and a region unmounted as it changes says nothing. Made in the refresh every ledger write already shares, so recording, correcting, and deleting all announce "Saldo atualizado: R$ …", the figure Home shows — future-dated entries left out. Queued behind current speech on iOS. The entries are read back after the refresh; when that read fails nothing is announced, since the cached balance from before the write is no longer true, and the save still succeeds, since the write landed. Seen on the Android emulator as `TYPE_ANNOUNCEMENT` events carrying the new balance; not yet heard through VoiceOver or TalkBack, which T146 walks
- [X] T087 [US2] Implement the seed script with `--months`, `--pattern steady|erratic`, and `--reset` in `scripts/seed.ts` — as `scripts/seed.mts`, the extension declaring the module system (`tooling.md`); `tsconfig.json` and ESLint now include `.mts`. The app's data lives inside Expo Go on the device, out of a Node script's reach, so the script only opens a link — `exp://…/--/dev/seed?months=8&pattern=steady` — on every booted emulator and simulator, and the development-only route `app/dev/seed.tsx` does the work: erases the store, then saves a balanced goal of R$ 12.000,00 through `submitGoal` and each entry through `recordEntry`, in one transaction, and goes Home. Outside `__DEV__` the route only redirects Home, since every file under `app/` ships. `--months` counts complete months before today, the months the forecast reads, so `--months 2` lands below its threshold; steady saves R$ 500,00 on the 5th, erratic R$ 100,00–1.200,00 in steps of R$ 10,00 on any day, missing about one month in four, from a seeded generator so a run is the same every time. Brings forward the data half of T145: `StoreRepository.eraseAll`, whose integration test reads the table list from the schema so a table a later migration adds cannot survive an erase. The run-once guard on the route's effect is load-bearing — unguarded, one link seeded 2 835 times in 300ms — and is asserted

**Checkpoint**: Stories 1 and 2 both work independently. The core saving loop is complete.

---

## Phase 5: User Story 3 - Monitor progress with statistics (Priority: P3)

**Goal**: The user sees balance growth, totals, averages, streaks, and a month-by-month breakdown, filterable by period, with milestones acknowledged as they are crossed. No charts: balance growth and the breakdown are one list of months (research D-011, amended 2026-10-25).

**Independent Test**: Seed several months of history, open Statistics, and verify every figure against a hand calculation of the same data; then filter to a shorter period and verify everything recalculates.

### Tests for User Story 3

- [X] T088 [P] [US3] Unit tests for statistics aggregates, asserting the opening entry is excluded from contribution count and total contributed, in `tests/unit/domain/statistics/summary.test.ts` — one six-month fund worked by hand, an opening in May, an empty July, a withdrawal, and an entry dated after today, checked under all time and the last three months. Also pins the period rules settled on 2026-10-25 (spec Clarifications): a recent period is complete months only, never earlier than the first entry, and the average divides the complete months' contributions by their number — null, not zero, while there is none
- [X] T089 [P] [US3] Unit tests for current and longest streaks, including the rule that an incomplete current month does not break a streak, in `tests/unit/domain/statistics/streaks.test.ts` — and the streaks inside a period, since they follow the filter: a run that began before the period is cut at its start, and the last month of a recent period is complete, so empty there is a break
- [X] T090 [P] [US3] Unit tests for the per-month breakdown including zero-activity months in `tests/unit/domain/statistics/breakdown.test.ts` — each row also carries the balance at the month's close, carried in from before the period and allowed below zero, which is how FR-019 is met without a chart
- [X] T091 [P] [US3] Unit tests for milestone crossing and re-crossing after a withdrawal or a raised target in `tests/unit/domain/ledger/milestones.test.ts` — including AP-012's fund one centavo short, which shows 99,99% and must not cross 100%
- [X] T092 [P] [US3] Integration tests for `MilestoneRepository` including `clearAbove` in `tests/integration/data/milestone-repository.test.ts` — the ordering test turns on `PRAGMA reverse_unordered_selects`: `threshold` is the table's INTEGER PRIMARY KEY, so it is the rowid, and rows written in reverse still came back sorted with the ORDER BY deleted. Writing them opposed (AP-003) could not catch that; the pragma did
- [X] T093 [P] [US3] Component tests for the statistics screen states and the period filter in `tests/component/statistics.test.tsx` — over the same hand-calculated fund as T088, so every figure on screen is one already worked out. The view is empty while no money has moved: an opening balance alone is where every user leaves setup
- [X] T094 [P] [US3] Accessibility test asserting each month of the breakdown is one accessible element read as a sentence — month, contributed, withdrawn, closing balance — and that the list holds at the largest text size, in `tests/component/statistics-a11y.test.tsx` — reworded 2026-10-25 when charts were dropped; it asserted a chart's text equivalent, and with no chart the list is the content itself. The largest text size is not something a component test can measure, so it was checked on the Android emulator at a font scale of 2.0: every label and amount wraps, the amount dropping under its label, and nothing clips
- [X] T095 [P] [US3] Maestro flow covering the Story 3 journey in `e2e/us3-statistics.yaml` — seeded through the development route as a link (8 steady months, so every figure holds on any run date), the figures under all time and the last three months, then a contribution that lands exactly on 50%: the banner on Home, dismissed, and absent after a restart. Opening the seed link reloads the app inside Expo Go, so its wait is a restart's 60 seconds. Passes on both, alongside every earlier flow

### Implementation for User Story 3

- [X] T096 [P] [US3] Implement the statistics summary aggregates in `src/domain/statistics/summary.ts` — also re-enable the commented-out 95% coverage threshold for `./src/domain/statistics/` in `jest.config.mjs` — `summarize` carries the period, its months, the streaks, and the breakdown too, so a screen cannot pair one period's totals with another's streaks. The period itself is `src/domain/statistics/period.ts`. Statistics have no query key: they are derived through `useLedgerView` from the entries query every ledger reader shares, so a write refreshes them by refreshing the rows, and the unused `queryKeys.statistics` left the registry
- [X] T097 [P] [US3] Implement current and longest streak calculation in `src/domain/statistics/streaks.ts` — both take the period's months as well as the entries, a departure from the domain-ports signatures that the streaks following the filter requires
- [X] T098 [US3] Implement the per-month breakdown in `src/domain/statistics/breakdown.ts`
- [X] T099 [P] [US3] Implement `crossedMilestones` in `src/domain/ledger/milestones.ts` — read from `percentComplete`, the figure Home shows, so the milestone and the screen agree about when the fund reached 25%
- [X] T100 [US3] Implement `MilestoneRepository` in `src/data/sqlite/repositories/milestone-repository.ts` — and delete its placeholder from `src/data/sqlite/repositories/pending.ts`, which fails every call so an unimplemented repository can never be mistaken for an empty fund — acknowledging twice is not a failure, and keeps the first instant. The factory test moves milestones to the group that works, and the store-repository test seeds its row through the repository
- [X] T101 [US3] ~~Implement `ChartFrame` rendering the chart, a text summary, and a screen-reader data table from the same data in `src/ui/components/chart-frame.tsx`~~ — **dropped 2026-10-25**, with charts (research D-011 amendment). Nothing was built; the id stays so references to it still resolve
- [X] T102 [P] [US3] Build the month-by-month list — contributed, withdrawn, and closing balance per month, months with no activity included — in `src/features/statistics/month-breakdown.tsx` — reworded 2026-10-25: it was the balance-over-time chart, and the list now carries both FR-019 and FR-022. Most recent first, as the history is; the month in progress says "Saldo até hoje" rather than claiming a close
- [X] T103 [P] [US3] ~~Build the month-by-month bar chart in `src/features/statistics/month-chart.tsx`~~ — **dropped 2026-10-25**, with charts; T102's list covers what it would have drawn
- [X] T104 [US3] Build the statistics screen with the period filter and a purposeful empty state per card in `app/statistics.tsx` — the filter is `Choice` options that each state the months they cover, since "last 3 months" means complete months and a reader could otherwise look for this week's contribution in it. A figure with nothing behind it says why rather than showing zero; a recent period with no complete month says so in place of the cards. Adds `src/features/statistics/` (`use-statistics.ts`, `period-filter.tsx`, `statistics-cards.tsx`), `useLedgerView` in the entry hooks, and the way in from Home
- [X] T105 [US3] Wire milestone acknowledgement into the entry save path in `src/features/entries/hooks.ts` — the three ledger writes now share one path: read the position, write, record the crossings (`src/domain/ledger/acknowledge-milestones.ts`), refresh, announce. The highest milestone crossed goes into the cache for `src/features/progress/milestone-banner.tsx`, shown on Home and the history until dismissed, and is announced after the balance. Only the write can fail the save: a milestone that cannot be recorded is logged. A raised target forgets the milestones now above the fund in `useSubmitGoal`, as data-model's state transitions ask, or passing 50% again would be filtered out as already said

**Checkpoint**: Stories 1–3 all work independently

---

## Phase 6: User Story 4 - Forecast when the goal will be reached (Priority: P4)

**Goal**: The user sees a projected completion date derived from their trailing pace, the pace it assumes, and what monthly contribution a chosen target date would demand.

**Independent Test**: Seed histories of differing length and consistency and verify the projected date, the stated pace, and the required-monthly figure against hand calculation — including the too-short and zero-pace cases.

### Tests for User Story 4

- [X] T106 [P] [US4] Unit tests for `calculatePace` over complete calendar months only, asserting the in-progress month is excluded, in `tests/unit/domain/forecast/pace.test.ts` — the window starts no earlier than the month of the first entry, through `periodMonths`, so the forecast and the statistics agree about when the fund began; the opening balance's month is history but its amount is not saving
- [X] T107 [P] [US4] Unit tests for `project` covering all four `ForecastState` cases in `tests/unit/domain/forecast/project.test.ts` — a reached fund is `reached` even before three months of history, ahead of the data model's former order (amended there)
- [X] T108 [P] [US4] Unit tests for `requiredMonthly` and the exceeds-pace indication in `tests/unit/domain/forecast/required.test.ts` — the exceeds-pace indication became `desiredContribution`, which also says when the date has passed or the fund needs nothing, and quotes the pace it compares with; `unmeasured` while there is no pace. The required amount rounds up, a fourth rule in `src/domain/money/rounding.ts` (`divideToRequiredAmount`)
- [X] T109 [P] [US4] Component tests rendering the forecast screen in all four states in `tests/component/forecast.test.tsx` — also the recalculation after an entry or a target change (Story 4 scenarios 2 and 6), and the desired-date card in each of its states
- [X] T110 [P] [US4] Maestro flow covering the Story 4 journey in `e2e/us4-forecast.yaml` — seeded through the development route as a link: two months for the insufficient state, six for a projection of 18 months, then a contribution today that moves it to 16 without moving the pace, and a desired date set on the goal screen and read back on the forecast. The zero-pace state needs a withdrawal and waits for Story 5; it is covered by the component suite. Passes on both, alongside every earlier flow

### Implementation for User Story 4

- [X] T111 [US4] Implement `calculatePace` in `src/domain/forecast/pace.ts` — also re-enable the commented-out 95% coverage threshold for `./src/domain/forecast/` in `jest.config.mjs`
- [X] T112 [US4] Implement `project` and the `ForecastState` union in `src/domain/forecast/project.ts` — `projected` also carries `paceMonths`, the window FR-028's assumption names
- [X] T113 [US4] Implement `requiredMonthly` in `src/domain/forecast/required.ts` — `requiredMonthly` refuses a date that is not ahead through `validateDesiredCompletionDate`, the same rule the goal form applies on save
- [X] T114 [US4] Implement forecast hooks invalidating on any ledger or goal change in `src/features/forecast/hooks.ts` — no query key of its own: the forecast is derived from the goal query and the entries every ledger reader shares, so the unused `queryKeys.forecast` left the registry, as `statistics` did in T096. `useSavingPosition` gives the goal screen the same balance and pace
- [X] T115 [US4] Build the forecast screen rendering all four states, always stating the assumed pace alongside the date, in `app/forecast.tsx` — the cards are `src/features/forecast/forecast-cards.tsx`, the desired-date readout `desired-readout.tsx`, shared with the goal screen; Home gains the way in
- [X] T116 [US4] Add the desired completion date setting and its required-contribution readout to `app/settings/goal.tsx` — chosen a month at a time with a stepper (`src/features/goal/desired-date-field.tsx`) and stored as the month's last day, decided with the user on 2026-11-01: the figure counts whole months, and the iOS calendar does not take Maestro's taps after a scroll. Earliest month offered is the next one; a stored date that has passed is refused on save. The readout follows the target being drafted. Fixes a bug the field would have exposed: the goal draft built every goal with no date, so any revision erased one

**Checkpoint**: Stories 1–4 all work independently

---

## Phase 7: User Story 5 - Handle withdrawals and recovery (Priority: P5)

**Goal**: The user records a withdrawal with a reason and sees the reduced balance, the shortfall, and how long recovery will take at their current pace.

**Independent Test**: From a positive balance, record a withdrawal and verify balance, progress, shortfall, and recovery estimate; then attempt to overdraw and verify the warning and confirmation.

### Tests for User Story 5

- [X] T117 [P] [US5] Unit tests for withdrawal validation and the over-balance rule in `tests/unit/domain/ledger/withdrawal.test.ts` — the reason through `validateEntry` (required, not blank, at most 280 characters, refused on any other kind), `assessWithdrawal` at and either side of the balance, and `recordEntry` refusing an unconfirmed overdraw against the balance as of today, future-dated entries left out
- [X] T118 [P] [US5] Unit tests for shortfall and the recovery estimate in `tests/unit/domain/forecast/recovery.test.ts` — also `calculateContributionPace` in `pace.test.ts`. The recovery fixture has four months and a withdrawal inside them, so the contribution pace, the net pace, and a six-month window each give a different answer (AP-002)
- [X] T119 [P] [US5] Component tests for the withdraw screen and the over-balance confirmation in `tests/component/withdraw.test.tsx` — Story 5's first two scenarios, each predefined reason by its key, the user's own words trimmed, the sheet's figures, cancel, and confirm. The reason on the edit screen and the history's label for a key are in `entries.test.tsx`, the reason on `reviseEntry` in `revise-entry.test.ts`
- [X] T120 [P] [US5] Maestro flow covering the Story 5 journey in `e2e/us5-withdrawal.yaml` — seeded with six steady months, a withdrawal of R$ 1.200,00 for Saúde with the shortfall and three months to recover, the row in the history, then R$ 2.000,00 against R$ 1.800,00: warned, cancelled, saved again, and confirmed. History rows are matched as patterns, because on iOS a row is one accessibility element. Passes on both, alongside every earlier flow

### Implementation for User Story 5

- [X] T121 [US5] Implement withdrawal rules and the required reason in `src/domain/ledger/withdrawal.ts` — five predefined reasons stored as keys (`medical`, `car-repair`, `home-repair`, `income-loss`, `family`) or the user's own words, decided with the user on 2026-11-01. The over-balance check is `recordEntry`'s, against the ledger in storage, and its refusal is a new `AppError` kind, `over-balance`, carrying the balance and how far below zero the withdrawal goes, so the question is asked about the balance the withdrawal is actually taken from (domain-ports amended)
- [X] T122 [US5] Implement the shortfall and recovery estimate in `src/domain/forecast/recovery.ts` — decided with the user on 2026-11-01: the shortfall is the drop from the highest end-of-day balance, capped at the target, and the estimate is `project` at the pace of contributions alone (`calculateContributionPace`), since a withdrawal does not slow how fast the fund refills (data-model amended)
- [X] T123 [US5] Build the withdraw screen with predefined and free-text reasons in `app/entries/withdraw.tsx` — the date group moves out of the contribute screen into `src/features/entries/entry-date.tsx`, shared; the reasons are `reason-picker.tsx`, shared with the edit screen, which now corrects a withdrawal's reason too (decided with the user on 2026-11-01). The history shows a predefined reason by its label
- [X] T124 [US5] Build the over-balance warning and explicit confirmation in `src/features/entries/withdraw-confirm.tsx` — through `ConfirmSheet`, stating the balance and how far below zero the withdrawal leaves it. The question is the mutation's `over-balance` error, read off it rather than copied into the draft
- [X] T125 [US5] Surface the shortfall and recovery estimate on Home in `app/index.tsx` — a card under the balance, only while there is something to restore, in the secondary voice rather than the negative one; it states the pace and months behind the date, or why there is none. `useStanding` now reads the entries rather than the balance. Home also gains the way in to the withdraw screen

**Checkpoint**: Stories 1–5 all work independently

---

## Phase 8: User Story 6 - Stay on track with reminders (Priority: P6)

**Goal**: The user opts into a recurring local reminder to contribute, and can change or switch it off at any time.

**Independent Test**: Enable a reminder, verify the permission flow including denial, confirm delivery at the scheduled time, then disable and confirm nothing further arrives.

### Tests for User Story 6

- [X] T126 [P] [US6] Unit tests for reminder schedule validation, including the day-of-month cap at 28, in `tests/unit/domain/reminders/schedule.test.ts` — also the time steppers' arithmetic, and `saveReminder` in `save-reminder.test.ts`: the order of the store and device writes, chosen so a failure never leaves the screen saying "on" with nothing scheduled, or "off" with a reminder still arriving
- [X] T127 [P] [US6] Integration tests for `ReminderRepository` in `tests/integration/data/reminder-repository.test.ts` — no row reads as the default without writing it; the factory's placeholder test became a binding test
- [X] T128 [P] [US6] Component tests for the reminders settings screen including the permission-denied state in `tests/component/reminders.test.tsx` — the permission is asked when the reminder is saved on, not when the switch is turned; the adapter's tests are `notifier.test.tsx`, in the component project because `expo-notifications` cannot load in plain Node, and the new primitives' are `controls.test.tsx`
- [X] T129 [P] [US6] Maestro flow covering the Story 6 journey in `e2e/us6-reminders.yaml` — the three scenarios, allowed ones first and the refusal last, around Expo Go's own per-app permission layer (research.md, D-013 amendment). Delivery at the scheduled time is not asserted; it is T134's. Passes on both, alongside every earlier flow

### Implementation for User Story 6

- [X] T130 [US6] Implement the reminder schedule model in `src/domain/reminders/schedule.ts` — the default the form starts on is monthly on the 5th at 09:00, decided with the user on 2026-11-07; saving and scheduling together is `save-reminder.ts`. A new `AppError` kind, `device`, for the OS failing to do what was asked (domain-ports amended)
- [X] T131 [US6] Implement `ReminderRepository` in `src/data/sqlite/repositories/reminder-repository.ts` — and delete its placeholder from `src/data/sqlite/repositories/pending.ts`, which fails every call so an unimplemented repository can never be mistaken for an empty fund. `pending.ts` is gone, it being the last
- [X] T132 [US6] Implement the `Notifier` adapter over `expo-notifications`, scheduling local notifications only, in `src/platform/notifications/notifier.ts` — no exact-alarm permission, so Android's alarm is inexact (T134 measured how inexact); an Android channel only outside Expo Go, which refuses them (measured). A failed save is logged with the platform's message
- [X] T133 [US6] Build the reminders settings screen with the permission request and denial explanation in `app/settings/reminders.tsx` — the time is chosen with hour and minute steppers (15-minute steps) and the day from a grid of 1 to 28 or seven weekday chips; a refusal offers to open the system settings. All three decided with the user on 2026-11-07. New primitives `Toggle`, `Chip`, and `Stepper`; Home gains the way in
- [X] T134 [US6] Resolve R-003 — verify scheduling behavior after device restart and force-quit and confirm Android exact-alarm requirements, recording findings in `specs/001-emergency-fund-tracker/research.md` — measured in release builds on an Android emulator, an Android phone (Galaxy S23 Ultra, Android 17), and an iOS simulator: delivered in the background, after a swipe out of recents or a termination, after a force-stop once the app is reopened (Android), and after a reboot (Android once unlocked; a reminder due before the first unlock is skipped to the next month). No exact-alarm permission: Android's window is up to an hour; iOS comes on the minute. The iOS build needed `expo` 57.0.32 and `@expo/ui` 57.0.26, and CocoaPods

**Checkpoint**: All six user stories are independently functional

---

## Phase 9: Data Portability (Cross-Cutting) — dropped

**Purpose**: Was export and import — FR-044 through FR-047 and SC-015. **Dropped 2026-11-08**: storing the fund in a Supabase database, a change still to be specified, is to take over storage and data portability, so a file-based export and import would be built only to be replaced. Nothing was built; the ids stay so references to them still resolve. The erase flow, T145, serves FR-048 rather than portability and moved to Improvements, now [`specs/backlog.md`](../backlog.md)

### Tests

- [X] T135 [P] ~~Unit tests for the export document builder in `tests/unit/domain/transfer/export.test.ts`~~ — **dropped 2026-11-08**, with Phase 9; nothing was built, and the id stays so references to it still resolve
- [X] T136 [P] ~~Unit tests for the import schema covering every rejection case in contracts/fund-export-v1.md in `tests/unit/domain/transfer/import-schema.test.ts`~~ — **dropped 2026-11-08**, with Phase 9
- [X] T137 [P] ~~Unit tests for merge deduplication and replace semantics in `tests/unit/domain/transfer/merge.test.ts`~~ — **dropped 2026-11-08**, with Phase 9
- [X] T138 [P] ~~Integration test asserting an export imported into a fresh database reproduces the goal, every entry, the balance, and every statistic (SC-015) in `tests/integration/data/round-trip.test.ts`~~ — **dropped 2026-11-08**, with Phase 9
- [X] T139 [P] ~~Integration test asserting a failed import leaves the database exactly as it was in `tests/integration/data/import-atomicity.test.ts`~~ — **dropped 2026-11-08**, with Phase 9

### Implementation

- [X] T140 ~~Implement the export document builder in `src/domain/transfer/export.ts`~~ — **dropped 2026-11-08**, with Phase 9
- [X] T141 ~~Implement the `zod` import schema and the cross-field rules in `src/domain/transfer/import-schema.ts`~~ — **dropped 2026-11-08**, with Phase 9
- [X] T142 ~~Implement merge and replace application inside a single `UnitOfWork` transaction in `src/domain/transfer/apply-import.ts`~~ — **dropped 2026-11-08**, with Phase 9
- [X] T143 ~~Implement the `FileGateway` adapter over `expo-file-system`, `expo-sharing`, and `expo-document-picker` in `src/platform/files/file-gateway.ts`~~ — **dropped 2026-11-08**, with Phase 9
- [X] T144 ~~Build the data settings screen with export, import, and the replace-or-merge choice stating what each will do, in `app/settings/data.tsx`~~ — **dropped 2026-11-08**, with Phase 9

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: The verification the success criteria demand, and the checks that only make sense once everything exists

- [ ] T146 [P] Walk all eleven screens with VoiceOver and TalkBack and fix every finding, in the affected files under `app/` and `src/features/`. Since feature 002 (T191), the walk also covers the navigation menu and its button: the button's name and its open or closed state on Home, History, Statistics, and Forecast; the menu's heading and its six items, the current section announced as selected; nothing behind the open menu reachable; and Home's new shape — the fund and both actions first, no buttons to other sections. Where focus lands when the menu opens and closes is T194's measurement (`specs/backlog.md`), which this walk need not repeat
- [X] T147 [P] Add maximum text-scale component tests for every screen in `tests/component/text-scale.test.tsx` — one test per screen, twelve, reading the rendered host tree: no text opts out of the platform's size, is capped, shrinks to fit, or is cut to a number of lines; none sits in a box of fixed height or width; and everything but the screen's title row sits inside something that scrolls. Jest lays nothing out, so these are the conditions under which text can grow, not a picture of it grown. It found the stepper's signs (48 × 48) and History's entry marks (32 × 32) in fixed boxes, now minimum sizes as `Chip` already was. A look on the iPhone 15 simulator at the largest size then found what the tree cannot show: Reminders' minute stepper ran off the screen beside the hour, and now wraps under it (a test in `reminders.test.tsx`). Every check was proved by a mutation — an opt-out, a cap, shrink-to-fit, a line limit, a fixed box, and a screen that does not scroll — each failing the screens it touched and naming the text
- [ ] T148 [P] Verify SC-014 by exercising every screen with a proxy attached and confirming zero outbound requests, recording the result in `specs/001-emergency-fund-tracker/quickstart.md`
- [ ] T149 [P] Verify FR-040 by running every scenario in `specs/001-emergency-fund-tracker/quickstart.md` with the device in airplane mode
- [ ] T150 Verify SC-012 — cold launch under 2 seconds and 60fps history scrolling on a 3-year-old mid-range Android with a ten-year seeded history from `scripts/seed.ts`
- [ ] T151 Resolve R-002 — verify `Intl` currency and date formatting in an Android release build, recording the outcome in `specs/001-emergency-fund-tracker/research.md`
- [ ] T152 Run the full validation suite in `specs/001-emergency-fund-tracker/quickstart.md` on a physical iOS device and a physical Android device
- [ ] T153 Verify coverage thresholds in `jest.config.mjs` are met and no `skip`, `only`, or `todo` marker remains in any file under `tests/`
- [ ] T154 [P] Write `README.md` documenting asdf setup, the command reference, and the architecture boundary rule
- [ ] T155 Final compliance review against all six principles in `.specify/memory/constitution.md` before release

---

## Improvements

Moved to [`specs/backlog.md`](../backlog.md) on 2026-11-08 — T145, T159, T160, and T193 — so work that no story depends on is kept in one place across features, rather than at the end of whichever feature raised it.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup. **Blocks every user story.**
- **User Stories (Phases 3–8)**: All depend on Foundational. Then either sequentially by priority, or in parallel with enough people.
- **Data Portability (Phase 9)**: Dropped 2026-11-08 — storage and portability move to Supabase
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
8. + Phase 10 → release-ready

A reasonable public release is US1–US3, with data surviving a reinstall once the move to Supabase lands — Phase 9 was to provide that by export and import, and was dropped for it. US4 and US5 are what make it a considered product rather than a ledger; US5 in particular should not be deferred indefinitely, because a user who withdraws before it exists will see a wrong balance.

### Parallel Team Strategy

Phases 1 and 2 are hard to parallelize across people — they are foundations with tight interdependencies, and one person should own them for coherence. After that, six stories can proceed independently.

---

## Notes

- **[P]** means a different file with no dependency on incomplete work
- **[Story]** labels map tasks to spec.md stories for traceability
- Every test must be observed failing for the intended reason before its implementation is written — a test that passes on first run is not evidence of anything
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently
- Coverage floors are enforced by the Jest config, not by discipline: 80% global, 95% on money, dates, statistics, and forecast
- Three research items resolve inside these tasks: R-001 at T015, R-003 at T134, R-002 at T151
