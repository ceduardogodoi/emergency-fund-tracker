import type { ReactNode } from 'react'

import { assertNever, type AppError } from '@/domain/errors'
import { ErrorState } from '@/ui/primitives/error-state'
import { LoadingState } from '@/ui/primitives/loading-state'

/**
 * The four states any view backed by stored or computed data can be in (FR-051).
 *
 * `empty` is a state of its own rather than a `ready` carrying no rows, because the two
 * want different words: "you have no entries yet, add one" is not the same screen as a
 * list that happens to be short. Separating them is what lets the type demand copy for it.
 */
export type ViewState<T> =
  | { readonly kind: 'loading' }
  | { readonly kind: 'empty' }
  | { readonly kind: 'error'; readonly error: AppError; readonly retry?: () => void }
  | { readonly kind: 'ready'; readonly data: T }

/**
 * Props for {@link StateView}.
 *
 * The renderers are plain functions rather than component types, and are called rather
 * than rendered. That keeps the caller's markup inline in this component's own tree, which
 * is what the ui-contract asks for — but it also means a caller-supplied renderer must not
 * use hooks: it shares this component's fiber, and `StateView` calls a different one per
 * state, so a hook inside would change hook order across a transition. Anything needing
 * state belongs in a component the renderer returns.
 *
 * @typeParam T - What the view renders once its data has arrived.
 */
export interface StateViewProps<T> {
  /** Which of the four states the view is in. */
  readonly state: ViewState<T>
  /** Replaces the shared {@link LoadingState}. */
  readonly loading?: (() => ReactNode) | undefined
  /**
   * Renders the empty state. Required, with no default.
   *
   * FR-025 asks the empty state to say what will appear here and what action produces it.
   * No shared component can know either, so the type asks each screen for the copy rather
   * than letting a blank screen ship behind a generic "Nothing here".
   */
  readonly empty: () => ReactNode
  /** Replaces the shared {@link ErrorState}. Receives the error and the retry, if any. */
  readonly error?: ((error: AppError, retry?: () => void) => ReactNode) | undefined
  /** Renders the data. */
  readonly ready: (data: T) => ReactNode
}

/**
 * Renders exactly one of the four states, and refuses to compile if a case is unhandled.
 *
 * This is what makes FR-051 structural rather than a review checklist item: a screen cannot
 * render data without having said what its empty state looks like, and cannot forget the
 * loading or error case, because it never writes those branches at all.
 *
 * @param props - See {@link StateViewProps}
 * @returns The rendered state
 */
export function StateView<T>({
  state,
  loading,
  empty,
  error,
  ready,
}: StateViewProps<T>): ReactNode {
  switch (state.kind) {
    case 'loading':
      return loading === undefined ? <LoadingState /> : loading()
    case 'empty':
      return empty()
    case 'error':
      return error === undefined ? (
        <ErrorState retry={state.retry} />
      ) : (
        error(state.error, state.retry)
      )
    case 'ready':
      return ready(state.data)
    default:
      return assertNever(state)
  }
}
