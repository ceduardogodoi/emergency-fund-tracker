import type { ReactNode } from 'react'
import { StyleSheet, View, type ViewStyle } from 'react-native'

import { color, elevation, radius, spacing } from '@/ui/tokens'

/** Props for {@link Card}. */
export interface CardProps {
  /** The content the card groups. */
  readonly children: ReactNode
  /** Exposes the element to tests. */
  readonly testID?: string
}

/**
 * A raised surface grouping related content on the page.
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
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    ...elevation.raised,
  } satisfies ViewStyle,
})
