import { QueryClient } from '@tanstack/react-query'

import type { CalendarDate } from '@/domain/dates/calendar-date'
import type { AppError } from '@/domain/errors'
import type { DateRange } from '@/domain/ledger/types'
import type { ViewState } from '@/ui/primitives/state-view'

/**
 * Builds the query client.
 *
 * The defaults are deliberately the opposite of the library's, because its defaults are
 * tuned for a network this app does not have. Nothing here is a transient failure, nothing
 * changes behind the app's back, and no request costs anything to repeat — so retrying,
 * refetching on focus, and refetching on reconnect are all off. What remains useful is the
 * cache and the four-state machine, which is why the dependency was accepted at all (D-008).
 *
 * @returns A client with no cache shared with any other.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // A read that failed against a local database fails for a reason retrying cannot
        // change — a missing file, a corrupt page, a constraint. Retrying three times with
        // backoff, the library's default, only delays showing the user the error.
        retry: false,
        // The database has exactly one writer: this app. There is no other client whose
        // changes we could be missing, so a refetch on focus is work with no possible
        // result. Cache invalidation after a mutation is what keeps screens correct.
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        // The app is offline-only (FR-041), so "online" is meaningless here; without this
        // every query would sit paused forever on a device with no connection.
        networkMode: 'always',
      },
      mutations: {
        retry: false,
        networkMode: 'always',
      },
    },
  })
}

/**
 * Every cache key in the app.
 *
 * A registry rather than keys written at each call site: a mutation invalidates by prefix,
 * and a prefix only works if every related key actually starts with it. `entries`,
 * `entriesInRange`, and `futureDatedEntries` all begin `['entries']` so that saving one
 * entry refreshes the history, the visible window, and the future-dated warning together
 * — three screens that would otherwise disagree about the same ledger.
 */
export const queryKeys = {
  /** The single profile row. */
  profile: () => ['profile'] as const,
  /** The current goal. */
  goal: () => ['goal'] as const,
  /** The goal's revision history (FR-035). */
  goalChanges: () => ['goal', 'changes'] as const,
  /** Every ledger entry. */
  entries: () => ['entries'] as const,
  /** The entries falling inside one window of history. */
  entriesInRange: (range: DateRange) => ['entries', 'range', range.from, range.to] as const,
  /** Entries dated after today, which several calculations exclude (FR-033). */
  futureDatedEntries: (today: CalendarDate) => ['entries', 'future', today] as const,
  /** The computed statistics (FR-022). */
  statistics: () => ['statistics'] as const,
  /** The computed forecast (FR-028). */
  forecast: () => ['forecast'] as const,
  /** The reminder setting. */
  reminder: () => ['reminder'] as const,
  /** The milestones already acknowledged. */
  milestones: () => ['milestones'] as const,
}

/**
 * The part of a query result {@link toViewState} reads.
 *
 * Narrower than TanStack's own `UseQueryResult` on purpose. The full type is a large
 * discriminated union whose fields exist to serve every option the library offers, and
 * depending on all of it would mean this mapping could not be exercised without building a
 * client and mounting a component. This shape is what the mapping actually needs, and a
 * `UseQueryResult` satisfies it structurally.
 *
 * @typeParam T - What the query resolves to.
 */
export interface QueryLike<T> {
  /** Whether the query is unresolved, failed, or resolved. */
  readonly status: 'pending' | 'error' | 'success'
  /** The resolved value, absent until it resolves. */
  readonly data: T | undefined
  /** Why it failed, when it did. */
  readonly error: AppError | null
  /** Runs the query again. Absent when the caller has nothing to retry with. */
  readonly refetch?: (() => unknown) | undefined
}

/**
 * Decides whether resolved data should be shown as empty rather than as content.
 *
 * @typeParam T - What the query resolves to.
 */
export type EmptyPredicate<T> = (data: T) => boolean

/**
 * Maps a query onto the four states every data-backed view must handle (FR-051).
 *
 * Written once here rather than per screen. The four-state rule is only as good as its
 * least careful implementation, and a screen that hand-rolled this mapping is exactly
 * where "empty" would quietly become "ready with nothing in it".
 *
 * @param query The query result, or anything with its shape.
 * @param isEmpty Whether resolved data counts as empty. Defaults to an empty array, which
 *   covers every list; a single record needs its own predicate, because the default would
 *   call an absent goal `ready` and render the populated view over nothing.
 * @returns The state the view should render.
 */
export function toViewState<T>(
  query: QueryLike<T>,
  isEmpty: EmptyPredicate<T> = isEmptyCollection,
): ViewState<T> {
  if (query.status === 'error' && query.error !== null) {
    const { refetch } = query
    return refetch === undefined
      ? { kind: 'error', error: query.error }
      : { kind: 'error', error: query.error, retry: () => void refetch() }
  }
  // `data` is checked rather than trusting `status === 'success'`: the two are set
  // together in every path the library takes, but a view rendering `undefined` as content
  // is a crash, and treating the impossible case as still-loading costs nothing.
  if (query.status !== 'success' || query.data === undefined) {
    return { kind: 'loading' }
  }
  return isEmpty(query.data) ? { kind: 'empty' } : { kind: 'ready', data: query.data }
}

/**
 * The default emptiness test: a collection with nothing in it.
 *
 * Anything that is not an array is content, which is why a single record has to supply its
 * own predicate.
 */
function isEmptyCollection(data: unknown): boolean {
  return Array.isArray(data) && data.length === 0
}
