import type { ReactNode } from 'react'

import { useServices } from '@/runtime/services-context'
import { monthKey } from '@/domain/dates/calendar-date'
import { isPositive } from '@/domain/money/money'
import type { DesiredContribution, PaceComparison } from '@/domain/forecast/required'
import type { Formatters } from '@/ui/format'
import { Text } from '@/ui/primitives'
import { strings } from '@/ui/strings'
import type { DesiredDate } from './hooks'

/** Props for {@link DesiredReadout}. */
export interface DesiredReadoutProps {
  readonly desired: DesiredDate
}

/**
 * What a desired completion date asks (FR-031): the month, the contribution it requires, and
 * how that compares with the pace — or that the date has passed, or that nothing remains.
 *
 * Shared by the forecast and the goal screen, so the two say the same thing about the same
 * date in the same words.
 *
 * @param props - See {@link DesiredReadoutProps}
 * @returns The lines, without a surface — the caller decides where they sit
 */
export function DesiredReadout({ desired }: DesiredReadoutProps): ReactNode {
  const { format } = useServices()
  return (
    <>
      <Text>{strings.forecast.desiredTarget(format.month(monthKey(desired.date)))}</Text>
      <DesiredContributionLines contribution={desired.contribution} />
    </>
  )
}

/** Props for {@link DesiredContributionLines}. */
export interface DesiredContributionLinesProps {
  readonly contribution: DesiredContribution
}

/**
 * The required amount and its comparison, or why there is none — without the month, for a
 * screen that already shows it beside the control that chose it.
 *
 * @param props - See {@link DesiredContributionLinesProps}
 * @returns The lines
 */
export function DesiredContributionLines({
  contribution,
}: DesiredContributionLinesProps): ReactNode {
  const { format } = useServices()
  switch (contribution.kind) {
    case 'passed':
      return <Text tone="negative">{strings.forecast.desiredPassed}</Text>
    case 'covered':
      return <Text tone="secondary">{strings.forecast.desiredCovered}</Text>
    case 'required':
      return (
        <>
          <Text variant="heading" numeric>
            {strings.forecast.desiredRequired(format.money(contribution.amount))}
          </Text>
          <Text tone="secondary">{comparisonText(contribution.comparison, format)}</Text>
        </>
      )
  }
}

/**
 * The comparison in words. A pace of zero or less is not quoted as an amount: "above your
 * pace of -R$ 333,34" reads as a debt, and the sentence is about how the user saves.
 */
function comparisonText(comparison: PaceComparison, format: Formatters): string {
  switch (comparison.kind) {
    case 'unmeasured':
      return strings.forecast.desiredUnmeasured
    case 'within':
      return strings.forecast.desiredWithin(format.money(comparison.pace))
    case 'exceeds':
      return isPositive(comparison.pace)
        ? strings.forecast.desiredExceeds(format.money(comparison.pace))
        : strings.forecast.desiredExceedsNoPace
  }
}
