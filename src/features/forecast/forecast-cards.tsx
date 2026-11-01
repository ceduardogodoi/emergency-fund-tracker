import { useRouter } from 'expo-router'
import type { ReactNode } from 'react'

import { useServices } from '@/runtime/services-context'
import { MINIMUM_PACE_MONTHS } from '@/domain/forecast/pace'
import type { ForecastState } from '@/domain/forecast/project'
import type { ProgressSummary } from '@/domain/ledger/types'
import { Button, Card, Text } from '@/ui/primitives'
import { strings } from '@/ui/strings'
import { DesiredReadout } from './desired-readout'
import type { DesiredDate, Forecast } from './hooks'

/** Props for {@link ForecastCard}. */
export interface ForecastCardProps {
  readonly forecast: Forecast
}

/**
 * The projection, or the reason there is none — one card per `ForecastState`.
 *
 * Exhaustive over the union, so a fifth state added in the domain fails to build here
 * rather than rendering nothing (ui-contract, screen inventory).
 *
 * @param props - See {@link ForecastCardProps}
 * @returns The rendered card
 */
export function ForecastCard({ forecast }: ForecastCardProps): ReactNode {
  const { state } = forecast
  switch (state.kind) {
    case 'projected':
      return <ProjectedCard state={state} progress={forecast.progress} />
    case 'insufficient-history':
      return <InsufficientHistoryCard state={state} />
    case 'no-pace':
      return <NoPaceCard />
    case 'reached':
      return <ReachedCard />
  }
}

/** Props for {@link ProjectedCard}. */
interface ProjectedCardProps {
  readonly state: Extract<ForecastState, { kind: 'projected' }>
  readonly progress: ProgressSummary
}

/**
 * The date, how far away it is, and the pace it assumes (FR-027, FR-028).
 *
 * The assumption sits directly under the date and is never optional: a date the user cannot
 * trace back to what they save each month is a number they cannot evaluate.
 */
function ProjectedCard({ state, progress }: ProjectedCardProps): ReactNode {
  const { format } = useServices()
  return (
    <Card testID="forecast-projected">
      <Text variant="label" tone="secondary">
        {strings.forecast.projectedLabel}
      </Text>
      <Text variant="display" numeric testID="projected-date">
        {format.date(state.projectedDate)}
      </Text>
      <Text>{strings.forecast.monthsAway(state.monthsToTarget)}</Text>
      <Text tone="secondary">
        {strings.forecast.assumption(format.money(state.pace), state.paceMonths)}
      </Text>
      <Text tone="secondary">{strings.home.remaining(format.money(progress.remaining))}</Text>
    </Card>
  )
}

/** Props for {@link InsufficientHistoryCard}. */
interface InsufficientHistoryCardProps {
  readonly state: Extract<ForecastState, { kind: 'insufficient-history' }>
}

/** How much more history a pace needs, rather than a projection from too little (FR-029). */
function InsufficientHistoryCard({ state }: InsufficientHistoryCardProps): ReactNode {
  return (
    <Card testID="forecast-insufficient">
      <Text variant="heading" accessibilityRole="header">
        {strings.forecast.insufficientTitle}
      </Text>
      <Text>{strings.forecast.insufficientBody(state.monthsNeeded)}</Text>
      <Text tone="secondary">
        {strings.forecast.insufficientHelp(MINIMUM_PACE_MONTHS, state.monthsAvailable)}
      </Text>
    </Card>
  )
}

/**
 * Why no date can be shown at a pace of zero or less, and the action that brings one back
 * (FR-030) — never an infinite, blank, or past date.
 */
function NoPaceCard(): ReactNode {
  const router = useRouter()
  return (
    <Card testID="forecast-no-pace">
      <Text variant="heading" accessibilityRole="header">
        {strings.forecast.noPaceTitle}
      </Text>
      <Text tone="secondary">{strings.forecast.noPaceBody}</Text>
      <Button
        label={strings.home.contributeAction}
        onPress={() => {
          router.push('/entries/contribute')
        }}
        testID="contribute"
      />
    </Card>
  )
}

/** Nothing left to project. Said in words, as Home says it. */
function ReachedCard(): ReactNode {
  return (
    <Card testID="forecast-reached">
      <Text variant="heading" tone="positive" accessibilityRole="header">
        {strings.home.reached}
      </Text>
      <Text tone="secondary">{strings.forecast.reachedBody}</Text>
    </Card>
  )
}

/** Props for {@link DesiredDateCard}. */
export interface DesiredDateCardProps {
  /** The stored desired date, or null when none is set. */
  readonly desired: DesiredDate | null
}

/**
 * The desired completion date and what it asks (FR-031), with the way to the goal screen
 * where it is set or changed.
 *
 * @param props - See {@link DesiredDateCardProps}
 * @returns The rendered card
 */
export function DesiredDateCard({ desired }: DesiredDateCardProps): ReactNode {
  const router = useRouter()
  return (
    <Card testID="forecast-desired">
      <Text variant="heading" accessibilityRole="header">
        {strings.forecast.desiredHeading}
      </Text>
      {desired === null ? (
        <Text tone="secondary">{strings.desiredDate.help}</Text>
      ) : (
        <DesiredReadout desired={desired} />
      )}
      <Button
        label={
          desired === null
            ? strings.forecast.desiredSetAction
            : strings.forecast.desiredChangeAction
        }
        variant="secondary"
        onPress={() => {
          router.push('/settings/goal')
        }}
        testID="desired-date-action"
      />
    </Card>
  )
}
