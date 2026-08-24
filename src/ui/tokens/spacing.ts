/**
 * The spacing scale. Every margin, padding, and gap in the app is one of these values.
 *
 * The steps are multiples of 4, which is the grid both platforms' own layouts sit on, so
 * app spacing lines up with system chrome rather than drifting a pixel off it.
 */
export const spacing = {
  /** No gap. Named so a deliberate zero is distinguishable from a forgotten value. */
  none: 0,
  /** Between a label and the control it names. */
  xs: 4,
  /** Between related items inside a row. */
  sm: 8,
  /** The default gap between elements in a stack. */
  md: 16,
  /** Between groups within a section. */
  lg: 24,
  /** Between sections. */
  xl: 32,
  /** Above and below a screen's primary action. */
  xxl: 48,
} as const

/**
 * The horizontal inset from the edge of the screen to its content. Named separately from
 * the scale because it is a layout decision, not a choice of gap — every screen uses this
 * one value, and changing it should move every screen together.
 */
export const screenInset = spacing.md

/**
 * The minimum side of a tappable target, in density-independent pixels.
 *
 * The two platforms differ — iOS HIG asks for 44pt, Material for 48dp — and this takes
 * the stricter of the pair so one number satisfies both. WCAG 2.1 AA sets no target-size
 * requirement at all (2.5.5 is AAA), so the platform guidance is the binding constraint
 * here, not the accessibility standard.
 */
export const minimumTouchTarget = 48
