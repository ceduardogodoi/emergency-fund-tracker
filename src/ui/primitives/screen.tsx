import type { ReactNode } from 'react'
import { StyleSheet, type ViewStyle } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Text } from '@/ui/primitives/text'
import { color, screenInset, spacing } from '@/ui/tokens'

/** Props for {@link Screen}. */
export interface ScreenProps {
  /** The screen's content. */
  readonly children: ReactNode
  /**
   * The screen's title, rendered as a heading a screen reader can jump to.
   *
   * Optional because a screen presented inside a navigator may already have its title
   * drawn in the navigation bar, where the platform supplies the heading semantics.
   */
  readonly title?: string
  /** Exposes the element to tests. */
  readonly testID?: string
}

/**
 * The outermost element of every screen.
 *
 * Insets are taken from the safe-area context rather than assumed, so content clears the
 * notch, the home indicator, and Android's gesture bar without any screen knowing which
 * device it is on.
 *
 * @param props - See {@link ScreenProps}
 * @returns The rendered screen
 */
export function Screen({ children, title, testID }: ScreenProps): ReactNode {
  return (
    <SafeAreaView style={styles.screen} testID={testID}>
      {title === undefined ? null : (
        <Text variant="title" accessibilityRole="header">
          {title}
        </Text>
      )}
      {children}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: color.background.page,
    padding: screenInset,
    gap: spacing.md,
  } satisfies ViewStyle,
})
