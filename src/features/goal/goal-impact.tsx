import type { ReactNode } from 'react'

import { useServices } from '@/runtime/services-context'
import { compare, subtract, type Money } from '@/domain/money/money'
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
 * that moved from seventeen, and the figure on its own does not say which happened.
 *
 * Renders nothing while the draft still matches what is stored. A panel reading "no change"
 * on arrival is a line the user has to read past on every visit to learn nothing.
 *
 * It says nothing about progress, which FR-006 also asks for. That needs a balance, and the
 * ledger arrives with User Story 2 — until then the repository fails every call rather than
 * returning a plausible zero, and a percentage computed from a balance the app cannot read
 * would be a number invented for the sake of the requirement.
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
    </Card>
  )
}
