import type { ReactNode } from 'react'
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native'
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
  /**
   * Whether this screen scrolls. Defaults to true.
   *
   * Pass `false` only when the content brings its own scrolling container — a long list,
   * which has to virtualise rather than render every row. Nesting one inside a `ScrollView`
   * gives it unbounded height, so it renders everything and the virtualisation it exists
   * for stops happening.
   */
  readonly scrolls?: boolean
  /** Exposes the element to tests. */
  readonly testID?: string
}

/** The scrolling container, for tests that assert content is inside one. */
export const SCREEN_SCROLL_TEST_ID = 'screen-scroll'

/**
 * The outermost element of every screen.
 *
 * Insets are taken from the safe-area context rather than assumed, so content clears the
 * notch, the home indicator, and Android's gesture bar without any screen knowing which
 * device it is on.
 *
 * It scrolls by default, and that default is the point: a screen is a column of content
 * whose height depends on the device, the text size, and how much the user has entered.
 * Whether it *happens* to fit is not a property any screen can know about itself, and the
 * failure is silent — nothing is clipped or flagged, the last control is simply
 * unreachable, and only on some devices. FR-050 requires the same content to remain usable
 * at the largest supported text size, which is the same requirement seen from the other
 * end: text that grows has to have somewhere to go.
 *
 * @param props - See {@link ScreenProps}
 * @returns The rendered screen
 */
export function Screen({ children, title, scrolls = true, testID }: ScreenProps): ReactNode {
  const content = (
    <>
      {title === undefined ? null : (
        <Text variant="title" accessibilityRole="header">
          {title}
        </Text>
      )}
      {children}
    </>
  )

  return (
    <SafeAreaView style={styles.screen} testID={testID}>
      {scrolls ? (
        <ScrollView
          contentContainerStyle={styles.content}
          // Without this, the first tap on a control while the keyboard is open only
          // dismisses the keyboard — so "save" takes two presses and appears to have
          // ignored the first.
          keyboardShouldPersistTaps="handled"
          // iOS insets the content by the keyboard's height, so the field being typed into
          // stays visible. Android resizes the window instead, which this scrolls within.
          automaticallyAdjustKeyboardInsets
          testID={SCREEN_SCROLL_TEST_ID}
        >
          {content}
        </ScrollView>
      ) : (
        <View style={[styles.content, styles.fill]}>{content}</View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: color.background.page,
  } satisfies ViewStyle,
  // On the content rather than the container: padding on a scroll view's own box would sit
  // outside the scrollable area, so the last element would stop short of the bottom inset
  // instead of scrolling past it.
  content: {
    padding: screenInset,
    gap: spacing.md,
    // Short content still fills the screen, so anything a screen stretches or pushes to
    // the bottom behaves the same whether or not the content happens to overflow.
    flexGrow: 1,
  } satisfies ViewStyle,
  fill: { flex: 1 } satisfies ViewStyle,
})
