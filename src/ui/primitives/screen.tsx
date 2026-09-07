import type { ReactNode } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native'
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

/** The keyboard-avoiding container, for the test that asserts each platform avoids once. */
export const SCREEN_KEYBOARD_TEST_ID = 'screen-keyboard'

/**
 * How the screen gets out of the keyboard's way, which is not the same job on each platform.
 *
 * iOS is handled by the scroll view itself: `automaticallyAdjustKeyboardInsets` insets the
 * content by the keyboard's height, so nothing here has to. Passing a behaviour as well
 * would apply the inset twice and leave a gap the height of the keyboard above it.
 *
 * Android gets `padding`, because the window no longer resizes. `edgeToEdgeEnabled` makes
 * the app draw behind the system bars, and the keyboard arrives as an inset the app is
 * expected to consume rather than as a smaller window — so the layout is unchanged and the
 * keyboard simply covers whatever was at the bottom. Padding the container reproduces the
 * resize the window used to do, and the scroll view then brings the focused field back
 * into view the way it does on any Android screen.
 *
 * `babel-preset-expo` folds this to a constant per platform bundle, so whichever branch is
 * not the running platform's does not exist at runtime — which is why the component suite
 * can only ever assert the iOS half. The Android half is guarded on a device instead, by
 * `e2e/us1-set-target.yaml` typing into the override field with the keyboard up.
 */
const KEYBOARD_BEHAVIOR = Platform.OS === 'android' ? 'padding' : undefined

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
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={KEYBOARD_BEHAVIOR}
        testID={SCREEN_KEYBOARD_TEST_ID}
      >
        {scrolls ? (
          <ScrollView
            contentContainerStyle={styles.content}
            // Without this, the first tap on a control while the keyboard is open only
            // dismisses the keyboard — so "save" takes two presses and appears to have
            // ignored the first.
            keyboardShouldPersistTaps="handled"
            // Scrolling puts the keyboard away. A number pad has no return key to dismiss
            // it with, so on a screen taller than the viewport it otherwise sits over the
            // controls below the field for as long as the user is on that screen.
            keyboardDismissMode="on-drag"
            // iOS only, and half the story: it insets the content by the keyboard's
            // height so the field being typed into stays visible. Android is handled by
            // `KEYBOARD_BEHAVIOR` on the container above, for the reason documented there.
            automaticallyAdjustKeyboardInsets
            testID={SCREEN_SCROLL_TEST_ID}
          >
            {content}
          </ScrollView>
        ) : (
          <View style={[styles.content, styles.fill]}>{content}</View>
        )}
      </KeyboardAvoidingView>
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
    gap: spacing.lg,
    // Short content still fills the screen, so anything a screen stretches or pushes to
    // the bottom behaves the same whether or not the content happens to overflow.
    flexGrow: 1,
  } satisfies ViewStyle,
  fill: { flex: 1 } satisfies ViewStyle,
})
