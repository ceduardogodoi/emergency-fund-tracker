import type { TextStyle } from 'react-native'

/**
 * The typeface, by weight.
 *
 * Archivo (Omnibus-Type) rather than the system face. A grotesque drawn for high-contrast
 * digital and print work: narrow enough that a six-figure amount fits on one line at
 * display size, with true tabular lining figures — which is the property this app needs
 * most, since comparing amounts down a column is the primary reading task.
 *
 * React Native selects a weight by family name, not by `fontWeight`: each weight is its
 * own loaded font. That is why these are families rather than numbers, and why a style
 * below never sets `fontWeight` — on Android it would be ignored, and the two would
 * disagree about what "bold" means.
 *
 * The names are the keys `useFonts` is given in `src/ui/fonts.ts`, which builds its map
 * from these constants so the two cannot drift.
 */
export const fontFamily = {
  /** Body copy and captions. */
  regular: 'Archivo_400Regular',
  /** The weight between body and label, for text that carries a little more weight. */
  medium: 'Archivo_500Medium',
  /** Control labels and section headings. */
  semibold: 'Archivo_600SemiBold',
  /** Screen titles and amounts. */
  bold: 'Archivo_700Bold',
} as const

/**
 * Type styles, named for the job each does rather than its size.
 *
 * Sizes are unscaled base values. React Native multiplies them by the reader's text-size
 * setting at render time, which is why nothing here caps a size and why no layout may
 * assume a line's height — T147 tests every screen at the largest supported setting.
 *
 * The scale is deliberately steep at the top. `display` is roughly two and a half times
 * `body`, because the amount is the one thing on the screen a user came to read, and a
 * figure set a couple of steps above its label reads as a row in a table rather than as
 * the answer to their question. Everything below `title` stays close together: the rest
 * of the interface is there to be understood quickly and then ignored.
 *
 * Tracking is negative on the two largest styles and neutral below. Large type sets
 * loose by default, and the display figure has to read as one object rather than as a
 * row of digits; body text at 16 needs no such help, and tightening it would only cost
 * legibility.
 *
 * `lineHeight` is set on every style rather than left to the platform default, which
 * differs between iOS and Android and would otherwise make the same screen a different
 * height on each.
 */
export const typography = {
  /** The target or balance — the one number the screen exists to show. */
  display: { fontFamily: fontFamily.bold, fontSize: 40, lineHeight: 44, letterSpacing: -1.2 },
  /** A screen title. */
  title: { fontFamily: fontFamily.bold, fontSize: 28, lineHeight: 32, letterSpacing: -0.5 },
  /** A section or card heading. */
  heading: { fontFamily: fontFamily.semibold, fontSize: 19, lineHeight: 25, letterSpacing: -0.2 },
  /** Body copy. */
  body: { fontFamily: fontFamily.regular, fontSize: 16, lineHeight: 24, letterSpacing: 0 },
  /** A control's label, and the emphasised half of a label/value pair. */
  label: { fontFamily: fontFamily.semibold, fontSize: 14, lineHeight: 18, letterSpacing: 0 },
  /** Helper text, units, timestamps. */
  caption: { fontFamily: fontFamily.regular, fontSize: 13, lineHeight: 18, letterSpacing: 0 },
} as const

/**
 * Applied alongside a type style wherever amounts are listed one above another.
 *
 * Proportional digits vary in width, so a column of amounts fails to align on the decimal
 * point and becomes materially harder to scan — which matters more here than in most apps,
 * because comparing amounts down a history list is the primary reading task.
 */
export const tabularNumbers: TextStyle = { fontVariant: ['tabular-nums'] }
