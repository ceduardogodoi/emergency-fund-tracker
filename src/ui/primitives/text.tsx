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
   * Centres the text, and stretches its box to the width the parent offers.
   *
   * The two travel together, and the second is not cosmetic. Android measures a
   * content-sized text box wrongly when the text carries a font the app loaded itself, and
   * paints only as much of the string as fits the width it got — no ellipsis, no clipped
   * glyph, just a sentence that stops. `Voltar à meta calculada` rendered as `Voltar à
   * meta` inside a button that centres its children, on a 411dp screen and not on a 456dp
   * one. Giving the box a definite width takes the measurement out of the equation.
   *
   * Which is why this is a prop rather than a style a caller passes: the workaround has to
   * be attached to the thing that needs it, or the next centred label will be truncated in
   * the same silent, device-dependent way.
   */
  readonly align?: 'center'
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
  align,
  accessibilityRole,
  testID,
}: TextProps): ReactNode {
  return (
    <RNText
      style={[
        styles[variant],
        { color: TONES[tone] },
        numeric && tabularNumbers,
        align === 'center' && CENTERED,
      ]}
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
 * What {@link TextProps.align} applies. Kept out of `styles` below, which is the map of
 * type styles and stays indexable by `TextVariant` alone: this is a modifier laid over a
 * variant, the same way `tabularNumbers` is, not a variant of its own.
 *
 * It stays here rather than joining `tabularNumbers` in the token module, even though the
 * two are applied identically. `tabularNumbers` is a typographic decision the design system
 * makes for the whole app; this is half layout and half a workaround for how Android
 * measures text, and a design system that carries workarounds in its vocabulary stops
 * describing the design.
 */
const CENTERED: TextStyle = { textAlign: 'center', alignSelf: 'stretch' }

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
