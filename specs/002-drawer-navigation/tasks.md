---

description: "Task list for Drawer Navigation implementation"
---

# Tasks: Drawer Navigation

**Input**: Design documents from `/specs/002-drawer-navigation/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/navigation-ui.md](./contracts/navigation-ui.md), [quickstart.md](./quickstart.md)

**Tests**: Mandatory, as in 001. Constitution Principle IV is non-negotiable: every test task is written and observed failing for the intended reason before the task that implements it, and every new assertion is proved by breaking the code it covers (`.claude/rules/testing.md`). Under the commit rule in `.claude/rules/workflow.md`, a story's test and implementation tasks land in one commit.

**Numbering**: Ids continue from 001, whose tasks end at T160, so a commit scope such as `feat(T170)` names one task in the whole history. Ids are never reused.

**Organization**: Tasks are grouped by user story so each story can be implemented, tested, and shipped independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel — different files, no dependency on an incomplete task
- **[Story]**: Which user story the task serves (US1, US2). Setup, Foundational, and Polish carry no story label
- Every task names an exact file path

## Path Conventions

The structure in [plan.md](./plan.md): `app/` for routes, with the new `app/(drawer)/` group; `src/features/navigation/` for the menu; `src/ui/` for the `Screen` slot and strings; `tests/` mirroring `src/`; `e2e/` for Maestro.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: The packages the drawer needs, declared; and a test environment that can load it

- [X] T161 Declare the drawer's three native packages with `npx expo install react-native-gesture-handler react-native-reanimated react-native-worklets`, in `package.json` and `package-lock.json` — research D-002. Confirm with `npm ls` that each is now a direct dependency at the version SDK 57 pins, and that `npm run verify` stays green with no Babel change — SDK 57 pins gesture handler ~2.32.0, reanimated 4.5.1, and worklets 0.10.1, not the 3.2.1, 4.5.3, and 0.10.4 that had been resolved underneath (research D-002 amendment); one copy of each now, and the gate is green
- [X] T162 Add the gesture and animation mocks for the component Jest project in `tests/support/native-animation-mocks.cjs`, registered in the component project's `setupFiles` in `jest.config.mjs` — `require('react-native-gesture-handler/jestSetup')`, then `jest.mock` of `react-native-worklets` with `react-native-worklets/lib/module/mock` and of `react-native-reanimated` with `react-native-reanimated/mock` (research D-007). `.cjs` because Jest loads setup files as CommonJS (`.claude/rules/tooling.md`). Prove it is needed: with the file unregistered, a test importing `expo-router/drawer` fails with `reading 'loadUnpackers'`, as measured during planning — re-measured after T161's versions with a probe rendering a drawer: passes registered, fails unregistered with that error. ESLint gained a block for `.cjs` files, where `require` is the declared module system, and the `jest` global for `tests/support/*.cjs`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The destination list, its strings, and the `Screen` slot — what both stories build on. Nothing user-visible changes yet

### Tests

- [X] T163 [P] Unit tests for the destination list in `tests/unit/features/navigation/destinations.test.ts` — the six keys in data-model.md's order; each label is the `strings.navigation.destinations` entry for its key; `goal` and `reminders` are `over`, the rest `section`; each href is the path the app already uses. Fails until T165 and T166 land. Whether each href has its route file in the right group is checked by T169, once T175 has moved the files — here it would stay red through this phase, and the pre-commit gate refuses a red suite. Also pins FR-001's wording: each label equals its screen's title, and Goal's is the noun inside "Ajustar meta". Six mutations — order, a label, a presentation, an href, and two string drifts — each failed exactly its own test
- [X] T164 [P] Component tests for `Screen`'s `leading` slot in `tests/component/primitives.test.tsx` — given an element, it renders on the title's row and before the title in the tree; given none, the title row holds the title alone. Assert what renders, not the prop (`.claude/rules/testing.md`) — order read from the row's host children, the title found by its heading role rather than a test-only prop on `Screen` (AP-008). Also: a leading element with no title, no row with neither, and the row scrolling with the content. Mutations — leading after the title, the row drawn when empty, the row requiring a title, the row pinned outside the scroll view — each caught

### Implementation

- [X] T165 Add `strings.navigation` — `open` ("Abrir menu"), `menuLabel` ("Navegação"), and `destinations` for the six keys with the labels in data-model.md — in `src/ui/strings/strings.ts`, with the JSDoc every export there carries
- [X] T166 Implement the destination list and its `Destination` type in `src/features/navigation/destinations.ts` — readonly, in menu order, `href` typed as the router's own `Href` from `expo-router` rather than a string (`.claude/rules/types.md`); `DestinationKey` is derived from `strings.navigation.destinations`, so a destination cannot exist without its name
- [X] T167 Add the optional `leading?: ReactNode` prop to `Screen` in `src/ui/primitives/screen.tsx`, drawn before the title on the title's row with token spacing; `Screen` imports nothing from navigation (CLAUDE.md layer table) — the row is drawn only when there is a title or a leading element, inside the scrolling content as the title always was, and exported as `SCREEN_TITLE_ROW_TEST_ID`. The title sits in a shrinking wrapper so it wraps beside the button, because `Text` deliberately takes no style of a caller's own

**Checkpoint**: The list, its strings, and the slot exist and are tested; the app looks exactly as it did

---

## Phase 3: User Story 1 - Find any section from a menu, with Home showing the fund (Priority: P1) 🎯 MVP

**Goal**: Home shows the fund and its two actions without scrolling; a menu, opened from a button on Home, reaches every section

**Independent Test**: Seed a fund with a recovery in progress and a milestone showing, open Home on a 6.1-inch-class phone, and see the balance and both actions without scrolling; open the menu and reach each of the six destinations from it (quickstart rows 1, 2, 6, 7, 8)

### Tests for User Story 1 ⚠️

> Write these first and watch each fail for the intended reason

- [X] T168 [P] [US1] Component tests for the menu in `tests/component/navigation-menu.test.tsx` — `NavigationMenu` lists six items in order, each by its label with the `menu-item-<key>` id; the item for the focused route has `accessibilityState.selected` and the leading bar, and no other does — with the focused route set to `statistics` in the fixture, since `home` is what a menu ignoring its state would mark (AP-002); choosing a `section` navigates to it and closes the menu; choosing the current one closes the menu and navigates nowhere; choosing `goal` closes the menu and pushes `/settings/goal`; a label longer than the drawer's width renders whole, with no line limit on its host `Text`. `MenuButton` has role `button`, the name `strings.navigation.open`, `expanded` false while closed and true while open, and opens the menu when pressed — rendered inside the real drawer layout over stand-in sections. Open and closed are read from the button's `expanded` state: the drawer's hiding from screen readers runs on animated props, which reanimated's Jest mock never applies, so it is left to T180 (research D-005 amendment)
- [X] T169 [P] [US1] Route tests in `tests/component/navigation-routes.test.tsx` — reading `app/` from disk as `tests/component/routes.test.tsx` does, every `section` destination has a route file under `app/(drawer)/` and every `over` destination one outside it (moved here from T163, which runs before the files move); and, using `renderRouter` from `expo-router/testing-library` with the real `app/(drawer)/_layout.tsx` and stand-in screens — every destination's href and `/entries/contribute`, `/entries/withdraw`, `/entries/<id>`, and `/onboarding/expenses` render the right screen at an unchanged pathname; back after choosing two sections from Home returns to `/`; contribute pushed from Home returns to Home. Keep `renderRouter`'s returned value, `await` it, and call `getPathname` on the kept value — awaiting it directly loses the helpers under RNTL v14 (research D-007). Prove the back test with `backBehavior: 'history'`, which planning measured as failing with `/statistics` — the pathname helpers read from the kept `renderRouter` value (AP-018)
- [X] T170 [P] [US1] Update Home's tests in `tests/component/home.test.tsx` — `contribute`, `withdraw`, and `menu-button` are present; `history`, `statistics`, `forecast`, `reminders`, and `revise-goal` are absent; the goal card still shows the target and coverage. Update `tests/component/routes.test.tsx` for the route files now under `app/(drawer)/`, so its first assertion looks for `(drawer)/index.tsx` — Home's buttons are counted rather than looked up by id, so a button added back under any name fails; the menu button is asserted in the error state too, since the other sections do not depend on Home's data. `tests/unit/app/router-root.test.ts` now looks for Home's file inside the group
- [X] T171 [P] [US1] Write the Maestro flow `e2e/navigation-menu.yaml` and add it by name to `e2e/config.yaml`, which otherwise runs only `smoke.yaml` and `us*.yaml` — seed, open the menu from Home, check the six labels and that Sua reserva is marked, reach each section and come back, and close the menu by tapping outside and by back. Write `e2e/go-to-section.yaml` beside it, a subflow taking an item id that opens the menu, taps the item, and waits for it to close — run with T178. Its first version returned Home through the menu from History, which has no menu button until Story 2; Story 1's way back is back itself, so a `back-home.yaml` subflow does that: Android's back button, and on iOS a stop and relaunch, since reopening the link into a running Expo Go keeps the screen it is on

### Implementation for User Story 1

- [X] T172 [P] [US1] Implement `MenuItem` in `src/features/navigation/menu-item.tsx` — `Pressable` with the interaction tokens `Button` uses, `Text` with no line limit, the selected bar as a token-sized `View` in the accent, `minimumTouchTarget` from `src/ui/tokens/spacing.ts`
- [X] T173 [P] [US1] Implement `MenuButton` in `src/features/navigation/menu-button.tsx` — three bars as `View`s in `color.text.primary` at token sizes, the name and `expanded` state from the contract, opening the menu by dispatching the drawer's open action; `expanded` read from `useDrawerStatus()`, not held in local state (data-model.md)
- [X] T174 [US1] Implement `NavigationMenu` in `src/features/navigation/navigation-menu.tsx` — the drawer content: the destinations in order inside a scrolling container, the current one from the drawer state it receives (research D-005), `section` items navigating and `over` items pushing, each closing the menu first; `navigation-menu` test id and `strings.navigation.menuLabel` as its accessible name — current from the pathname, every destination navigated to by href (research D-005 amendment); a visible "Navegação" heading rather than an unannounced container label
- [X] T175 [US1] Move Home, History, Statistics, and Forecast into the drawer group with `git mv` — `app/index.tsx` to `app/(drawer)/index.tsx`, `app/entries/index.tsx` to `app/(drawer)/entries/index.tsx`, `app/statistics.tsx` to `app/(drawer)/statistics.tsx`, `app/forecast.tsx` to `app/(drawer)/forecast.tsx` — and create `app/(drawer)/_layout.tsx` with `drawerContent` set to `NavigationMenu`, `drawerType: 'front'`, `backBehavior: 'firstRoute'`, `headerShown: false`, `overlayColor: color.scrim`, and `drawerStyle` from tokens (research D-003, D-006). Write `_layout.tsx` before moving files that would be orphaned without it (`.claude/rules/tooling.md`, on Fast Refresh). No `router.push` path changes; search `app/` and `src/` to confirm
- [X] T176 [US1] Reshape Home in `app/(drawer)/index.tsx` — remove `Destinations` and the reminders button, remove the revise button from `GoalCard`, and pass `MenuButton` as `Screen`'s `leading`. Update the comments that describe the order of Home's contents, so none still names a button that is gone (AP-009)
- [X] T177 [US1] Delete the strings Home no longer reads — `strings.home.historyAction`, `remindersAction`, `reviseAction`, `strings.statistics.action`, `strings.forecast.action` — from `src/ui/strings/strings.ts`, each only after a search of `app/`, `src/`, and `tests/` shows no other reader (contract, Strings) — no reader remained for any of the five
- [X] T178 [US1] Route the seven flows that used a removed Home button through `e2e/go-to-section.yaml` — `e2e/open-reminders.yaml`, `e2e/us1-revise-target.yaml`, `e2e/us2-record-progress.yaml`, `e2e/us3-statistics.yaml`, `e2e/us4-forecast.yaml`, `e2e/us5-withdrawal.yaml`, `e2e/us6-reminders.yaml` — replacing each `scrollUntilVisible` and `tapOn` of `history`, `statistics`, `forecast`, `reminders`, or `revise-goal`. Run the full suite with `npm run e2e` and `npm run e2e:ios` — eight taps in seven files became the subflow, and `us6-reminders.yaml`'s two waits for Home's old reminders button now wait for the menu button. The first device run failed at boot with "Mismatch between JavaScript code version and Worklets Babel plugin version (0.10.1 vs. 0.10.4)": Metro had been started before T161 and was serving transforms from the old worklets plugin; `npx expo start --clear` fixed it. Then 9/9 flows on the Android emulator (13m 42s) and 9/9 on the iPhone 15 simulator (7m 11s), on 2026-11-08
- [X] T179 [US1] Resolve R-002 — measure Home in its fullest state (a milestone message and the recovery card both showing, seeded per quickstart.md) on a 6.1-inch-class iPhone simulator and an Android emulator of the same class at the default text size, and record whether balance, progress, contribute, and withdraw are on screen without scrolling, with screenshots described, in `specs/002-drawer-navigation/research.md`. If they are not, SC-001 stands: compact Home's cards in `app/(drawer)/index.tsx` until they are, and say what gave — it did not fit: on the iPhone 15, Withdraw was below the fold with the milestone message and recovery card both showing (the Pixel 9 fitted, barely). With the user: both actions moved directly under the balance card, ahead of the recovery card, and the milestone message's full-width "Fechar" became a 48-point close control beside its heading, in `src/features/progress/milestone-banner.tsx`. Measured again, Withdraw sits about 200 pt above the fold on the iPhone. Tests first: the order of Home's cards and actions, and the close control on the heading's row at touch-target size; mutations moving the card back, widening the control, and moving it below the text each failed their own test
- [ ] T180 [US1] Resolve R-001 — with VoiceOver on the iOS simulator and TalkBack on the Android emulator, open the menu from `menu-button` and record where focus lands; close it and record where focus returns, in `specs/002-drawer-navigation/research.md`. Only if a platform does not move focus into the menu or back to the button, add it in `src/features/navigation/menu-button.tsx` — `AccessibilityInfo.setAccessibilityFocus` on the button when `useDrawerStatus()` turns to `'closed'` is the first candidate — and measure again (AP-005, AP-006)
- [X] T181 [US1] Resolve R-004 — on the Android emulator with gesture navigation, swipe in from the left edge on Home and record whether the menu opens or the system back gesture wins, in `specs/002-drawer-navigation/research.md`. The button is the required way in; change `swipeEdgeWidth` in `app/(drawer)/_layout.tsx` only if the measurement shows the swipe opening the menu by accident — from about 1 dp in, nothing; from about 15 dp, the system back gesture, which on Home sends Expo Go to the background; from about 27 dp, the menu opens. It never opened by accident, so `swipeEdgeWidth` is unchanged (research, R-004)

**Checkpoint**: Home no longer scrolls for its essentials, and every section is two taps away from it. Shippable on its own: History, Statistics, and Forecast have no menu button yet, and back from them returns Home

---

## Phase 4: User Story 2 - Move between sections without returning to Home (Priority: P2)

**Goal**: The menu button is on every section that shows the menu, the menu marks where the user is, and Goal and Reminders open over whichever section the user was on

**Independent Test**: From History, Statistics, and Forecast in turn, open the menu, see that section marked, and reach another directly; from Statistics, open Goal and go back to Statistics (quickstart rows 3, 4, 5)

### Tests for User Story 2 ⚠️

- [ ] T182 [P] [US2] Component tests for the button on the three sections — `menu-button` present on History in `tests/component/entries.test.tsx`, on Statistics in `tests/component/statistics.test.tsx`, and on Forecast in `tests/component/forecast.test.tsx`, in each screen's ready state and its error state (spec, Edge Cases: the menu does not depend on the screen's data)
- [ ] T183 [P] [US2] Route tests in `tests/component/navigation-routes.test.tsx` — from `/statistics`, choosing Forecast and then going back lands on `/`; from `/statistics`, pushing `/settings/goal` and going back lands on `/statistics`; from `/forecast`, the forecast's own push of `/settings/goal` and back lands on `/forecast` (FR-012). The fixture starts somewhere other than Home, so a layout that always returns Home cannot pass the second and third (AP-002)
- [ ] T184 [P] [US2] Extend `e2e/navigation-menu.yaml` with Story 2's journey — from Statistics open the menu, check Estatísticas is marked, go to Previsão, go back to Home; from Estatísticas open Meta, check there is no `menu-button`, go back to Estatísticas

### Implementation for User Story 2

- [ ] T185 [P] [US2] Pass `MenuButton` as `Screen`'s `leading` on History in `app/(drawer)/entries/index.tsx`
- [ ] T186 [P] [US2] Pass `MenuButton` as `Screen`'s `leading` on Statistics in `app/(drawer)/statistics.tsx`
- [ ] T187 [P] [US2] Pass `MenuButton` as `Screen`'s `leading` on Forecast in `app/(drawer)/forecast.tsx`
- [ ] T188 [US2] Run `e2e/navigation-menu.yaml` on an Android emulator and an iOS simulator, and fix what either finds before calling the story done (`.claude/rules/workflow.md`)

**Checkpoint**: The menu is the app's navigation, not Home's

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: What only makes sense once both stories exist

- [ ] T189 Resolve R-003 — build release builds with `npx expo run:android --variant release` and `npx expo run:ios --configuration Release`, open and close the menu on each, and record the result in `specs/002-drawer-navigation/research.md`. Put back the `ios` and `android` scripts in `package.json` that prebuild rewrites before reviewing the diff (`.claude/rules/tooling.md`)
- [ ] T190 [P] Walk every by-hand row of `specs/002-drawer-navigation/quickstart.md` on both platforms, including the largest text size (row 10) and an iPad simulator and a phone in landscape (row 11), and fix what fails
- [ ] T191 [P] Extend 001's accessibility walk to the menu — add the menu, its button, and Home's new shape to T146's description in `specs/001-emergency-fund-tracker/tasks.md`, rather than duplicating the walk here (plan, Effect on 001's documents)
- [ ] T192 Run the full Maestro suite on both platforms one last time, then `npm run e2e:clean` and remove any comparison screenshots, per `.claude/rules/workflow.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies. T162 needs T161's packages declared, though they are already on disk
- **Foundational (Phase 2)**: Depends on Setup. Blocks both stories
- **User Story 1 (Phase 3)**: Depends on Foundational
- **User Story 2 (Phase 4)**: Depends on Foundational, and on US1's `MenuButton` (T173), drawer layout (T175), and route test file (T169). It cannot be built before US1: without US1 there is no menu to open
- **Polish (Phase 5)**: Depends on both stories

### Within Each Story

- Tests are written and observed failing before the implementation they cover
- In US1: `MenuItem` and `MenuButton` before `NavigationMenu`; `NavigationMenu` before the drawer layout that renders it; the layout before Home is reshaped; Home before the flows are rerouted; the measurements (T179–T181) last, against the finished screen
- In US2: the three screens are independent of each other

### Parallel Opportunities

- Foundational: T163 and T164 together
- US1 tests: T168, T169, T170, and T171 together — four files
- US1 implementation: T172 and T173 together
- US2: T182, T183, and T184 together; then T185, T186, and T187 together
- Polish: T190 and T191 together

---

## Parallel Example: User Story 1

```bash
# The tests, together — they fail, which is the point:
Task: "Component tests for the menu in tests/component/navigation-menu.test.tsx"
Task: "Route tests in tests/component/navigation-routes.test.tsx"
Task: "Update Home's tests in tests/component/home.test.tsx"
Task: "Maestro flow e2e/navigation-menu.yaml and subflow e2e/go-to-section.yaml"

# Then the two leaf components:
Task: "Implement MenuItem in src/features/navigation/menu-item.tsx"
Task: "Implement MenuButton in src/features/navigation/menu-button.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1: Setup — two tasks
2. Phase 2: Foundational
3. Phase 3: User Story 1
4. **Stop and validate**: quickstart rows 1, 2, 6, 7, 8, and the full Maestro suite on both platforms — the seven rerouted flows are the regression check for every story in 001
5. The reported problem is solved: Home no longer scrolls for its essentials

### Incremental Delivery

1. Setup + Foundational → nothing visible changes
2. + US1 → **MVP**: Home is the fund; the menu reaches everything
3. + US2 → the menu works from every section
4. + Polish → release builds and the full quickstart

### Commits

Following `.claude/rules/workflow.md`: Setup as `chore(T161,T162)`; Foundational as `feat(T163-T167)`; US1 as `feat(T168-T181)` — or split at the measurements, `feat(T168-T178)` then `docs(T179-T181)` if they change no code; US2 as `feat(T182-T188)`. Each is presented for review before it is committed, with each task's checkbox moving in the same commit.

---

## Notes

- **[P]** means a different file with no dependency on incomplete work
- Every test is observed failing for the intended reason before its implementation is written
- The four open research items resolve inside these tasks: R-001 at T180, R-002 at T179, R-003 at T189, R-004 at T181
- No task touches `src/domain/`, `src/data/`, or `src/platform/` — a diff that does has left this feature's scope
