import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { queryKeys } from '@/runtime/query'
import { useServices } from '@/runtime/services-context'
import type { MilestoneThreshold } from '@/domain/ledger/types'
import { Button, Card, Text } from '@/ui/primitives'
import { strings } from '@/ui/strings'

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
      <Text variant="heading" accessibilityRole="header">
        {strings.milestones.title(threshold, format.percent(threshold))}
      </Text>
      <Text tone="secondary">{strings.milestones.body(threshold)}</Text>
      <Button
        label={strings.milestones.dismiss}
        variant="secondary"
        onPress={() => {
          queryClient.setQueryData<MilestoneThreshold | null>(queryKeys.milestoneReached(), null)
        }}
        testID="milestone-dismiss"
      />
    </Card>
  )
}
