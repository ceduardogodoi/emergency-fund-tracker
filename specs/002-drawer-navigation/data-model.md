# Data Model: Drawer Navigation

**Feature**: `specs/002-drawer-navigation` | **Date**: 2026-11-08

This feature stores nothing. There is no migration, no repository, and no port: the database, the domain, and every query are untouched. What it has instead is one fixed list — the menu's destinations — and the rule for which one is current.

## Destination

One entry in the menu. The list is a constant in `src/features/navigation/destinations.ts`; its order is the menu's order (FR-001).

| Field | Type | Meaning |
|-------|------|---------|
| `key` | `'home' \| 'history' \| 'statistics' \| 'forecast' \| 'goal' \| 'reminders'` | Identity; also forms the item's test id, `menu-item-<key>` |
| `label` | string from `strings.navigation` | The name shown and announced. pt-BR, from `src/ui/strings` like every user-facing string |
| `href` | route path | Where it leads. Unchanged from today (research D-003) |
| `presentation` | `'section' \| 'over'` | `section`: a drawer screen, shows the menu button, back returns Home. `over`: pushed over the current screen, no menu button, back returns where it was opened (spec, Clarifications) |

| Order | `key` | `label` | `href` | `presentation` |
|-------|-------|---------|--------|----------------|
| 1 | `home` | Sua reserva | `/` | section |
| 2 | `history` | Histórico | `/entries` | section |
| 3 | `statistics` | Estatísticas | `/statistics` | section |
| 4 | `forecast` | Previsão | `/forecast` | section |
| 5 | `goal` | Meta | `/settings/goal` | over |
| 6 | `reminders` | Lembretes | `/settings/reminders` | over |

The labels are each screen's existing title, except Goal: its screen is titled "Ajustar meta", an action, and the menu lists places. "Meta" names the same thing in a word the screen's title contains, which is what FR-001 asks.

**Validation**: the list is checked by test, not at runtime — every `section` destination has a route file under `app/(drawer)/`, every `over` destination one outside it, and every `href` is a path the router resolves. A destination added without its route, or a route moved without its destination, fails the suite.

## Which destination is current

Derived, never stored: the drawer's focused route, read from the state `drawerContent` receives (research D-005). Only `section` destinations can be current. An `over` destination is never marked, because the menu is not reachable while one is showing.

## State transitions

```text
              tap button / edge swipe
   closed ───────────────────────────▶ open
     ▲                                   │
     │  tap outside, swipe, back,        │
     │  choose current section           │
     ├───────────────────────────────────┤
     │  choose another section           │──▶ closed, that section shown
     │  choose goal or reminders         │──▶ closed, that screen pushed over
```

The menu's open or closed state belongs to the drawer navigator. Nothing in this app holds a copy, so the button's announced state (FR-003) and what is on screen cannot disagree.
