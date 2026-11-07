import { Redirect, useRouter } from 'expo-router'
import type { ReactNode } from 'react'

import { toViewState } from '@/runtime/query'
import { useServices } from '@/runtime/services-context'
import { monthKey } from '@/domain/dates/calendar-date'
import type { RecoveryEstimate, RecoveryState } from '@/domain/forecast/recovery'
import type { Goal } from '@/domain/goal/types'
import type { ProgressSummary } from '@/domain/ledger/types'
import { MilestoneBanner } from '@/features/progress/milestone-banner'
import { useStanding, type Standing } from '@/features/progress/use-standing'
import {
  Button,
  Card,
  CoverageMeter,
  ErrorState,
  LoadingState,
  Screen,
  StateView,
  Text,
} from '@/ui/primitives'
import { strings } from '@/ui/strings'

/** Where a user with no goal is sent. Setup is not optional — nothing works without a target. */
const ONBOARDING = '/onboarding/expenses'

/**
 * Home: where the fund stands, and the target it stands against (FR-013, FR-015).
 *
 * This is also where first launch is decided. No stored goal means setup never finished,
 * which is the only definition that survives the app being deleted and reinstalled with
 * its data restored — a flag saying "onboarding done" would not.
 *
 * The redirect lives here rather than in the root layout because `/` is the route that
 * owns the question. A guard in the layout would have to run on every screen, including
 * the onboarding screens it sends people to, and know which of them to leave alone.
 *
 * @returns The rendered screen
 */
export default function HomeScreen(): ReactNode {
  const standing = useStanding()
  const state = toViewState(standing, (data) => data === null)

  return (
    <Screen title={strings.home.title}>
      <StateView
        state={state}
        loading={() => <LoadingState />}
        empty={() => <Redirect href={ONBOARDING} />}
        error={(_error, retry) => <ErrorState retry={retry} />}
        // Null is what `empty` above is for, so this branch cannot be reached. The
        // compiler asks for it because the query's type admits it, and answering with the
        // redirect rather than a cast keeps the impossible case correct if it ever stops
        // being impossible.
        ready={(stored) =>
          stored === null ? <Redirect href={ONBOARDING} /> : <StandingView standing={stored} />
        }
      />
    </Screen>
  )
}

/** Props for {@link StandingView}. */
interface StandingViewProps {
  readonly standing: Standing
}

/**
 * The fund's position, the way in to change it, and the goal it is measured against.
 *
 * The balance leads because it is what moves: the target changes rarely and on purpose,
 * and the question a returning user opens the app with is how far along they are. Above it,
 * only a milestone the last contribution crossed (FR-024), since that is news about the
 * figure below it. Below it, after a withdrawal, what is left to restore (FR-018), which is
 * the other half of the same news.
 */
function StandingView({ standing }: StandingViewProps): ReactNode {
  const router = useRouter()
  return (
    <>
      <MilestoneBanner />
      <StandingCard progress={standing.progress} />
      <RecoveryCard recovery={standing.recovery} />
      <Button
        label={strings.home.contributeAction}
        onPress={() => {
          router.push('/entries/contribute')
        }}
        testID="contribute"
      />
      <Button
        label={strings.home.withdrawAction}
        variant="secondary"
        onPress={() => {
          router.push('/entries/withdraw')
        }}
        testID="withdraw"
      />
      <Destinations />
      <GoalCard goal={standing.goal} monthsCovered={standing.monthsCovered} />
      {/* Below the goal, last: optional, and set once rather than visited (Story 6). */}
      <Button
        label={strings.home.remindersAction}
        variant="secondary"
        onPress={() => {
          router.push('/settings/reminders')
        }}
        testID="reminders"
      />
    </>
  )
}

/** The screens that read the same fund from other angles: its history, its statistics, and its forecast. */
function Destinations(): ReactNode {
  const router = useRouter()
  return (
    <>
      <Button
        label={strings.home.historyAction}
        variant="secondary"
        onPress={() => {
          router.push('/entries')
        }}
        testID="history"
      />
      <Button
        label={strings.statistics.action}
        variant="secondary"
        onPress={() => {
          router.push('/statistics')
        }}
        testID="statistics"
      />
      <Button
        label={strings.forecast.action}
        variant="secondary"
        onPress={() => {
          router.push('/forecast')
        }}
        testID="forecast"
      />
    </>
  )
}

/** Props for {@link StandingCard}. */
interface StandingCardProps {
  readonly progress: ProgressSummary
}

/** The balance, the share of the target it represents, and what is left or passed. */
function StandingCard({ progress }: StandingCardProps): ReactNode {
  const { format } = useServices()
  return (
    <Card testID="standing-card">
      <Text variant="label" tone="secondary">
        {strings.home.balanceLabel}
      </Text>
      <Text variant="display" numeric testID="balance-amount">
        {format.money(progress.balance)}
      </Text>
      <Text tone="secondary">
        {strings.home.progress(format.percent(progress.percentComplete))}
      </Text>
      <StandingLine progress={progress} />
    </Card>
  )
}

/**
 * What is left, or that nothing is (FR-015).
 *
 * Reached is said in words, not only in the positive colour, so it reaches a screen reader
 * and a reader who does not see green (FR-049). The surplus appears only when there is one:
 * at exactly the target, "R$ 0,00 além da meta" would be a sentence about nothing.
 */
function StandingLine({ progress }: StandingCardProps): ReactNode {
  const { format } = useServices()
  if (!progress.isReached) {
    return <Text>{strings.home.remaining(format.money(progress.remaining))}</Text>
  }
  return (
    <>
      <Text variant="label" tone="positive">
        {strings.home.reached}
      </Text>
      {progress.surplus > 0 ? (
        <Text>{strings.home.surplus(format.money(progress.surplus))}</Text>
      ) : null}
    </>
  )
}

/** Props for {@link RecoveryCard}. */
interface RecoveryCardProps {
  readonly recovery: RecoveryState
}

/**
 * What withdrawals have left to restore, and how long restoring it will take (FR-018).
 *
 * Nothing at all until there is something to restore. In the secondary voice, never the
 * negative one: taking money out is what the fund is for, and the card says how it comes
 * back rather than what was lost.
 */
function RecoveryCard({ recovery }: RecoveryCardProps): ReactNode {
  const { format } = useServices()
  if (recovery.kind === 'none') {
    return null
  }
  return (
    <Card testID="recovery-card">
      <Text variant="label" tone="secondary">
        {strings.recovery.label}
      </Text>
      <Text variant="title" numeric testID="shortfall-amount">
        {format.money(recovery.shortfall)}
      </Text>
      <Text variant="caption" tone="secondary">
        {strings.recovery.explanation}
      </Text>
      <RecoveryLine estimate={recovery.estimate} />
    </Card>
  )
}

/** Props for {@link RecoveryLine}. */
interface RecoveryLineProps {
  readonly estimate: RecoveryEstimate
}

/**
 * When the fund will be back, with the pace that says so — or why that cannot be said yet,
 * as the forecast says it (FR-029, FR-030).
 */
function RecoveryLine({ estimate }: RecoveryLineProps): ReactNode {
  const { format } = useServices()
  switch (estimate.kind) {
    case 'projected':
      return (
        <Text>
          {strings.recovery.estimate(
            format.money(estimate.pace),
            estimate.paceMonths,
            estimate.monthsToTarget,
            format.month(monthKey(estimate.projectedDate)),
          )}
        </Text>
      )
    case 'insufficient-history':
      return <Text tone="secondary">{strings.recovery.insufficient(estimate.monthsNeeded)}</Text>
    case 'no-pace':
      return <Text tone="secondary">{strings.recovery.noPace}</Text>
  }
}

/** Props for {@link GoalCard}. */
interface GoalCardProps {
  readonly goal: Goal
  /** Whole months the balance covers, capped at the plan. */
  readonly monthsCovered: number
}

/**
 * The target, with the choice behind it, and how much of it the balance already covers.
 *
 * The level and duration are shown alongside the figure because a target on its own is a
 * number the user cannot evaluate — FR-004's derivation, kept visible after setup rather
 * than only during it. The meter draws the plan as months and fills the ones the balance
 * pays for, with the caption saying both numbers for a reader who cannot see it.
 */
function GoalCard({ goal, monthsCovered }: GoalCardProps): ReactNode {
  const { format } = useServices()
  const router = useRouter()
  return (
    <Card testID="goal-card">
      <Text variant="label" tone="secondary">
        {strings.goal.targetLabel}
      </Text>
      <Text variant="title" numeric testID="goal-amount">
        {format.money(goal.target)}
      </Text>
      <CoverageMeter covered={monthsCovered} total={goal.coverageMonths} testID="coverage-meter" />
      <Text variant="caption" tone="secondary">
        {strings.home.coverage(monthsCovered, strings.coverageDuration(goal.coverageMonths))}
      </Text>
      <Text variant="caption" tone="secondary">
        {strings.goal.levelSummary(
          strings.levels[goal.levelKey].name,
          strings.coverageDuration(goal.coverageMonths),
        )}
      </Text>
      <Button
        label={strings.home.reviseAction}
        variant="secondary"
        onPress={() => {
          router.push('/settings/goal')
        }}
        testID="revise-goal"
      />
    </Card>
  )
}
