import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query'

import { queryKeys } from '@/runtime/query'
import { useServices } from '@/runtime/services-context'
import type { AppError } from '@/domain/errors'
import { calculateBalance } from '@/domain/ledger/balance'
import { recordEntry } from '@/domain/ledger/record-entry'
import type { LedgerEntry, LedgerEntryInput, LedgerEntryPatch } from '@/domain/ledger/types'
import type { Money } from '@/domain/money/money'
import type { UnitOfWork } from '@/domain/ports/unit-of-work'
import { isErr, type Result } from '@/domain/result'

/**
 * The ledger, as screens read and change it.
 *
 * Everything a screen shows about the fund is derived from these rows and none of it is
 * stored, so the cache is the only place a stale figure can hide. That is what the
 * invalidation below is for, and why it is stricter than TanStack's default.
 */

/** What an edit carries: which entry, and the fields to change (FR-011). */
export interface EntryEdit {
  /** The entry being edited. */
  readonly id: string
  /** The fields to change. Absent fields are left alone; `null` clears a note. */
  readonly patch: LedgerEntryPatch
}

/**
 * Every entry, oldest first (FR-014).
 *
 * @returns The query, for a screen to map onto a `ViewState` with `toViewState`.
 */
export function useEntries(): UseQueryResult<readonly LedgerEntry[], AppError> {
  const { unitOfWork } = useServices()
  return useQuery(entriesQuery(unitOfWork))
}

/**
 * The balance those entries add up to (FR-012).
 *
 * Derived through `select` on the same query rather than by a query of its own, so both
 * read one cache entry. Two entries would be two things to invalidate and two moments at
 * which a screen could show a balance that disagreed with the history beside it.
 *
 * @returns The query, resolving to the balance as of today.
 */
export function useBalance(): UseQueryResult<Money, AppError> {
  const { unitOfWork, clock } = useServices()
  return useQuery({
    ...entriesQuery(unitOfWork),
    select: (entries) => calculateBalance(entries, clock.today()),
  })
}

/**
 * Entries dated after today, which every calculation excludes and the user must correct
 * (FR-033).
 *
 * Keyed by today's date, so the list cannot outlive the day it was computed for: an entry
 * dated tomorrow stops being future-dated at midnight, and a key that ignored the date
 * would keep reporting it until something unrelated evicted the cache.
 *
 * @returns The query, for the warning surface to render.
 */
export function useFutureDatedEntries(): UseQueryResult<readonly LedgerEntry[], AppError> {
  const { unitOfWork, clock } = useServices()
  const today = clock.today()
  return useQuery<readonly LedgerEntry[], AppError>({
    queryKey: queryKeys.futureDatedEntries(today),
    queryFn: async () =>
      unwrap(
        await unitOfWork.run(async (repositories) => repositories.ledger.listFutureDated(today)),
      ),
  })
}

/**
 * Records a contribution, withdrawal, or opening balance (FR-008, FR-010).
 *
 * @returns The mutation. A refused entry arrives as `error`, for the screen to render.
 */
export function useAddEntry(): UseMutationResult<LedgerEntry, AppError, LedgerEntryInput> {
  const { unitOfWork, clock } = useServices()
  const refresh = useLedgerRefresh()

  return useMutation<LedgerEntry, AppError, LedgerEntryInput>({
    mutationFn: async (entry) =>
      unwrap(
        await unitOfWork.run(async (repositories) =>
          recordEntry(repositories, entry, clock.today()),
        ),
      ),
    onSuccess: refresh,
  })
}

/**
 * Corrects an entry already recorded (FR-011).
 *
 * @returns The mutation. A missing entry arrives as a not-found `error`.
 */
export function useUpdateEntry(): UseMutationResult<LedgerEntry, AppError, EntryEdit> {
  const { unitOfWork } = useServices()
  const refresh = useLedgerRefresh()

  return useMutation<LedgerEntry, AppError, EntryEdit>({
    mutationFn: async ({ id, patch }) =>
      unwrap(await unitOfWork.run(async (repositories) => repositories.ledger.update(id, patch))),
    onSuccess: refresh,
  })
}

/**
 * Deletes an entry (FR-011). The caller confirms first — `ConfirmSheet` is that.
 *
 * @returns The mutation.
 */
export function useRemoveEntry(): UseMutationResult<void, AppError, string> {
  const { unitOfWork } = useServices()
  const refresh = useLedgerRefresh()

  return useMutation<void, AppError, string>({
    mutationFn: async (id) =>
      unwrap(await unitOfWork.run(async (repositories) => repositories.ledger.remove(id))),
    onSuccess: refresh,
  })
}

/**
 * The query every ledger read shares.
 *
 * One definition rather than one per hook, so `useEntries` and `useBalance` cannot drift
 * into fetching the same rows under different keys — which is how two screens come to
 * disagree about the same fund.
 */
function entriesQuery(unitOfWork: UnitOfWork): {
  readonly queryKey: readonly string[]
  readonly queryFn: () => Promise<readonly LedgerEntry[]>
} {
  return {
    queryKey: queryKeys.entries(),
    queryFn: async () =>
      unwrap(await unitOfWork.run(async (repositories) => repositories.ledger.list())),
  }
}

/**
 * What every ledger write does afterwards.
 *
 * `entries` is the prefix of every other ledger key — the ranged history and the
 * future-dated warning both begin with it — so one invalidation covers all three. That is
 * why the registry gives them a shared prefix.
 *
 * `refetchType: 'all'` rather than the default `active`, and awaited. A screen acts on
 * success by navigating, and the screen it lands on reads the cache on its first render, so
 * the readers that matter are precisely the ones with no observer. This is the defect User
 * Story 1 shipped and `useSubmitGoal` was fixed for; the balance would show the figure it
 * held before the contribution, which is indistinguishable on screen from the truth.
 *
 * The statistics and forecast keys are not here. Nothing computes them yet, and
 * invalidating a query that does not exist is a no-op dressed as correctness — they join
 * this list in the tasks that create them (T096, T111).
 *
 * @returns An `onSuccess` handler for every ledger mutation.
 */
function useLedgerRefresh(): () => Promise<void> {
  const queryClient = useQueryClient()
  return async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.entries(), refetchType: 'all' })
  }
}

/**
 * Turns a `Result` into its value, or throws the error.
 *
 * The same conversion `features/goal/hooks.ts` makes, and for the same reason: TanStack
 * Query decides a query failed by catching what its function throws. Confining it to these
 * boundaries keeps every layer below on results, and every layer above reading
 * `query.error` — typed `AppError` for exactly this purpose.
 */
function unwrap<T>(result: Result<T>): T {
  if (isErr(result)) {
    throw result.error
  }
  return result.value
}
