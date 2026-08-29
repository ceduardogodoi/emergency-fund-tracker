import type { ReactNode } from 'react'
import { ActivityIndicator, StyleSheet, View, type ViewStyle } from 'react-native'

import { Text } from '@/ui/primitives/text'
import { strings } from '@/ui/strings'
import { spacing } from '@/ui/tokens'

/**
 * The shared loading treatment, used by {@link StateView} when a screen does not supply
 * one of its own.
 *
 * The spinner is marked decorative and the text carries the announcement, so a screen
 * reader says "Carregando" once rather than describing an animation.
 *
 * @returns The rendered loading state
 */
export function LoadingState(): ReactNode {
  return (
    <View style={styles.container}>
      <ActivityIndicator accessibilityElementsHidden importantForAccessibility="no" />
      <Text tone="secondary">{strings.state.loading}</Text>
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
