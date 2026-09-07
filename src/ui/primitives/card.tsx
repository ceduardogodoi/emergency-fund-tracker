import type { ReactNode } from 'react'
import { StyleSheet, View, type ViewStyle } from 'react-native'

import { color, radius, spacing } from '@/ui/tokens'

/** Props for {@link Card}. */
export interface CardProps {
  /** The content the card groups. */
  readonly children: ReactNode
  /** Exposes the element to tests. */
  readonly testID?: string
}

/**
 * A slab grouping related content on the page.
 *
 * It reads as a separate surface by value alone — white cut out of the concrete ground —
 * and casts no shadow. Nothing in this design language floats, so depth is not available
 * as a way to say "these things belong together"; the surface change has to carry it, and
 * a card that is not distinguishable from the page is a card that should not be there.
 *
 * The card fill is a distinct token rather than a tint of the page, because the contrast
 * audit checks every text colour against both surfaces — text that is legible on the page
 * but not on a card would otherwise ship unnoticed.
 *
 * @param props - See {@link CardProps}
 * @returns The rendered card
 */
export function Card({ children, testID }: CardProps): ReactNode {
  return (
    <View style={styles.card} testID={testID}>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.background.card,
    borderRadius: radius.none,
    padding: spacing.md,
    gap: spacing.sm,
  } satisfies ViewStyle,
})
