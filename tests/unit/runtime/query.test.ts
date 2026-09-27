import {
  combineQueries,
  createQueryClient,
  queryKeys,
  toViewState,
  type QueryLike,
} from '@/runtime/query'
import { calendarDate } from '@/domain/dates/calendar-date'
import { storageError } from '@/domain/errors'
import type { ViewState } from '@/ui/primitives/state-view'

/**
 * The query layer is pure: a client configuration, a key registry, and a mapping from a
 * query's status onto `ViewState`. None of it renders, so it is tested in the fast unit
 * project rather than under React Native.
 */

/**
 * Narrows a state to one case for the assertions that follow.
 *
 * A helper rather than an `if` in the test body: a conditional would let the assertions
 * inside it be skipped while the test still reported success. This fails first and returns
 * second, so the narrowing cannot be what makes a test vacuous.
 *
 * @param state The state under test.
 * @param kind The case it is expected to be in.
 * @returns The same state, narrowed to that case.
 */
function expectKind<T, K extends ViewState<T>['kind']>(
  state: ViewState<T>,
  kind: K,
): Extract<ViewState<T>, { kind: K }> {
  expect(state.kind).toBe(kind)
  return state as Extract<ViewState<T>, { kind: K }>
}

describe('createQueryClient', () => {
  it('does not retry, because a local read that failed will fail again', () => {
    const defaults = createQueryClient().getDefaultOptions()
    expect(defaults.queries?.retry).toBe(false)
  })

  it('does not refetch on focus, because nothing changes the database but this app', () => {
    const defaults = createQueryClient().getDefaultOptions()
    expect(defaults.queries?.refetchOnWindowFocus).toBe(false)
  })

  it('builds an independent client per call, so one test cannot leak cache into the next', () => {
    expect(createQueryClient()).not.toBe(createQueryClient())
  })
})

describe('queryKeys', () => {
  it('gives every entries key the same prefix, so one mutation invalidates them all', () => {
    expect(queryKeys.entries()).toEqual(['entries'])
    expect(
      queryKeys.entriesInRange({
        from: calendarDate('2026-01-01'),
        to: calendarDate('2026-01-31'),
      })[0],
    ).toBe('entries')
    expect(queryKeys.futureDatedEntries(calendarDate('2026-08-29'))[0]).toBe('entries')
  })

  it('distinguishes ranges, so two windows of history do not share one cache entry', () => {
    const january = queryKeys.entriesInRange({
      from: calendarDate('2026-01-01'),
      to: calendarDate('2026-01-31'),
    })
    const february = queryKeys.entriesInRange({
      from: calendarDate('2026-02-01'),
      to: calendarDate('2026-02-28'),
    })
    expect(january).not.toEqual(february)
  })

  it('names a distinct key for every cached concept', () => {
    const keys = [
      queryKeys.profile(),
      queryKeys.goal(),
      queryKeys.goalChanges(),
      queryKeys.entries(),
      queryKeys.futureDatedEntries(calendarDate('2026-08-29')),
      queryKeys.statistics(),
      queryKeys.forecast(),
      queryKeys.reminder(),
      queryKeys.milestones(),
    ].map((key) => JSON.stringify(key))
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('toViewState', () => {
  /** A query that has not resolved yet. */
  const pending: QueryLike<readonly string[]> = { status: 'pending', data: undefined, error: null }

  it('maps a pending query onto loading', () => {
    expect(toViewState(pending)).toEqual({ kind: 'loading' })
  })

  it('maps a failed query onto error, carrying the AppError through unchanged', () => {
    const error = storageError('entries.read')
    const state = toViewState<readonly string[]>({ status: 'error', data: undefined, error })
    expect(expectKind(state, 'error').error).toBe(error)
  })

  it('offers a retry that refetches', () => {
    const refetch = jest.fn()
    const state = toViewState<readonly string[]>({
      status: 'error',
      data: undefined,
      error: storageError('entries.read'),
      refetch,
    })
    expectKind(state, 'error').retry?.()
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  it('offers no retry when the query does not know how to refetch', () => {
    const state = toViewState<readonly string[]>({
      status: 'error',
      data: undefined,
      error: storageError('entries.read'),
    })
    expect(expectKind(state, 'error').retry).toBeUndefined()
  })

  it('maps an empty collection onto empty rather than onto a ready view of nothing', () => {
    expect(toViewState({ status: 'success', data: [], error: null })).toEqual({ kind: 'empty' })
  })

  it('maps a populated collection onto ready', () => {
    const data = ['a']
    expect(toViewState({ status: 'success', data, error: null })).toEqual({ kind: 'ready', data })
  })

  // A goal or a profile is a single record: absent is empty, present is ready. Without an
  // explicit predicate the array default would call every non-array `ready`, and a screen
  // with no goal yet would render its populated view over nothing.
  it('takes a caller predicate for data that is not a collection', () => {
    const state = toViewState<string | null>(
      { status: 'success', data: null, error: null },
      (data) => data === null,
    )
    expect(state).toEqual({ kind: 'empty' })
  })

  it('treats a resolved query holding no data as loading rather than as an empty result', () => {
    const state = toViewState<readonly string[]>({
      status: 'success',
      data: undefined,
      error: null,
    })
    expect(state).toEqual({ kind: 'loading' })
  })
})

/**
 * Two queries a screen needs together, as one.
 *
 * Nesting one view state inside another would make a screen handle four states twice over,
 * and invent an answer for pairs that cannot be told apart from the user's side — one half
 * loaded, the other failed. Combined, the pair has the four states a single query has.
 */
describe('combineQueries', () => {
  const pending: QueryLike<number> = { status: 'pending', data: undefined, error: null }

  function resolved<T>(data: T): QueryLike<T> {
    return { status: 'success', data, error: null }
  }

  function failed(refetch: () => unknown = jest.fn()): QueryLike<number> {
    return { status: 'error', data: undefined, error: storageError('test.failed'), refetch }
  }

  it('combines two answers once both have arrived', () => {
    const combined = combineQueries(resolved(2), resolved(3), (first, second) => first * second)

    expect(combined).toEqual({ status: 'success', data: 6, error: null })
  })

  it('waits while either half is still pending', () => {
    expect(combineQueries(resolved(2), pending, (first, second) => first + second).status).toBe(
      'pending',
    )
    expect(combineQueries(pending, resolved(2), (first, second) => first + second).status).toBe(
      'pending',
    )
  })

  // A failure is reported even while the other half is still loading: waiting for it would
  // show a spinner in front of an answer that is already known.
  it('fails as soon as either half fails, whatever the other is doing', () => {
    expect(combineQueries(pending, failed(), (first, second) => first + second).status).toBe(
      'error',
    )
    expect(combineQueries(failed(), resolved(2), (first, second) => first + second).status).toBe(
      'error',
    )
  })

  // Retrying runs both halves. The one that succeeded costs a local read to repeat, and
  // tracking which half failed would be state no screen has any other use for.
  it('retries both halves', async () => {
    const firstRefetch = jest.fn()
    const secondRefetch = jest.fn()
    const combined = combineQueries(
      failed(firstRefetch),
      { ...resolved(2), refetch: secondRefetch },
      (first, second) => first + second,
    )

    await combined.refetch?.()

    expect(firstRefetch).toHaveBeenCalled()
    expect(secondRefetch).toHaveBeenCalled()
  })
})
