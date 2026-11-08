# Research: Drawer Navigation

**Feature**: `specs/002-drawer-navigation` | **Date**: 2026-11-08

Every claim below was read from the installed source, run in this repository, or taken from the current Expo documentation through Context7, and says which. What could not be settled without a device is listed at the end as an open item, not written down as a finding.

## D-001: The navigator — Expo Router's own drawer

**Decision**: Use the drawer layout Expo Router ships, imported from `expo-router/drawer`.

**Rationale**: Since SDK 56 the drawer navigator is bundled in `expo-router` (Expo docs, "Drawer", via Context7). The installed `expo-router` 57.0.13 carries it under `build/react-navigation/drawer`, built on `react-native-drawer-layout` 4.2.10, which is already a dependency of `expo-router`. It brings three things the spec needs and that would otherwise be hand-built:

- **The background leaves the accessibility tree while the menu is open, and the menu while it is closed** — `react-native-drawer-layout`'s `Drawer.native.js` sets `importantForAccessibility="no-hide-descendants"` and `accessibilityElementsHidden` on whichever side is hidden (FR-010, first half).
- **Back closes an open menu** before it leaves the screen (FR-008): `DrawerView.js` registers a back listener only while the drawer is open, and that listener closes it and consumes the event.
- **Back from a drawer screen returns to the first screen**: `backBehavior` defaults to `'firstRoute'` in the vendored `TabRouter` (FR-009). Measured, see D-003.

**Alternatives considered**: A bottom tab bar (rejected in the spec's assumptions: five items at most, and permanent space taken from Home). A menu drawn with this app's own sheet primitive, opened from a button (rejected: it would re-implement edge-swipe, back handling, and hiding the background from screen readers — the three things above — for a menu of six items). `@react-navigation/drawer` as a separate package (rejected: Expo Router vendors it, and a second copy would be a second navigation context that Expo Router's routes do not live in).

## D-002: Three packages become direct dependencies

**Decision**: Install `react-native-gesture-handler`, `react-native-reanimated`, and `react-native-worklets` with `npx expo install`, so `package.json` declares them at the versions SDK 57 pins.

**Rationale**: The Expo docs state that the drawer needs all three on Android and iOS, and that Expo Router does not add gesture handler itself. Today they are in `node_modules` only by accident: `npm ls` shows gesture handler 3.2.1 and reanimated 4.5.3 under `expo-router`, which declares them as **optional** peers, and worklets 0.10.4 under `@expo/ui` and `expo-modules-core`. An import that works because of how npm happened to hoist a transitive package is one `npm install` away from not working. Expo Go carries all three natively, and a release build autolinks them.

`babel-preset-expo` passes `reanimated` and `worklets` platform options through to its plugin list (`build/index.js`, lines 141–142), so no Babel change is expected; the first release build confirms it (R-003).

**Constitution**: Principle-required justification is in plan.md's dependency table.

## D-003: Route layout — a drawer group inside the root stack, with every URL unchanged

**Decision**:

```text
app/
├── _layout.tsx               # root Stack (unchanged role: providers, boot)
├── (drawer)/
│   ├── _layout.tsx           # the Drawer
│   ├── index.tsx             # Home            /
│   ├── entries/index.tsx     # History         /entries
│   ├── statistics.tsx        # Statistics      /statistics
│   └── forecast.tsx          # Forecast        /forecast
├── entries/contribute.tsx    # over the drawer /entries/contribute
├── entries/withdraw.tsx      #                 /entries/withdraw
├── entries/[id].tsx          #                 /entries/:id
├── settings/goal.tsx         #                 /settings/goal
├── settings/reminders.tsx    #                 /settings/reminders
├── onboarding/…              # unchanged
└── dev/seed.tsx              # unchanged
```

Screens in the drawer show the menu; screens in the root stack open over whatever was showing, with no menu, and return there.

**Rationale — measured, not assumed**: The question was whether `/entries` could live inside the `(drawer)` group while `/entries/contribute` and `/entries/[id]` live outside it. A throwaway component test rendered exactly this tree with `expo-router/testing-library`'s `renderRouter` and asserted, for `/`, `/entries`, `/entries/contribute`, `/entries/abc`, `/settings/goal`, and `/onboarding/expenses`, that the right screen rendered at an unchanged pathname — all six passed. Three more cases passed: back after choosing Statistics then Goal from Home returned to `/`; contribute pushed from Home returned to Home; contribute pushed from History returned to History. Setting `backBehavior="history"` on the drawer made the first of those fail with `Received: "/statistics"`, so the test was able to fail. The file was deleted after the run.

So every `router.push` in the app and every deep link a Maestro flow opens keeps its path; the move is a matter of where files sit, not of what they are called.

Goal and Reminders are in the root stack, by the user's decision on 2026-11-08 (spec, Clarifications): both are forms, and a drawer keeps a visited screen mounted, so as drawer screens an abandoned draft would have reappeared on the next visit. As stack screens they are discarded on leaving, and the forecast's contextual link to revise the goal still returns to the forecast, as it does today.

**Alternatives considered**: Renaming History to `/history` to avoid sharing a segment with `/entries/contribute` (rejected — measured to be unnecessary, and it would change two `router.push` calls and the flows that open the list). History as a nested stack inside the drawer, holding contribute and the entry editor (rejected: contribute opened from Home would switch the drawer to History and push onto it, so back from a saved contribution would land on History rather than Home).

## D-004: The menu's contents and its button are this app's own

**Decision**: Pass the drawer a `drawerContent` component built from this app's primitives, and draw the menu button in each screen rather than in a navigator header. The vendored `DrawerItem`, `DrawerItemList`, and `DrawerToggleButton` are not used.

**Rationale**, from the vendored source:

- `DrawerItem` renders its label with `numberOfLines: 1`, so at the largest text size a label is cut off — against 001 FR-050 and this spec's edge case that items wrap.
- `DrawerToggleButton` defaults its accessible name to the English "Show navigation menu" and states nothing about whether the menu is open (FR-003). The app's language is pt-BR only (001 research D-020).
- Both draw with React Navigation's theme colours and spacing, and Principle VI allows style values from the token module only.

The headers stay hidden, as they are today: `Screen` draws each title as a heading, and a navigator header would draw a second one. The button sits in a slot `Screen` gains beside its title (contract: navigation-ui.md), so `src/ui` stays free of navigation imports, as the layer table in CLAUDE.md requires.

**Alternatives considered**: Styling the built-in items through their props (rejected: `numberOfLines` is not a prop, and the accessible state is not exposed). Showing the drawer's own header with a custom left button (rejected: a second title, or a header with no title that still takes height from Home).

## D-005: The current section, and choosing it again

**Decision**: The menu marks the current section from the drawer's state — the focused route it is handed in `drawerContent`'s props — with `accessibilityState={{ selected: true }}` and a visible bar at the item's leading edge, which is a shape and not only a colour (FR-007). Choosing the current section closes the menu and does nothing else. Choosing Goal or Reminders closes the menu and pushes the screen over the current one.

**Rationale**: The drawer state is what the drawer already knows; deriving the current section from the URL a second time would be two answers that could disagree.

## D-006: Every size behaves like a phone

**Decision**: `drawerType: 'front'` everywhere, set explicitly.

**Rationale**: The vendored `DrawerView.js` defaults `drawerType` to `'slide'` on iOS and `'front'` elsewhere — the iOS default moves the whole screen aside, which is different behaviour on each platform for the same tap (FR-013). `'front'` slides the menu over the content on both, and stating it keeps the spec's "never permanently open" true whatever a later default does. The same file defaults `overlayColor` to `rgba(0, 0, 0, 0.5)`; the drawer is given the existing `color.scrim` token instead, so the backdrop matches the confirmation sheet's.

## D-007: Tests

**Decision**: The component Jest project gains three entries in `setupFiles` — `react-native-gesture-handler/jestSetup` and module mocks of `react-native-worklets` and `react-native-reanimated` from their own `mock` entry points.

**Rationale — measured**: Importing `expo-router/drawer` in a component test with no mocks fails at load with `Cannot read properties of undefined (reading 'loadUnpackers')` from worklets' native module. With the worklets and reanimated mocks, gesture handler then fails with `setGestureHandlerConfig is not a function` — its `jestSetup` was being required from inside the test, which runs after the hoisted imports have already loaded the real module. It has to run before the test file does, which is what `setupFiles` is for. `tests/component/routes.test.tsx` requires every route file, including the new `(drawer)/_layout.tsx`, so these mocks have to be project-wide rather than per file.

**A trap found on the way**: `renderRouter` returns RNTL's `render` result with `getPathname` and its siblings assigned onto it. In RNTL v14, which this project uses, `render` returns a promise — so `await renderRouter(…)` resolves to the inner result and the helpers are gone (`getPathname is not a function`). Keep the returned value, `await` it, then call the helpers on the value that was kept. The same failure appears through `expect(screen).toHavePathname`, because that matcher calls `getPathname` on whatever it is given. It belongs in anti-patterns.md if it costs time again.

**Maestro**: Seven flows reach a section through a Home button that this feature removes — `open-reminders`, `us1-revise-target`, `us2-record-progress`, `us3-statistics`, `us4-forecast`, `us5-withdrawal`, and `us6-reminders`. They go through the menu instead, by one shared subflow that opens it and taps an item by id, so the next change to how a section is reached is one file. A new `e2e/navigation-menu.yaml` covers the feature's own stories on both platforms.

## Open items

| Id | Item | Resolves in |
|----|------|-------------|
| R-001 | **Screen-reader focus on open and close (FR-010, second half).** The drawer hides the side not shown, but nothing read in its source moves focus into the menu when it opens or back to the button when it closes. Whether VoiceOver and TalkBack do it anyway, given the hiding, must be measured on both platforms before anything is written to force it — and if it is needed, `AccessibilityInfo.setAccessibilityFocus` on the button when `useDrawerStatus` turns to `'closed'` is the first candidate, also measured. | The menu-button task |
| R-002 | **Home without scrolling (FR-005, SC-001).** Removing five buttons takes out roughly five control heights, but whether balance, progress, and both actions then fit on a 6.1-inch-class screen with a milestone message *and* the recovery card showing is a measurement, on an iPhone simulator of that class and an Android emulator of the same size, at the default text size. If the worst state does not fit, the spec's criterion stands and Home's cards are what give. | The Home task |
| R-003 | **The animation packages in a release build.** Confirm the drawer opens and animates in a release build on both platforms after D-002, with no Babel change. | The dependency task |
| R-004 | **Edge swipe against the system back gesture.** On Android with gesture navigation, a swipe in from the left edge is also the system's back gesture. Measure which one wins on Home and whether opening the menu by swipe is reliable; the button is the required way in either way. | The drawer layout task |
