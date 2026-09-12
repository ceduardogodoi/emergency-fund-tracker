import { Redirect, useRouter } from 'expo-router'
import type { ReactNode } from 'react'

import { toViewState } from '@/runtime/query'
import { useServices } from '@/runtime/services-context'
import { GoalImpact } from '@/features/goal/goal-impact'
import { useStoredGoal, type StoredGoal } from '@/features/goal/hooks'
import { LevelOptions } from '@/features/goal/level-options'
import { TargetPreview } from '@/features/goal/target-preview'
import { storedGoalDraft, useGoalDraft, type GoalDraftState } from '@/features/goal/use-goal-draft'
import {
  Button,
  ErrorState,
  LoadingState,
  MoneyInput,
  Screen,
  StateView,
  Text,
} from '@/ui/primitives'
import { strings } from '@/ui/strings'

/** Where a user with no goal is sent. There is nothing to revise until setup has finished. */
const ONBOARDING = '/onboarding/expenses'

/**
 * Changing a goal that already exists (FR-006).
 *
 * The same three decisions the setup flow makes — expenses, duration, optional override —
 * over the figures already stored, which is why the state machine behind it is shared with
 * the level step rather than written twice. What is different is the starting point and the
 * consequence: the form opens on what is stored, and says what the change would cost before
 * it is made.
 *
 * @returns The rendered screen
 */
export default function GoalRevisionScreen(): ReactNode {
  const stored = useStoredGoal()
  const state = toViewState(stored, (data) => data === null)

  return (
    <Screen title={strings.revision.title}>
      <StateView
        state={state}
        loading={() => <LoadingState />}
        empty={() => <Redirect href={ONBOARDING} />}
        error={(_error, retry) => <ErrorState retry={retry} />}
        // Null is what `empty` above is for, so this branch cannot be reached. The compiler
        // asks for it because the query's type admits it, and answering with the redirect
        // rather than a cast keeps the impossible case correct if it stops being impossible.
        ready={(goal) =>
          goal === null ? <Redirect href={ONBOARDING} /> : <RevisionForm stored={goal} />
        }
      />
    </Screen>
  )
}

/** Props for {@link RevisionForm}. */
interface RevisionFormProps {
  readonly stored: StoredGoal
}

/**
 * The form itself, once there is a stored goal to open on.
 *
 * Separate from the screen so its hooks are never conditional, and so the draft is seeded
 * exactly once — at the moment the stored figures are known, rather than on a first render
 * that has nothing to seed from.
 */
function RevisionForm({ stored }: RevisionFormProps): ReactNode {
  const router = useRouter()
  const { format } = useServices()
  const draft = useGoalDraft(storedGoalDraft(stored.goal, stored.monthlyExpenses), () => {
    leaveRevision(router)
  })

  return (
    <>
      <Text tone="secondary">{strings.revision.intro}</Text>
      <MoneyInput
        label={strings.onboarding.expensesLabel}
        value={draft.monthlyExpenses}
        onChangeValue={draft.changeMonthlyExpenses}
        format={format.money}
        help={strings.onboarding.expensesHelp}
        error={draft.expensesError}
        required
        testID="expenses-input"
      />
      <LevelOptions
        selected={draft.levelKey}
        onSelect={draft.selectLevel}
        customMonths={draft.customMonths}
        onCustomMonthsChange={draft.changeCustomMonths}
        error={draft.coverageError}
      />
      {draft.target === null ? null : <RevisedTarget stored={stored} draft={draft} />}
      <Button
        label={strings.action.save}
        onPress={draft.save}
        disabled={draft.isSaving}
        testID="save-goal"
      />
      {/* Storage failed, rather than a figure being refused. The copy says what to do and
          the draft stays on screen, so nothing the user changed is lost. */}
      {draft.hasFailed ? <Text tone="negative">{strings.state.errorBody}</Text> : null}
    </>
  )
}

/**
 * Where the screen goes once the revision is saved.
 *
 * Back to wherever the user opened it from, which is Home in the one route that reaches it
 * today. The fallback is for arriving by deep link, where there is no history to return to
 * and `back()` would leave the app on a blank stack.
 *
 * @param router The router this screen is navigating with.
 */
function leaveRevision(router: ReturnType<typeof useRouter>): void {
  if (router.canGoBack()) {
    router.back()
    return
  }
  router.replace('/')
}

/** Props for {@link RevisedTarget}. */
interface RevisedTargetProps {
  readonly stored: StoredGoal
  readonly draft: GoalDraftState
}

/** The target as it would be, and what moving to it would change. */
function RevisedTarget({ stored, draft }: RevisedTargetProps): ReactNode {
  // Narrowed by the caller; repeated here because the type cannot carry that across a
  // component boundary, and a non-null assertion would be the same claim without the check.
  if (draft.target === null) {
    return null
  }

  return (
    <>
      <TargetPreview
        monthlyExpenses={draft.monthlyExpenses}
        coverageMonths={draft.coverageMonths}
        target={draft.target}
        override={draft.override}
        onOverrideChange={draft.changeOverride}
        error={draft.targetError}
      />
      <GoalImpact current={stored.goal.target} next={draft.target} />
    </>
  )
}
