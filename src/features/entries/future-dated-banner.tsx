import type { ReactNode } from 'react'

import { useFutureDatedEntries } from '@/features/entries/hooks'
import { Card, Text } from '@/ui/primitives'
import { strings } from '@/ui/strings'

/**
 * Says that some entries are dated after today, and what that means (FR-033).
 *
 * Every calculation leaves those entries out, so without this the balance would be short
 * of money the user remembers saving, with nothing on screen to say why. The copy says
 * where they are rather than listing them: the history is the most recent first, so they
 * are the rows directly below.
 *
 * Renders nothing while the check is running and nothing when it finds none, so the
 * screen does not flash a warning that turns out not to apply. A check that fails says so,
 * because silence there would read as "none".
 *
 * @returns The warning, the failure line, or nothing
 */
export function FutureDatedBanner(): ReactNode {
  const future = useFutureDatedEntries()

  if (future.isError) {
    return <Text tone="secondary">{strings.entries.futureDated.unavailable}</Text>
  }
  if (future.data === undefined || future.data.length === 0) {
    return null
  }

  const count = future.data.length
  return (
    <Card testID="future-dated-banner">
      <Text variant="label" tone="negative">
        {strings.entries.futureDated.title(count)}
      </Text>
      <Text>{strings.entries.futureDated.body(count)}</Text>
    </Card>
  )
}
