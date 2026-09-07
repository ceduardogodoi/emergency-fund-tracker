/**
 * How a surface is bounded.
 *
 * There is no elevation token, and that is a design decision rather than an omission: in
 * this language a surface is a slab cut from the page, distinguished by value alone.
 * Nothing floats, so nothing casts a shadow — and a shadow token left lying around is how
 * a card acquires one on the screen someone builds in a hurry. Should a floating surface
 * ever be needed, it arrives with the shadow it requires, defined here.
 */

/**
 * Corner radii.
 *
 * Three values, because this design language has three answers and no scale between them.
 * A graded scale — small, medium, large — implies that roundness carries meaning
 * proportional to a surface's size, and here it does not: the corners are square, and the
 * two exceptions are named for the exact case each exists to serve.
 */
export const radius = {
  /** Square. The default, and what every card, button, and unit uses. */
  none: 0,
  /** The single softening: a text input, so the caret never sits in a knife corner. */
  input: 2,
  /**
   * A fully rounded end — a dot or a badge. Any value at least half the element's height
   * produces a semicircle, so one constant serves every height.
   */
  pill: 999,
} as const

/**
 * Border widths.
 *
 * Two values, because a border in this app is doing one of two jobs: marking where a
 * control ends, or saying that this one is the chosen one. A scale of five would invite a
 * third job nobody can name.
 */
export const borderWidth = {
  /** No border. Named so a deliberate zero reads as a choice. */
  none: 0,
  /** The edge of an input, or of a button with no fill of its own. */
  control: 1,
  /** A boundary carrying meaning — the selected option in a group of them. */
  emphasis: 2,
} as const
