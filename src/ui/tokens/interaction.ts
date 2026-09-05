/**
 * What a control looks like while it is being used, or while it cannot be.
 *
 * These are states rather than shapes, which is why they are not in `shape.ts`: the same
 * `pressed` value has to read as the same feedback whichever control it is applied to, and
 * a second number invented on another screen is how one control starts to feel different
 * from the rest.
 */

/**
 * Opacity by interaction state.
 *
 * Opacity alone never carries meaning here — `disabled` is announced through
 * `accessibilityState` as well, because a dimmed control says nothing to a screen reader
 * and nothing at all to a user who cannot distinguish the two shades.
 */
export const opacity = {
  /** Fully drawn. Named so a deliberate default reads as a choice. */
  full: 1,
  /** While a control is held down — visible feedback within 100ms (FR-052). */
  pressed: 0.85,
  /** A control that cannot be activated. */
  disabled: 0.45,
} as const
