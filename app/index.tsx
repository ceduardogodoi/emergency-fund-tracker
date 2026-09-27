import { Redirect, useRouter } from 'expo-router'
import type { ReactNode } from 'react'

import { toViewState } from '@/runtime/query'
import { useServices } from '@/runtime/services-context'
import type { Goal } from '@/domain/goal/types'
import type { ProgressSummary } from '@/domain/ledger/types'
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
 * and the question a returning user opens the app with is how far along they are.
 */
function StandingView({ standing }: StandingViewProps): ReactNode {
  const router = useRouter()
  return (
    <>
      <StandingCard progress={standing.progress} />
      <Button
        label={strings.home.contributeAction}
        onPress={() => {
          router.push('/entries/contribute')
        }}
        testID="contribute"
      />
      <GoalCard goal={standing.goal} />
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

/** Props for {@link GoalCard}. */
interface GoalCardProps {
  readonly goal: Goal
}

/**
 * The target, with the choice behind it.
 *
 * The level and duration are shown alongside the figure because a target on its own is a
 * number the user cannot evaluate — FR-004's derivation, kept visible after setup rather
 * than only during it.
 */
function GoalCard({ goal }: GoalCardProps): ReactNode {
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
      {/* The duration the target buys, as units to count. Every unit is filled because
          this is the plan, not progress against it — T157 turns the filled count into the
          months the balance actually covers, and gives the caption the second number. */}
      <CoverageMeter covered={goal.coverageMonths} total={goal.coverageMonths} />
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
