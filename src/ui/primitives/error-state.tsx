import type { ReactNode } from 'react'
import { StyleSheet, View, type ViewStyle } from 'react-native'

import { Button } from '@/ui/primitives/button'
import { Text } from '@/ui/primitives/text'
import { strings } from '@/ui/strings'
import { spacing } from '@/ui/tokens'

/** Props for {@link ErrorState}. */
export interface ErrorStateProps {
  /**
   * Called when the user asks to try again.
   *
   * Omitted when retrying cannot help — a failure the same call would reproduce. The
   * button then does not render at all, because a control that presses and changes nothing
   * is worse than its absence.
   */
  readonly retry?: (() => void) | undefined
}

/**
 * The shared error treatment, used by {@link StateView} when a screen does not supply one
 * of its own.
 *
 * The copy says what happened and what to do about it. No error code reaches the reader:
 * `AppError`'s `kind` exists for the caller's branching, and a screen that shows it has
 * handed the user a string they can do nothing with.
 *
 * @param props - See {@link ErrorStateProps}
 * @returns The rendered error state
 */
export function ErrorState({ retry }: ErrorStateProps): ReactNode {
  return (
    <View style={styles.container}>
      <Text variant="heading">{strings.state.errorTitle}</Text>
      <Text tone="secondary">{strings.state.errorBody}</Text>
      {retry === undefined ? null : (
        <Button label={strings.action.retry} variant="secondary" onPress={retry} />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    gap: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  } satisfies ViewStyle,
})
