import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient, UseMutationResult, UseQueryResult } from '@tanstack/react-query'
import { AccessibilityInfo } from 'react-native'

import { queryKeys } from '@/runtime/query'
import type { Services } from '@/runtime/services'
import { useServices } from '@/runtime/services-context'
import type { CalendarDate } from '@/domain/dates/calendar-date'
import type { AppError } from '@/domain/errors'
import { acknowledgeMilestones, readProgress } from '@/domain/ledger/acknowledge-milestones'
import { calculateBalance } from '@/domain/ledger/balance'
import { recordEntry } from '@/domain/ledger/record-entry'
import { reviseEntry } from '@/domain/ledger/revise-entry'
import type {
  LedgerEntry,
  LedgerEntryInput,
  LedgerEntryPatch,
  MilestoneThreshold,
  ProgressSummary,
} from '@/domain/ledger/types'
import type { Money } from '@/domain/money/money'
import type { Repositories } from '@/domain/ports/repositories'
import type { UnitOfWork } from '@/domain/ports/unit-of-work'
import { isErr, ok, type Result } from '@/domain/result'
import { strings } from '@/ui/strings'

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
 * Something derived from the ledger, read from the one cache entry every ledger reader
 * shares.
 *
 * Through `select` on the same query rather than a query of its own, so the balance, the
 * entry being corrected, and the statistics all read the rows the history shows. A second
 * cache entry would be a second thing to invalidate, and a moment in which two screens
 * disagree about the same fund — and a write refreshes every one of these by refreshing
 * the rows.
 *
 * @param select Derives the value from the entries, oldest first. Called again whenever the
 *   rows change, so it must be pure.
 * @returns The query, resolving to the derived value.
 */
export function useLedgerView<T>(
  select: (entries: readonly LedgerEntry[]) => T,
): UseQueryResult<T, AppError> {
  const { unitOfWork } = useServices()
  return useQuery({ ...entriesQuery(unitOfWork), select })
}

/**
 * The balance those entries add up to (FR-012).
 *
 * @returns The query, resolving to the balance as of today.
 */
export function useBalance(): UseQueryResult<Money, AppError> {
  const { clock } = useServices()
  return useLedgerView((entries) => calculateBalance(entries, clock.today()))
}

/**
 * One entry, by its id — or null when the ledger has none by that id (FR-011).
 *
 * Found in the list every other reader shares rather than fetched on its own: the screen
 * that corrects an entry is opened from the history, and the two must not be able to
 * disagree about what the entry says.
 *
 * @param id The entry to find.
 * @returns The query, resolving to the entry or to null.
 */
export function useEntry(id: string): UseQueryResult<LedgerEntry | null, AppError> {
  return useLedgerView((entries) => entries.find((entry) => entry.id === id) ?? null)
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

/** A withdrawal to record, and whether the user has confirmed it is more than the balance. */
export interface WithdrawalRequest {
  /** The withdrawal, already shaped by the form. */
  readonly entry: LedgerEntryInput
  /** Whether the user has answered the over-balance question with yes (FR-017). */
  readonly overBalanceConfirmed: boolean
}

/**
 * Records a contribution or an opening balance (FR-008, FR-010). A withdrawal goes through
 * {@link useRecordWithdrawal}, which can say it was confirmed.
 *
 * @returns The mutation. A refused entry arrives as `error`, for the screen to render.
 */
export function useAddEntry(): UseMutationResult<LedgerEntry, AppError, LedgerEntryInput> {
  return useLedgerWrite((repositories, entry: LedgerEntryInput, today) =>
    recordEntry(repositories, entry, today),
  )
}

/**
 * Records a withdrawal (FR-016, FR-017).
 *
 * One larger than the balance comes back as an `over-balance` error — a question for the
 * screen to ask, carrying the balance it was measured against — until it is sent again
 * confirmed.
 *
 * @returns The mutation.
 */
export function useRecordWithdrawal(): UseMutationResult<LedgerEntry, AppError, WithdrawalRequest> {
  return useLedgerWrite((repositories, { entry, overBalanceConfirmed }: WithdrawalRequest, today) =>
    recordEntry(repositories, entry, today, { overBalanceConfirmed }),
  )
}

/**
 * Corrects an entry already recorded (FR-011).
 *
 * Through `reviseEntry`, so a correction is held to the rules a new entry is.
 *
 * @returns The mutation. A refused correction arrives as a validation `error`, and a
 *   missing entry as a not-found one.
 */
export function useUpdateEntry(): UseMutationResult<LedgerEntry, AppError, EntryEdit> {
  return useLedgerWrite((repositories, { id, patch }: EntryEdit, today) =>
    reviseEntry(repositories, id, patch, today),
  )
}

/**
 * Deletes an entry (FR-011). The caller confirms first — `ConfirmSheet` is that.
 *
 * @returns The mutation.
 */
export function useRemoveEntry(): UseMutationResult<void, AppError, string> {
  return useLedgerWrite((repositories, id: string) => repositories.ledger.remove(id))
}

/** One write to the ledger, given the repositories of the transaction it runs in. */
type LedgerWrite<TVariables, T> = (
  repositories: Repositories,
  variables: TVariables,
  today: CalendarDate,
) => Promise<Result<T>>

/**
 * A ledger write, and everything every ledger write does around it.
 *
 * In order: the fund's position is read, the write is made, the milestones it crossed are
 * recorded (FR-024), the ledger readers are refreshed, and the new balance — then the
 * milestone, if one was crossed — is announced. All of it inside the mutation, so a screen
 * that navigates on success lands on a cache that already holds the write.
 *
 * Only the write can fail the mutation. A milestone that cannot be recorded, or a balance
 * that cannot be read back, is logged or left unsaid instead: the write landed, and failing
 * the save would ask the user to redo something already done.
 *
 * @param write The write itself.
 * @returns The mutation.
 */
function useLedgerWrite<TVariables, T>(
  write: LedgerWrite<TVariables, T>,
): UseMutationResult<T, AppError, TVariables> {
  const services = useServices()
  const queryClient = useQueryClient()

  return useMutation<T, AppError, TVariables>({
    mutationFn: async (variables) => {
      const { unitOfWork, clock } = services
      const today = clock.today()
      const before = await unitOfWork.run(async (repositories) => readProgress(repositories, today))
      const written = unwrap(
        await unitOfWork.run(async (repositories) => write(repositories, variables, today)),
      )
      const reached = await settleMilestones(services, before, today)
      if (reached !== null) {
        queryClient.setQueryData(queryKeys.milestoneReached(), reached)
      }
      await refreshLedger(queryClient)
      await announce(queryClient, services, reached)
      return written
    },
  })
}

/**
 * Records the milestones a write crossed, and returns the highest — the one to tell the
 * user about.
 *
 * Measured from the positions either side of the write, both read from storage. A failure
 * anywhere along the way is logged and comes back as no milestone: the write has landed,
 * and an acknowledgement that could not be recorded would otherwise repeat on the next
 * save, which is worse than one not said (Principle II asks for the log, not for the
 * save to fail).
 *
 * @param services The logger and the unit of work.
 * @param before The position read before the write, or why it could not be read.
 * @param today From the `Clock` port.
 * @returns The highest milestone newly crossed, or null.
 */
async function settleMilestones(
  { unitOfWork, logger }: Services,
  before: Result<ProgressSummary | null>,
  today: CalendarDate,
): Promise<MilestoneThreshold | null> {
  const settled = await recordCrossings(unitOfWork, before, today)
  if (isErr(settled)) {
    logger.warn('milestones.not-recorded', {
      kind: settled.error.kind,
      messageKey: 'messageKey' in settled.error ? settled.error.messageKey : null,
    })
    return null
  }
  return settled.value.at(-1) ?? null
}

/**
 * The milestones crossed between the position before a write and the one after it.
 *
 * None without a goal on either side: before setup there is no target to cross. A
 * position that could not be read is the failure, so the caller can log it rather than
 * guess.
 */
async function recordCrossings(
  unitOfWork: UnitOfWork,
  before: Result<ProgressSummary | null>,
  today: CalendarDate,
): Promise<Result<readonly MilestoneThreshold[]>> {
  if (isErr(before)) {
    return before
  }
  const previous = before.value
  if (previous === null) {
    return ok([])
  }
  return unitOfWork.run(async (repositories) => {
    const after = await readProgress(repositories, today)
    if (isErr(after)) {
      return after
    }
    return after.value === null
      ? ok([])
      : acknowledgeMilestones(repositories.milestones, previous, after.value)
  })
}

/**
 * The query every ledger read shares.
 *
 * One definition rather than one per hook, so `useEntries` and `useLedgerView` cannot drift
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
 * Refreshes every ledger reader after a write.
 *
 * `entries` is the prefix of every other ledger key — the ranged history and the
 * future-dated warning both begin with it — so one invalidation covers all of them, and
 * everything read through {@link useLedgerView} (the balance, the statistics) reads the
 * entries query itself. That is why the registry gives them a shared prefix, and why there
 * is no statistics key to invalidate. The forecast joins at T111.
 *
 * `refetchType: 'all'` rather than the default `active`, and awaited. A screen acts on
 * success by navigating, and the screen it lands on reads the cache on its first render, so
 * the readers that matter are precisely the ones with no observer. This is the defect User
 * Story 1 shipped and `useSubmitGoal` was fixed for; the balance would show the figure it
 * held before the contribution, which is indistinguishable on screen from the truth.
 */
async function refreshLedger(queryClient: QueryClient): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: queryKeys.entries(), refetchType: 'all' })
}

/**
 * Says what a write changed, through the screen reader (ui-contract, live regions): the
 * balance it left, then the milestone it crossed, if any.
 *
 * An announcement rather than a live region on a screen: every write is followed by the
 * screen leaving, and a region unmounted as it changes says nothing.
 *
 * The balance is read with `staleTime: Infinity`, so the entries the refresh just fetched
 * are used without a second read. A refresh that failed is not taken as an answer: with the
 * balance from before the write still cached, a failed read announces no balance rather
 * than that figure, which is no longer true — `entry-hooks.test.tsx` holds exactly that
 * cache. The milestone does not depend on that read: it is already recorded, and the
 * banner already shows it.
 *
 * Queued, on iOS, behind whatever VoiceOver is saying, such as the button just pressed.
 */
async function announce(
  queryClient: QueryClient,
  { unitOfWork, clock, format }: Services,
  reached: MilestoneThreshold | null,
): Promise<void> {
  try {
    const entries = await queryClient.fetchQuery({
      ...entriesQuery(unitOfWork),
      staleTime: Infinity,
    })
    say(strings.entries.balanceAnnounced(format.money(calculateBalance(entries, clock.today()))))
  } catch {
    // The balance is left unsaid; see above.
  }
  if (reached !== null) {
    say(strings.milestones.title(reached, format.percent(reached)))
  }
}

/** Hands a sentence to the screen reader, queued behind what it is already saying. */
function say(sentence: string): void {
  AccessibilityInfo.announceForAccessibilityWithOptions(sentence, { queue: true })
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
