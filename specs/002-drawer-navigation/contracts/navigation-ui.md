# Contract: Navigation Menu UI

**Feature**: `specs/002-drawer-navigation` | **Date**: 2026-11-08

What the menu, its button, and the reshaped Home promise to the user, to the tests, and to the rest of the codebase. It extends [001's UI contract](../../001-emergency-fund-tracker/contracts/ui-contract.md) and changes nothing in it: the visual language, the tokens, and the four-state rule apply here unchanged.

## Components

| Component | Layer | Role |
|-----------|-------|------|
| `Screen` (existing) | `src/ui/primitives` | Gains one optional prop, `leading?: ReactNode`, drawn before the title on the title's row. `Screen` knows nothing of navigation; it draws whatever it is given |
| `MenuButton` | `src/features/navigation` | Opens the menu. Rendered as `Screen`'s `leading` by the four `section` screens only. Its glyph is three horizontal bars drawn as `View`s in `color.text.primary`, sized and spaced from tokens: the conventional sign for a menu, square like every other shape here, and no icon package. The bars are decoration; the accessible name carries the meaning |
| `NavigationMenu` | `src/features/navigation` | The drawer's content: the destinations from data-model.md, in order |
| `MenuItem` | `src/features/navigation` | One destination. Wraps, never truncates |
| `app/(drawer)/_layout.tsx` | `app` | The drawer itself: `drawerContent`, `drawerType: 'front'`, `backBehavior: 'firstRoute'`, `headerShown: false`, `overlayColor: color.scrim`, and `drawerStyle` from tokens |

`MenuItem` stays in `src/features/navigation` until a second consumer exists; a pattern that appears once is not yet a primitive (Principle VI).

## Test ids

| Id | Element |
|----|---------|
| `menu-button` | The button, on every `section` screen |
| `navigation-menu` | The menu's container |
| `menu-item-<key>-current` | The bar on the current item, present only there |
| `menu-item-<key>` | Each item: `menu-item-home`, `menu-item-history`, `menu-item-statistics`, `menu-item-forecast`, `menu-item-goal`, `menu-item-reminders` |

Removed from Home: `history`, `statistics`, `forecast`, `reminders`, and `revise-goal`. `contribute` and `withdraw` stay. A test or flow still looking for a removed id fails rather than finding a stale button, which is the point of retiring them rather than reusing them on the menu items.

## Accessibility obligations

| Requirement | Obligation |
|-------------|------------|
| FR-003 | `MenuButton` has `accessibilityRole="button"`, a pt-BR accessible name stating what it opens (`strings.navigation.open`), and `accessibilityState={{ expanded }}` read from `useDrawerStatus()` |
| FR-007 | The current item has `accessibilityState={{ selected: true }}` **and** a visible bar at its leading edge drawn in the accent. The bar is a shape, so the marking survives without colour (001 FR-049) |
| FR-010 | Hiding the side not shown is the drawer's (research D-001). Moving focus in on open and back to the button on close is open item R-001: measured on both platforms first, forced only if needed |
| FR-011 / 001 FR-050 | Item labels use the `Text` primitive with no line limit. The menu's list scrolls when it does not fit. The button and every item meet `minimumTouchTarget` (48) from `src/ui/tokens/spacing.ts` |
| FR-011 / 001 FR-052 | The button and the items use `Pressable` feedback from the same interaction tokens as `Button` |

## Strings

New keys under `strings.navigation`, pt-BR:

| Key | Text |
|-----|------|
| `open` | Abrir menu |
| `menuLabel` | Navegação — a visible heading at the top of the menu, with the header role, so a screen reader lands on it as focus enters. A label on the container would not be announced: the container is not itself an accessible element |
| `destinations.home` … `destinations.reminders` | as data-model.md |

`strings.home.historyAction`, `remindersAction`, and `reviseAction`, and `strings.statistics.action` and `strings.forecast.action`, lose their only consumer on Home. Each is deleted if nothing else reads it, checked by search when the task lands — a string kept for a button that no longer exists is how the strings module drifts from the screens.

## Home

Keeps, in order: the milestone message, the standing card, the recovery card, the contribute and withdraw buttons, and the goal card without its revise button. Loses the history, statistics, forecast, and reminders buttons. The redirect to onboarding when no goal exists is unchanged and stays in `(drawer)/index.tsx`.
