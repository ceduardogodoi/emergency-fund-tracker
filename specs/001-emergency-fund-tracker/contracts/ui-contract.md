# Contract: UI, State, and Accessibility

**Feature**: `specs/001-emergency-fund-tracker` | **Date**: 2026-08-15

Principle VI requires the interface to behave predictably across every screen. This file turns that from an intention into obligations the compiler and the linter can hold, because a consistency rule that lives only in a review checklist is a rule that erodes.

## The four-state contract

FR-051 requires loading, empty, error, and populated states on every view backed by stored or computed data. That is enforced by a primitive, not by discipline:

```ts
type ViewState<T> =
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'error'; error: AppError; retry?: () => void }
  | { kind: 'ready'; data: T }

interface StateViewProps<T> {
  state: ViewState<T>
  loading?: () => ReactNode      // defaults to the shared skeleton
  empty: () => ReactNode          // REQUIRED — no generic default
  error?: (e: AppError, retry?: () => void) => ReactNode
  ready: (data: T) => ReactNode
}
```

`empty` is required with no default. A meaningful empty state has to say what will appear here and what action produces it (FR-025), and no generic component can know that — so the type system asks each screen for it rather than letting a blank screen ship.

Every screen reads its data through a TanStack Query hook that maps directly onto `ViewState`, so the four states are produced once and rendered the same way everywhere.

## Design tokens

`src/ui/tokens/` is the only place a style value exists. Spacing, color, typography, radii, and elevation are defined there and consumed through the theme provider.

An ESLint rule fails the build on any color literal, hex value, or raw numeric spacing outside that directory. This is the mechanical form of Principle VI's ban on hard-coded style values; without the rule, the tokens become a suggestion within a month.

Tokens are semantic, not literal — `color.surface.raised`, `color.text.secondary`, `color.state.negative`. A token named after what it looks like rather than what it means is how a design system loses its ability to change.

## Primitives

Screens compose these. A pattern appearing twice becomes one of them (Principle VI).

| Primitive | Responsibility |
|-----------|----------------|
| `Screen` | Safe-area container, scroll behavior, consistent page padding |
| `Text` | Every typographic style; no ad-hoc font sizes anywhere |
| `Button` | Primary, secondary, and destructive variants; carries its own minimum touch target |
| `Field` | Label, input, help text, error text, and the accessible wiring between them |
| `MoneyInput` | Currency-aware entry that emits `Money` in minor units — never a float, never a raw string |
| `Card` | The single elevated-surface treatment |
| `StateView` | The four-state contract above |
| `ChartFrame` | Wraps every chart with its accessible equivalent — see below |
| `ConfirmSheet` | The one confirmation pattern for destructive actions |

## Accessibility obligations

FR-049 requires WCAG 2.1 AA and FR-050 requires usability at the largest supported text size. Concretely, on every screen:

- Text contrast ≥ 4.5:1, and ≥ 3:1 for large text and meaningful non-text elements. Token pairs are contrast-checked in a unit test, so a palette edit that breaks contrast fails CI rather than shipping.
- Every interactive element has an accessible label and role. Icon-only buttons always carry an explicit label.
- Minimum touch target 44×44pt, owned by `Button` and `Field` rather than re-specified per screen.
- Color is never the only signal. Contributions and withdrawals differ by icon, sign, and label — not only by green and red (FR-014).
- Layouts reflow at the largest dynamic text size with nothing clipped and no control unreachable. Every screen has a component test at the maximum text scale.
- Focus order follows visual order; modals trap focus and return it on dismiss.
- Live regions announce balance changes after an entry is saved, so a screen-reader user gets the same confirmation a sighted user gets.

### Charts

FR-019 requires a visual form, and no charting library is accessible on its own. `ChartFrame` therefore renders three things from the same data: the chart, a one-sentence text summary of the trend, and a data table reachable by screen reader. The chart itself is marked decorative — the summary and table are the accessible content, not an afterthought bolted beside it.

## Feedback and confirmation

- Every action produces visible feedback within 100ms (FR-052). Any action that could exceed that shows a pending state on the control itself, never a full-screen blocking spinner.
- Destructive actions — deleting an entry, replacing data on import, erasing everything — go through `ConfirmSheet`, which states what will happen and what is lost, and labels its action with the verb rather than "OK".
- Saving an entry returns the user to where they were and announces the new balance. No success dialog to dismiss.
- Validation errors appear inline on the field, in words that say how to fix it, never as a modal.

## Screen inventory

Eleven screens. Each lists the states it must handle beyond `ready`.

| Screen | Route | States |
|--------|-------|--------|
| Home / progress | `/` | loading, empty (no goal → onboarding), ready, goal-reached |
| Onboarding: expenses | `/onboarding/expenses` | validation error |
| Onboarding: level | `/onboarding/level` | — |
| Onboarding: opening balance | `/onboarding/opening-balance` | skippable, validation error |
| History | `/entries` | loading, empty, ready, future-dated warning |
| Add contribution | `/entries/contribute` | validation error |
| Record withdrawal | `/entries/withdraw` | validation error, over-balance confirmation |
| Statistics | `/statistics` | loading, empty, insufficient-data per card, ready |
| Forecast | `/forecast` | loading, insufficient-history, no-pace, reached, projected |
| Settings | `/settings/*` | permission-denied (reminders), import in progress, import failed |
| Goal revision | `/settings/goal` | validation error, impact-on-progress preview |

The forecast screen's four states map one-to-one onto the `ForecastState` union in [domain-ports.md](./domain-ports.md), so FR-029's insufficient-history case and FR-030's zero-pace case cannot be skipped — the compiler requires both.

## Copy rules

- One term per concept, everywhere. "Contribution", never "deposit" or "payment". "Target", never "goal amount". "Pace", never "rate" or "velocity".
- Money always renders through one formatter using the profile's currency and the device locale (FR-039). No component formats money itself.
- Dates render through one formatter. Entry dates show as calendar dates with no time, because they have none.
- Error copy says what happened and what to do about it. No error code is ever the whole message.
- The forecast always states its assumption alongside the date (FR-028). A projected date shown without the pace it assumes is a number the user cannot evaluate.
