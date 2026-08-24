/**
 * Type styles, named for the job each does rather than its size.
 *
 * Sizes are unscaled base values. React Native multiplies them by the reader's text-size
 * setting at render time, which is why nothing here caps a size and why no layout may
 * assume a line's height — T147 tests every screen at the largest supported setting.
 *
 * `lineHeight` is set on every style rather than left to the platform default, which
 * differs between iOS and Android and would otherwise make the same screen a different
 * height on each.
 */
export const typography = {
  /** The balance on Home — the one number the screen exists to show. */
  display: { fontSize: 34, lineHeight: 41, fontWeight: '700' },
  /** A screen title. */
  title: { fontSize: 24, lineHeight: 30, fontWeight: '700' },
  /** A section or card heading. */
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '600' },
  /** Body copy. */
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' },
  /** A control's label, and the emphasised half of a label/value pair. */
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  /** Helper text, units, timestamps. */
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
} as const

/**
 * Applied alongside a type style wherever amounts are listed one above another.
 *
 * Proportional digits vary in width, so a column of amounts fails to align on the decimal
 * point and becomes materially harder to scan — which matters more here than in most apps,
 * because comparing amounts down a history list is the primary reading task.
 */
export const tabularNumbers = { fontVariant: ['tabular-nums'] } as const
