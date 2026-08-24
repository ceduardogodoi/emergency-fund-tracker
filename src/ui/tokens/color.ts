/**
 * The palette. Every colour in the app is one of these values — the ESLint rule in
 * `eslint.config.mjs` bans hex and `rgb()` literals everywhere except this directory.
 *
 * Names describe the role a colour plays, not the colour it is. `text.negative` stays
 * correct if the red is retuned; `text.red` would not. Every pair below is audited at
 * WCAG 2.1 AA by `tests/unit/ui/tokens-contrast.test.ts`, which derives the pairs from
 * this structure — adding a colour here adds it to the audit automatically.
 *
 * There is one palette. A dark theme appears nowhere in spec.md, so building the
 * indirection for one now would be speculation; the semantic naming is what makes
 * adding it later a change to this file rather than to every component.
 */
export const color = {
  /** Surfaces text is drawn on, from the page itself down to a recessed well. */
  background: {
    /** The page. */
    page: '#FFFFFF',
    /** A card lifted off the page. */
    card: '#F4F6F8',
    /** A recessed well — input fields, inactive segments. */
    sunken: '#E7ECF0',
  },

  /** Foregrounds, each legal on every `background` value above. */
  text: {
    /** Body copy and headings. */
    primary: '#12171C',
    /** Supporting copy — captions, helper text, units. */
    secondary: '#4A5560',
    /** Links and emphasis. */
    accent: '#0B5FA5',
    /** A contribution, or progress gained. Never the only signal — see FR-049. */
    positive: '#1B6B3A',
    /** A withdrawal, an error, or a shortfall. Never the only signal. */
    negative: '#A32020',
  },

  /**
   * Solid fills that carry their own foreground. The two travel together so a caller
   * cannot pair a fill with text that was never audited against it.
   */
  filled: {
    /** The primary action. */
    accent: { background: '#0B5FA5', text: '#FFFFFF' },
    /** A confirmed positive outcome — goal reached. */
    positive: { background: '#1B6B3A', text: '#FFFFFF' },
    /** A destructive action — delete, erase, overdraw. */
    negative: { background: '#A32020', text: '#FFFFFF' },
  },

  /**
   * Edges a user must see in order to operate the control they belong to. Audited at
   * 3:1 per WCAG 2.1 SC 1.4.11.
   */
  boundary: {
    /** The edge of an input, checkbox, or unfilled button. */
    control: '#6B7580',
    /** The focus indicator the constitution requires on every interactive element. */
    focus: '#0B5FA5',
  },

  /**
   * A decorative hairline between rows that spacing already separates. Deliberately not
   * in `boundary`: it is exempt from the 3:1 floor, so nothing that must be seen to be
   * operated may use it.
   */
  divider: '#D8DEE4',
} as const
