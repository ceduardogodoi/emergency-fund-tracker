import type { ReactNode } from 'react'
import { Text as RNText, StyleSheet, type TextStyle } from 'react-native'

import { color, tabularNumbers, typography } from '@/ui/tokens'

/** The type styles a caller may ask for, named for the job each does. */
export type TextVariant = keyof typeof typography

/**
 * Every foreground text may take.
 *
 * The `on*` tones are the foregrounds audited against the matching fill, and are legal
 * only on that fill — `onNegative` on the page would be white on white. They exist as
 * tones rather than as a raw colour prop so that `Button` can hand its label the correct
 * foreground without any component gaining the ability to name a colour of its own.
 * `Button` is their only caller, and it takes the fill and the tone from a single table so
 * the two cannot be mismatched.
 */
const TONES = {
  primary: color.text.primary,
  secondary: color.text.secondary,
  accent: color.text.accent,
  positive: color.text.positive,
  negative: color.text.negative,
  onAccent: color.filled.accent.text,
  onPositive: color.filled.positive.text,
  onNegative: color.filled.negative.text,
} as const

/** The foreground roles text may take. See {@link TONES}. */
export type TextTone = keyof typeof TONES

/** Props for {@link Text}. */
export interface TextProps {
  /** The text to render. */
  readonly children: ReactNode
  /** Which type style to use. Defaults to `body`. */
  readonly variant?: TextVariant
  /** Which foreground to use. Defaults to `primary`. */
  readonly tone?: TextTone
  /**
   * Render digits at a fixed width so amounts in a column align on the decimal separator.
   * Set it wherever amounts are listed one above another.
   */
  readonly numeric?: boolean
  /** Caps the rendered lines, truncating with an ellipsis beyond it. */
  readonly numberOfLines?: number
  /**
   * Announces this text as a heading, letting a screen reader jump between the sections of
   * a screen instead of reading it top to bottom.
   *
   * Narrowed to the one role text may claim, because a heading is a structural promise
   * rather than a size: text that merely looks large is not a heading, and a `variant` is
   * not enough to infer one. `Screen` sets it for a screen title; a section heading inside
   * a screen sets it itself.
   */
  readonly accessibilityRole?: 'header'
  /** Exposes the element to tests. */
  readonly testID?: string
}

/**
 * The only way text is drawn in this app.
 *
 * A bare `<Text>` is already correct — body copy in the primary tone — so reaching for a
 * variant is a deliberate act rather than the cost of getting a legible default. Nothing
 * here accepts a raw size or colour: the lint rule in `eslint.config.mjs` would reject the
 * literal, and the contrast audit only covers pairs the tokens actually contain.
 *
 * @param props - See {@link TextProps}
 * @returns The rendered text
 */
export function Text({
  children,
  variant = 'body',
  tone = 'primary',
  numeric = false,
  numberOfLines,
  accessibilityRole,
  testID,
}: TextProps): ReactNode {
  return (
    <RNText
      style={[styles[variant], { color: TONES[tone] }, numeric && tabularNumbers]}
      // `undefined` rather than a default: React Native treats any number as a cap, so a
      // fallback here would silently truncate text the caller never asked to limit.
      numberOfLines={numberOfLines}
      accessibilityRole={accessibilityRole}
      testID={testID}
    >
      {children}
    </RNText>
  )
}

/**
 * Built once at module load rather than per render. Spelling the variants out individually
 * keeps `styles` indexable by `TextVariant` without a cast.
 */
const styles: Record<TextVariant, TextStyle> = StyleSheet.create({
  display: typography.display,
  title: typography.title,
  heading: typography.heading,
  body: typography.body,
  label: typography.label,
  caption: typography.caption,
})
