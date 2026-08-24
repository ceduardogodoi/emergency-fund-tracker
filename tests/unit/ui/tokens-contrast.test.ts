import { contrastRatio } from '@tests/support/contrast'
import { color } from '@/ui/tokens'

/**
 * Constitution Principle VI and FR-049: 4.5:1 minimum text contrast, audited here rather
 * than by eye. The pairs are derived from the token structure itself, so a colour added
 * to the palette is audited the moment it exists — there is no list to keep in sync.
 *
 * WCAG separates two thresholds and so does this file:
 *   - 4.5:1 for text (SC 1.4.3)
 *   - 3:1 for the boundary of a control you must see to operate (SC 1.4.11)
 */

/** Text contrast minimum, WCAG 2.1 SC 1.4.3 at Level AA. */
const TEXT_MINIMUM = 4.5

/** Non-text contrast minimum, WCAG 2.1 SC 1.4.11 at Level AA. */
const NON_TEXT_MINIMUM = 3

/** Every foreground/background pair the palette permits text to be drawn in. */
const textPairs = [
  ...Object.entries(color.text).flatMap(([textName, foreground]) =>
    Object.entries(color.background).map(([backgroundName, background]) => ({
      name: `text.${textName} on background.${backgroundName}`,
      foreground,
      background,
    })),
  ),
  ...Object.entries(color.filled).map(([name, pair]) => ({
    name: `filled.${name}`,
    foreground: pair.text,
    background: pair.background,
  })),
]

/** Control boundaries, which must be visible but are not text. */
const boundaryPairs = Object.entries(color.boundary).flatMap(([boundaryName, foreground]) =>
  Object.entries(color.background).map(([backgroundName, background]) => ({
    name: `boundary.${boundaryName} on background.${backgroundName}`,
    foreground,
    background,
  })),
)

describe('design token contrast', () => {
  // Without this, emptying a token group would make every `it.each` below vacuous and
  // the suite would report success for a palette it never looked at.
  it('derives pairs from the palette rather than a hand-written list', () => {
    expect(textPairs.length).toBeGreaterThanOrEqual(Object.keys(color.text).length)
    expect(boundaryPairs.length).toBeGreaterThan(0)
  })

  describe('text', () => {
    it.each(textPairs)('$name meets 4.5:1', ({ foreground, background }) => {
      expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(TEXT_MINIMUM)
    })
  })

  describe('control boundaries', () => {
    it.each(boundaryPairs)('$name meets 3:1', ({ foreground, background }) => {
      expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(NON_TEXT_MINIMUM)
    })

    // `divider` is decorative — a hairline between rows that spacing already separates.
    // WCAG 1.4.11 exempts it, and holding it to 3:1 would force a heavier rule than the
    // design wants. It lives outside `boundary` precisely so a control cannot reach for
    // it by habit: anything that must be seen to be operated is in the audited group.
    it('keeps the divider outside the audited group, and lighter than any boundary', () => {
      const divider = contrastRatio(color.divider, color.background.page)
      const weakestBoundary = Math.min(
        ...Object.values(color.boundary).map((edge) => contrastRatio(edge, color.background.page)),
      )
      expect(divider).toBeLessThan(weakestBoundary)
    })
  })
})
