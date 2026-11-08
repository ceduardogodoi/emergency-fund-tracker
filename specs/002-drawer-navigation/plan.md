# Implementation Plan: Drawer Navigation

**Branch**: `main` *(no branch hook configured; work tracked by feature directory)* | **Date**: 2026-11-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-drawer-navigation/spec.md`

## Summary

Home has accumulated a button for every section, seven in all, and most of them sit below the fold. This feature moves the four that only lead elsewhere (and the goal card's revise button) into a slide-in menu, leaving Home with the fund and its two actions.

The menu is Expo Router's own drawer, which SDK 57 bundles: it already hides the screen behind it from screen readers, closes on back, and returns to Home on back. The routes regroup without changing a single URL — Home, History, Statistics, and Forecast move into a `(drawer)` group, and every form, Goal and Reminders included, stays in the root stack and opens over whatever is showing. That layout, and the back behaviour the spec asks for, were measured in a throwaway router test before being planned on (research D-003). The menu's items and its button are this app's own, because the built-in ones truncate labels and announce themselves in English (D-004).

Nothing in the domain, the database, or the data layer changes.

## Technical Context

**Language/Version**: TypeScript 5.9.3, strict, as 001

**Primary Dependencies**: Expo SDK 57 (`expo` 57.0.32), Expo Router 57.0.13 with its bundled drawer (`expo-router/drawer`, on `react-native-drawer-layout` 4.2.10). Newly declared, at the versions `npx expo install` pins for SDK 57: `react-native-gesture-handler`, `react-native-reanimated`, `react-native-worklets` — present today only as transitive packages (research D-002)

**Storage**: N/A — no stored data changes (data-model.md)

**Testing**: Jest component project with three new `setupFiles` entries for the animation and gesture mocks (D-007); `expo-router/testing-library` for route tests; Maestro on Android and iOS

**Target Platform**: iOS and Android phones, as 001; tablets render the phone layout (D-006)

**Project Type**: Mobile application, single codebase

**Performance Goals**: Visible feedback within 100ms of opening the menu or choosing an item (001 FR-052); the menu animates without dropped frames on the 001 SC-012 reference device

**Constraints**: Offline only, nothing leaves the device (001 FR-040, FR-041) — the three packages are on-device animation and gesture libraries with no network surface; WCAG 2.1 AA; pt-BR only; style values from tokens only

**Scale/Scope**: Six destinations, four drawer screens, one menu. Seven Maestro flows change how they reach a section; one new flow

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

Constitution version: **1.0.1**.

| Principle | Gate | Status |
|-----------|------|--------|
| I. Code Quality Gates | No change to the gate. The new Jest mocks run in every local and CI run alike, through `jest.config.mjs` | **PASS** |
| II. Clean Code | Three small components and one constant list; no function near the complexity limits | **PASS** |
| III. SOLID Design | The domain is untouched. `Screen` gains a slot and stays ignorant of navigation; navigation lives in `src/features/navigation` and `app/`, which may import it, per the layer table | **PASS** |
| IV. Test-First | Every new behaviour has a test written first: the destination list against the route files, the menu's items and current marking, the button's state, Home's removed buttons, and back behaviour through `renderRouter`. The back test's ability to fail was already shown during research (D-003) | **PASS** (planned) |
| V. Consistent Code Patterns | One way to reach a section: the menu, plus the contextual links the spec keeps (FR-012). One navigator per role — the root stack for forms and steps, the drawer for sections | **PASS** |
| VI. UI & UX Consistency | Labels, colours, spacing, and the scrim from tokens and the strings module; the built-in drawer items are rejected precisely because they are not (D-004). WCAG obligations listed per requirement in the contract. Responsive check: phone and tablet (D-006); desktop does not apply, as 001 ships no desktop client | **PASS** |

**Quality Standards check**: No money, dates, or stored data are touched. Each new dependency is justified below. No secrets, no network.

### Dependency justifications

| Dependency | What it replaces | Why the simpler option was rejected |
|------------|------------------|-------------------------------------|
| `react-native-gesture-handler` | Relying on the copy `expo-router` brings as an optional peer | The drawer needs it (Expo docs); an undeclared package is present only by npm's hoisting and can vanish on any install |
| `react-native-reanimated` | Same | Same; it drives the drawer's animation on Android and iOS |
| `react-native-worklets` | Same, via `@expo/ui` and `expo-modules-core` | Same; reanimated 4 runs on it |

Deliberately **not** added: `@react-navigation/drawer` (Expo Router vendors it, D-001) and any icon package — the menu button's glyph is three bars drawn as views at token sizes (contract: navigation-ui.md), which square-cornered slabs already are everywhere else in this app.

### Post-Phase 1 re-check

Re-evaluated after research.md, data-model.md, the contract, and quickstart.md. All six gates still **PASS**. The design added nothing beyond the three packages above. One decision moved during planning: Goal and Reminders were to be drawer sections, and became stack screens opening over the current one after the user chose so on 2026-11-08, because a drawer keeps a visited form mounted and an abandoned draft would have come back (spec, Clarifications; research D-003). The spec was amended to match before anything here was written against it.

## Project Structure

### Documentation (this feature)

```text
specs/002-drawer-navigation/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 — 7 decisions, 4 open items for device measurement
├── data-model.md        # Phase 1 — the destination list; no stored data
├── quickstart.md        # Phase 1 — automated and by-hand validation
├── contracts/
│   └── navigation-ui.md # Components, test ids, accessibility, strings, Home
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
app/
├── _layout.tsx                    # root Stack — unchanged role
├── (drawer)/                      # NEW group: screens that show the menu
│   ├── _layout.tsx                # NEW — the Drawer and its options
│   ├── index.tsx                  # MOVED from app/index.tsx; loses five buttons
│   ├── entries/index.tsx          # MOVED from app/entries/index.tsx
│   ├── statistics.tsx             # MOVED
│   └── forecast.tsx               # MOVED
├── entries/{contribute,withdraw,[id]}.tsx   # unchanged
├── settings/{goal,reminders}.tsx            # unchanged — open over the current screen
├── onboarding/…                             # unchanged
└── dev/seed.tsx                             # unchanged

src/
├── features/navigation/
│   ├── destinations.ts            # NEW — the list in data-model.md
│   ├── navigation-menu.tsx        # NEW — drawer content
│   ├── menu-item.tsx              # NEW
│   ├── menu-button.tsx            # NEW
│   └── leave-screen.ts            # unchanged
└── ui/
    ├── primitives/screen.tsx      # gains `leading`
    └── strings/strings.ts         # gains `navigation`; drops strings left with no reader

tests/
├── support/                       # NEW setup file(s) for the gesture and animation mocks
├── component/navigation-menu.test.tsx   # NEW
├── component/navigation-routes.test.tsx # NEW — destinations against route files; back behaviour
├── component/home.test.tsx        # changes: removed buttons asserted absent
└── component/routes.test.tsx      # changes: route files now under (drawer)/

e2e/
├── config.yaml                    # lists navigation-menu.yaml by name — it runs only smoke.yaml and us*.yaml
├── navigation-menu.yaml           # NEW
├── go-to-section.yaml             # NEW shared subflow: open the menu, tap an item by id
└── open-reminders.yaml, us1-revise-target.yaml, us2-record-progress.yaml,
    us3-statistics.yaml, us4-forecast.yaml, us5-withdrawal.yaml, us6-reminders.yaml
                                   # reach their section through the subflow
```

**Structure Decision**: The existing single-codebase layout from 001, with one new route group. Moving four route files under `(drawer)/` changes no URL (research D-003), so `router.push` calls, deep links, and the seed route are untouched.

### Effect on 001's documents

001's plan shows the route tree as it was planned, including a `settings/index.tsx` and `settings/data.tsx` that were never built; it is a record of that plan and is left alone. 001's Phase 10 accessibility walk (T146) covers eleven screens and should cover the menu as well; the tasks for this feature add that note to T146 rather than duplicating the walk.

## Complexity Tracking

No constitution violations to justify.
