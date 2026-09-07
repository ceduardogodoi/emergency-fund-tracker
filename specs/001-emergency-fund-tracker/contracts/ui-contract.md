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

## Visual language

The app is drawn in the vocabulary of Brazilian concretism: a cool concrete ground with white slabs cut out of it, square corners, and exactly one saturated colour. It is a deliberate rejection of the default fintech kit — rounded cards, soft shadows, a palette of tints — which reads as generic precisely because every product in the category uses it.

Four rules carry it, and each has a mechanical consequence:

- **One accent, twice a screen at most.** Ultramarine marks the action the screen is asking for and the months already covered. Nothing else is blue — a secondary action is a slab with a boundary and ordinary ink. An accent used by two controls at once stops saying which of them matters.
- **Surfaces separate by value, not by depth.** There is no elevation token and no shadow anywhere. A card is white on concrete; if that is not enough to group its contents, the grouping is wrong.
- **Corners are square.** `radius` holds three values — `none` for every surface, `input` for the single 2dp softening a text field needs so the caret does not sit in a knife corner, and `pill` for a dot or badge. A graded small/medium/large scale would imply roundness carries meaning proportional to size, and here it does not.
- **The amount is the subject.** Every screen has one figure the user came to read, and it is set at `display` — roughly two and a half times body copy. `MoneyInput` always renders what is being typed at `title` size for the same reason: an amount typed at body size reads as a setting to configure rather than as the number being decided.

The typeface is Archivo (Omnibus-Type), bundled with the app in four weights. It was chosen for its tabular lining figures, which is the property this app needs most — comparing amounts down a column is the primary reading task — and because the system face gives an app the typographic voice of every other app on the phone. Font files are bundled, never fetched, so the typeface is compatible with FR-041. A font that fails to load is survived rather than raised: React Native falls back to the system face, and the failure is logged through the `Logger` port instead of blocking the app from opening.

Two copy patterns are banned outright because they read as machine-written: an all-caps label above content, and meta strings joined by middle dots (`Equilibrada · 6 meses`). Both say in punctuation what a sentence says in words, and a screen reader announces the second as two unrelated phrases.

## Design tokens

`src/ui/tokens/` is the only place a style value exists. Spacing, color, typography, radii, border widths, and interaction-state opacity are defined there and imported directly. There is no theme provider: research decision D-018 ships one light theme, so a provider would be indirection with a single value flowing through it. Semantic naming is what keeps a second theme a change to the token module rather than to every component.

An ESLint rule fails the build on any color literal, hex value, or raw numeric spacing, radius, type size, border width, or opacity outside that directory. This is the mechanical form of Principle VI's ban on hard-coded style values; without the rule, the tokens become a suggestion within a month.

Tokens are semantic, not literal — `color.background.card`, `color.text.secondary`, `color.filled.negative`. A token named after what it looks like rather than what it means is how a design system loses its ability to change.

## Primitives

Screens compose these. A pattern appearing twice becomes one of them (Principle VI).

`Screen` scrolls by default. Whether a screen's content fits is not a property the screen can know — it depends on the device, the reader's text size, and how much has been entered — and when it does not fit, nothing is clipped or flagged: the last control is simply unreachable, for some people and not others. A screen opts out with `scrolls={false}` only when its content brings its own scrolling container, which is a virtualised list; nested inside a scroll view, such a list is given unbounded height and stops virtualising.

| Primitive | Responsibility |
|-----------|----------------|
| `Screen` | Safe-area container, scrolling, consistent page padding |
| `Text` | Every typographic style; no ad-hoc font sizes anywhere |
| `Button` | Primary, secondary, and destructive variants; carries its own minimum touch target |
| `Field` | Label, input, help text, error text, and the accessible wiring between them |
| `MoneyInput` | Currency-aware entry that emits `Money` in minor units — never a float, never a raw string |
| `Choice` | One option in a group where exactly one is chosen; announced as a radio, carrying its own name, explanation, and selected state. Takes an optional visual as children, decorative by contract |
| `CoverageMeter` | Months of coverage as countable units. Decorative and hidden from assistive technology — the count it depicts is always stated in words beside it, the same division `ChartFrame` makes |
| `Card` | The single grouped-surface treatment: a white slab, no shadow |
| `StateView` | The four-state contract above |
| `ChartFrame` | Wraps every chart with its accessible equivalent — see below |
| `ConfirmSheet` | The one confirmation pattern for destructive actions |

## Accessibility obligations

FR-049 requires WCAG 2.1 AA and FR-050 requires usability at the largest supported text size. Concretely, on every screen:

- Text contrast ≥ 4.5:1, and ≥ 3:1 for large text and meaningful non-text elements. Token pairs are contrast-checked in a unit test, so a palette edit that breaks contrast fails CI rather than shipping.
- Every interactive element has an accessible label and role. Icon-only buttons always carry an explicit label.
- Minimum touch target 48dp, owned by `Button` and `Field` rather than re-specified per screen. WCAG 2.1 sets no target-size requirement at AA — SC 2.5.5 is AAA — so the binding numbers are the platforms': iOS asks for 44pt and Material for 48dp. One app ships to both, and the stricter of the two satisfies both, so the token is 48.
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
