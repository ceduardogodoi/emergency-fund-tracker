import { Redirect, useRouter } from 'expo-router'
import type { ReactNode } from 'react'

import { toViewState } from '@/runtime/query'
import { useServices } from '@/runtime/services-context'
import type { Goal } from '@/domain/goal/types'
import { useGoal } from '@/features/goal/hooks'
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
 * Home: the target, and later the progress towards it.
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
  const goal = useGoal()
  const state = toViewState(goal, (data) => data === null)

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
          stored === null ? <Redirect href={ONBOARDING} /> : <GoalCard goal={stored} />
        }
      />
    </Screen>
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
      <Text variant="display" numeric testID="goal-amount">
        {format.money(goal.target)}
      </Text>
      {/* The duration the target buys, as units to count. Every unit is filled because
          this is the plan, not progress against it — once the ledger exists (US2) the
          filled count becomes the months the balance actually covers, and the caption
          below it gains the second number. */}
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
