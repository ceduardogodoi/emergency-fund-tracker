import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native'

import { queryKeys } from '@/runtime/query'
import { useServices } from '@/runtime/services-context'
import type { MilestoneThreshold } from '@/domain/ledger/types'
import { Card, Text } from '@/ui/primitives'
import { strings } from '@/ui/strings'
import { borderWidth, color, minimumTouchTarget, opacity, spacing } from '@/ui/tokens'

/**
 * The milestone the last save crossed (FR-024), on the screen the user lands on.
 *
 * Saving an entry always leaves the screen it was saved on, so the acknowledgement has to
 * wait for the next one: Home after a contribution, the history after a correction. The
 * save path puts the threshold in the cache; this shows it until it is dismissed.
 *
 * Memory only, on purpose. The crossing is on record in `milestone_ack` the moment it is
 * saved, which is what keeps it from being acknowledged twice. This is just the news of it,
 * and news that outlived a restart would be a second acknowledgement of one crossing.
 *
 * Renders nothing when there is nothing to say.
 *
 * Closed from a control beside the heading rather than a full-width button below the text:
 * in Home's fullest state the button's height was part of what pushed Withdraw below the
 * fold on a 6.1-inch iPhone (specs/002-drawer-navigation, T179).
 *
 * @returns The banner, or nothing
 */
export function MilestoneBanner(): ReactNode {
  const { format } = useServices()
  const queryClient = useQueryClient()
  const reached = useQuery<MilestoneThreshold | null>({
    queryKey: queryKeys.milestoneReached(),
    // Nothing to read: the value only ever arrives from the save path. Never stale and
    // never collected, so a value set while no screen shows it waits for the one that will.
    queryFn: () => null,
    staleTime: Infinity,
    gcTime: Infinity,
  })
  const threshold = reached.data ?? null
  if (threshold === null) {
    return null
  }

  return (
    <Card testID="milestone-banner">
      <View style={styles.headingRow} testID="milestone-heading-row">
        <View style={styles.heading}>
          <Text variant="heading" accessibilityRole="header">
            {strings.milestones.title(threshold, format.percent(threshold))}
          </Text>
        </View>
        <CloseButton
          onPress={() => {
            queryClient.setQueryData<MilestoneThreshold | null>(queryKeys.milestoneReached(), null)
          }}
        />
      </View>
      <Text tone="secondary">{strings.milestones.body(threshold)}</Text>
    </Card>
  )
}

/** Props for {@link CloseButton}. */
interface CloseButtonProps {
  readonly onPress: () => void
}

/**
 * Dismisses the banner. A cross drawn as two crossed bars at token sizes, the way the menu
 * button draws its three: no icon package for one glyph. The bars are decoration; the
 * accessible name, "Fechar", carries the meaning, and the control keeps the full touch
 * target however small the glyph.
 */
function CloseButton({ onPress }: CloseButtonProps): ReactNode {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={strings.milestones.dismiss}
      onPress={onPress}
      testID="milestone-dismiss"
      style={({ pressed }) => [styles.close, pressed && styles.pressed]}
    >
      <View style={[styles.crossBar, styles.crossForward]} />
      <View style={[styles.crossBar, styles.crossBackward]} />
    </Pressable>
  )
}

/** The cross's arm length: half the touch target, as the menu button's bars are. */
const CROSS_LENGTH = minimumTouchTarget / 2

const styles = StyleSheet.create({
  headingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  } satisfies ViewStyle,
  // Shrinks and wraps beside the control rather than pushing it off the card.
  heading: { flexShrink: 1, flexGrow: 1 } satisfies ViewStyle,
  close: {
    width: minimumTouchTarget,
    height: minimumTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  } satisfies ViewStyle,
  pressed: { opacity: opacity.pressed },
  // Both bars are laid over each other at the centre, then turned.
  crossBar: {
    position: 'absolute',
    width: CROSS_LENGTH,
    height: borderWidth.emphasis,
    backgroundColor: color.text.primary,
  } satisfies ViewStyle,
  crossForward: { transform: [{ rotate: '45deg' }] } satisfies ViewStyle,
  crossBackward: { transform: [{ rotate: '-45deg' }] } satisfies ViewStyle,
})
