import type { ReactNode } from 'react'

import { useServices } from '@/runtime/services-context'
import { summarizeProgress } from '@/domain/ledger/progress'
import { compare, subtract, type Money } from '@/domain/money/money'
import { useBalance } from '@/features/entries/hooks'
import { Card, Text } from '@/ui/primitives'
import { strings } from '@/ui/strings'

/** Props for {@link GoalImpact}. */
export interface GoalImpactProps {
  /** The target as stored — what the fund is aiming at right now. */
  readonly current: Money
  /** The target the draft would save. */
  readonly next: Money
}

/**
 * What changing the goal would cost, stated before it is saved (FR-006).
 *
 * The new target is not repeated here: it is already the largest thing on the screen, in
 * the preview directly above. What this adds is the pair the user cannot see from that
 * figure alone — what they are aiming at today, and the size of the step between the two.
 * A target that moved from twelve thousand to eighteen is a different decision from one
 * that moved from seventeen, and the figure on its own does not say which happened. Then
 * what the step does to progress, which is the part a user feels.
 *
 * Renders nothing while the draft still matches what is stored. A panel reading "no change"
 * on arrival is a line the user has to read past on every visit to learn nothing.
 *
 * @param props - See {@link GoalImpactProps}
 * @returns The rendered impact, or nothing when there is none
 */
export function GoalImpact({ current, next }: GoalImpactProps): ReactNode {
  const { format } = useServices()
  if (current === next) {
    return null
  }

  const rising = compare(next, current) > 0
  // Subtracted in whichever order keeps it positive, so the amount is stated as a size and
  // the direction is carried by the words. A formatted negative reads as a debt.
  const difference = rising ? subtract(next, current) : subtract(current, next)

  return (
    <Card testID="goal-impact">
      <Text variant="label" tone="secondary">
        {strings.revision.currentTarget}
      </Text>
      <Text numeric testID="current-target">
        {format.money(current)}
      </Text>
      <Text variant="label" testID="goal-difference">
        {rising
          ? strings.revision.increase(format.money(difference))
          : strings.revision.decrease(format.money(difference))}
      </Text>
      <ProgressImpact current={current} next={next} />
    </Card>
  )
}

/**
 * The progress percentage against each target.
 *
 * Reads the balance here rather than through the screen's query. The goal can be revised
 * without it, so a ledger that cannot be read costs this line and not the screen — and the
 * line then says so, rather than computing a percentage from a balance nobody has.
 * While the balance is still loading it says nothing: the ledger is local and arrives at
 * once, and a placeholder would flash.
 */
function ProgressImpact({ current, next }: GoalImpactProps): ReactNode {
  const { format } = useServices()
  const balance = useBalance()

  if (balance.isError) {
    return <Text tone="secondary">{strings.revision.progressUnavailable}</Text>
  }
  if (balance.data === undefined) {
    return null
  }

  const before = format.percent(summarizeProgress(balance.data, current).percentComplete)
  const after = format.percent(summarizeProgress(balance.data, next).percentComplete)

  return (
    <Text testID="progress-difference">
      {before === after
        ? strings.revision.progressUnchanged(after)
        : strings.revision.progressChange(before, after)}
    </Text>
  )
}
