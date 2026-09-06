import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query'

import { queryKeys } from '@/runtime/query'
import { useServices } from '@/runtime/services-context'
import type { AppError } from '@/domain/errors'
import { submitGoal } from '@/domain/goal/submit-goal'
import type { Goal, GoalInput } from '@/domain/goal/types'
import type { Money } from '@/domain/money/money'
import type { Profile } from '@/domain/profile/types'
import { isErr, type Result } from '@/domain/result'

/**
 * The goal, and the monthly expenses it is derived from.
 *
 * `useProfile` lives here rather than in a feature of its own because the profile is not an
 * independent concept in this release: `monthlyExpenses` exists only to produce the target,
 * nothing else reads it, and `submitGoal` writes both rows in a single transaction.
 * Separating the reads would put the two halves of one operation in different features.
 *
 * The moment the profile gains meaning that is not the goal's — a name, a second currency,
 * anything a screen shows for its own sake — is the moment it earns `src/features/profile/`.
 */

/** What a screen submits: the expenses and the goal derived from them. */
export interface GoalDraft {
  /** The average monthly essential expenses (FR-001). */
  readonly monthlyExpenses: Money
  /** The goal itself, calculated or overridden. */
  readonly goal: GoalInput
}

/**
 * Reads the profile, or null before onboarding has written one.
 *
 * @returns The query, for a screen to map onto a `ViewState` with `toViewState`.
 */
export function useProfile(): UseQueryResult<Profile | null, AppError> {
  const { unitOfWork } = useServices()
  return useQuery<Profile | null, AppError>({
    queryKey: queryKeys.profile(),
    queryFn: async () => unwrap(await unitOfWork.run(async (repos) => repos.profile.get())),
  })
}

/**
 * Reads the active goal, or null before onboarding has written one.
 *
 * The null is what the router keys on: no goal means setup never finished, which is the
 * only definition of "first launch" that survives the app being deleted and reinstalled
 * with its data restored.
 *
 * @returns The query, for a screen to map onto a `ViewState` with `toViewState`.
 */
export function useGoal(): UseQueryResult<Goal | null, AppError> {
  const { unitOfWork } = useServices()
  return useQuery<Goal | null, AppError>({
    queryKey: queryKeys.goal(),
    queryFn: async () => unwrap(await unitOfWork.run(async (repos) => repos.goal.get())),
  })
}

/*
 * A `useGoalChanges` reading the revision history belongs here too, but nothing renders it
 * until the goal revision screen exists — T066. Written now it would be untested code whose
 * only proof of working is that it compiles.
 */

/**
 * Saves the expenses and the goal, recording the revision when there is one.
 *
 * The whole submission runs inside one transaction. It writes up to three rows, and a
 * partial application would leave a profile describing expenses the stored target no longer
 * derives from — a fund whose own numbers disagree.
 *
 * @returns The mutation. Failure arrives as `error`, for the screen to render.
 */
export function useSubmitGoal(): UseMutationResult<Goal, AppError, GoalDraft> {
  const { unitOfWork, currency } = useServices()
  const queryClient = useQueryClient()

  return useMutation<Goal, AppError, GoalDraft>({
    mutationFn: async (draft) =>
      unwrap(await unitOfWork.run(async (repos) => submitGoal(repos, { ...draft, currency }))),
    onSuccess: async () => {
      // Both keys, because one submission writes both rows. FR-006 asks for the change to
      // be visible immediately; without this the write succeeds and every screen keeps
      // showing the previous target until something unrelated happens to refetch.
      //
      // `goal` is a prefix of `goal.changes`, so invalidating it covers the revision
      // history too — which is why the registry gives them a shared prefix.
      //
      // `refetchType: 'all'` rather than the default 'active', and awaited: a screen acts
      // on success by navigating, and the screen it navigates to reads the cache on its
      // first render. The readers that matter are precisely the ones with no observer —
      // Home is unmounted while the user is in onboarding, and the null it left behind is
      // what invalidation alone would leave it to find. It would then redirect the user
      // back to step one, their saved goal invisible until the next cold start.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.goal(), refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: queryKeys.profile(), refetchType: 'all' }),
      ])
    },
  })
}

/**
 * Turns a `Result` into its value, or throws the error.
 *
 * The one place in the app where a result becomes an exception, and it is not a choice:
 * TanStack Query decides a query failed by catching what its function throws. Confining the
 * conversion here keeps every layer below on results, and every layer above reading
 * `query.error` — which is typed `AppError` for exactly this reason.
 */
function unwrap<T>(result: Result<T>): T {
  if (isErr(result)) {
    throw result.error
  }
  return result.value
}
