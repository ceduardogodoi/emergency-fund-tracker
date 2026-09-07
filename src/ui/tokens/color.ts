/**
 * The palette. Every colour in the app is one of these values — the ESLint rule in
 * `eslint.config.mjs` bans hex and `rgb()` literals everywhere except this directory.
 *
 * Names describe the role a colour plays, not the colour it is. `text.negative` stays
 * correct if the red is retuned; `text.red` would not. Every pair below is audited at
 * WCAG 2.1 AA by `tests/unit/ui/tokens-contrast.test.ts`, which derives the pairs from
 * this structure — adding a colour here adds it to the audit automatically.
 *
 * The direction is Brazilian concretism: a cool concrete ground, white slabs cut out of
 * it, and exactly one saturated colour. Ultramarine is the app's only voice — it marks
 * the action to take and the months already covered, and nothing else. A palette with one
 * accent cannot use colour decoratively, which is the point: when the blue appears, it
 * means something. Two occurrences on a screen is the ceiling.
 *
 * There is one palette. A dark theme appears nowhere in spec.md, so building the
 * indirection for one now would be speculation; the semantic naming is what makes
 * adding it later a change to this file rather than to every component.
 */
export const color = {
  /** Surfaces text is drawn on, from the page itself down to a recessed well. */
  background: {
    /** The page: cool concrete, so a white surface reads as something laid on top of it. */
    page: '#EDEEEC',
    /** A slab cut from the page — cards and inputs. Separated by value, never by shadow. */
    card: '#FFFFFF',
    /** A recessed well — an unfilled unit in a meter, an inactive segment. */
    sunken: '#DFE1DE',
  },

  /** Foregrounds, each legal on every `background` value above. */
  text: {
    /** Body copy and headings. */
    primary: '#141821',
    /** Supporting copy — captions, helper text, units. */
    secondary: '#4C5157',
    /** Links and emphasis. The single accent. */
    accent: '#1B34C4',
    /** A contribution, or progress gained. Never the only signal — see FR-049. */
    positive: '#136B43',
    /** A withdrawal, an error, or a shortfall. Never the only signal. */
    negative: '#A3231B',
  },

  /**
   * Solid fills that carry their own foreground. The two travel together so a caller
   * cannot pair a fill with text that was never audited against it.
   */
  filled: {
    /** The primary action, and a covered month in a meter. */
    accent: { background: '#1B34C4', text: '#FFFFFF' },
    /** A confirmed positive outcome — goal reached. */
    positive: { background: '#136B43', text: '#FFFFFF' },
    /** A destructive action — delete, erase, overdraw. */
    negative: { background: '#A3231B', text: '#FFFFFF' },
  },

  /**
   * Edges a user must see in order to operate the control they belong to. Audited at
   * 3:1 per WCAG 2.1 SC 1.4.11.
   */
  boundary: {
    /** The edge of an input, checkbox, or unfilled button. */
    control: '#6B7078',
    /** The focus indicator the constitution requires on every interactive element. */
    focus: '#1B34C4',
  },

  /**
   * A decorative hairline between rows that spacing already separates. Deliberately not
   * in `boundary`: it is exempt from the 3:1 floor, so nothing that must be seen to be
   * operated may use it.
   */
  divider: '#D5D7D3',

  /**
   * The dim drawn over the page behind a modal sheet.
   *
   * Eight-digit hex: the alpha is the whole point, since the scrim has to read as the same
   * screen pushed back rather than as a new one. Outside the audited groups because it is
   * never a foreground — nothing is drawn on it, and the sheet above it brings its own
   * background, whose pairs are audited. Its own contrast obligation is the opposite of
   * text's: it must be dark enough that the sheet is clearly in front.
   */
  scrim: '#141821B3',
} as const
