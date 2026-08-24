/**
 * WCAG 2.1 contrast arithmetic, kept in test support because no runtime code needs it —
 * the palette is fixed at build time, so contrast is a property the test suite proves
 * once rather than something the app recomputes on every render.
 *
 * Formulas are from WCAG 2.1 SC 1.4.3 (Contrast Minimum) and the relative luminance
 * definition it references.
 */

/** Matches the `#RRGGBB` form every token colour is written in. */
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

/**
 * Relative luminance of an sRGB colour, in the range 0 (black) to 1 (white).
 *
 * @param hex - A colour in `#RRGGBB` form
 * @returns The relative luminance
 * @throws RangeError if the colour is not well-formed `#RRGGBB`
 */
export function relativeLuminance(hex: string): number {
  if (!HEX_COLOR.test(hex)) {
    throw new RangeError(`Expected a #RRGGBB colour, received ${JSON.stringify(hex)}`)
  }
  const [red, green, blue] = [1, 3, 5].map((offset) => {
    const channel = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255
    // The sRGB transfer function: a linear segment near black, a power curve above it.
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

/**
 * Contrast ratio between two colours, from 1 (identical) to 21 (black on white).
 *
 * The ratio is symmetric — WCAG defines it over the lighter and darker of the pair, so
 * argument order does not matter and callers need not know which is which.
 *
 * @param one - A colour in `#RRGGBB` form
 * @param other - The colour it is placed against, in `#RRGGBB` form
 * @returns The contrast ratio
 */
export function contrastRatio(one: string, other: string): number {
  const [lighter, darker] = [relativeLuminance(one), relativeLuminance(other)].sort(
    (left, right) => right - left,
  ) as [number, number]
  return (lighter + 0.05) / (darker + 0.05)
}
