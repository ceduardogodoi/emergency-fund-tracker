/**
 * Corner radii, border widths, and elevation — how a surface is bounded, and how it sits
 * relative to the page.
 */

/** Corner radii. */
export const radius = {
  /** A square corner. Named so a deliberate zero reads as a choice. */
  none: 0,
  /** Inputs and small controls. */
  sm: 6,
  /** Cards and sheets. */
  md: 12,
  /** A large sheet presented over the page. */
  lg: 20,
  /**
   * A fully rounded end — chips and the progress bar. Any value at least half the
   * element's height produces a semicircle, so one constant serves every height.
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

/**
 * Elevation levels.
 *
 * Each carries both platforms' expression of the same depth: iOS draws an explicit shadow,
 * Android derives one from `elevation`. Both are set together so a surface cannot end up
 * lifted on one platform and flat on the other.
 */
export const elevation = {
  /** Flush with the page. */
  flat: {
    shadowColor: '#000000',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  /** A card resting on the page. */
  raised: {
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  /** A sheet or dialog presented above everything else. */
  overlay: {
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
} as const
