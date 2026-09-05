import { useEffect, useState } from 'react'

import { openServices } from '@/runtime/composition-root'
import type { Services } from '@/runtime/services'
import type { AppError } from '@/domain/errors'
import { isErr, type Result } from '@/domain/result'
import type { ViewState } from '@/ui/primitives/state-view'

/** How the services are obtained. Injectable so a test never opens a device database. */
export type ServicesSource = () => Promise<Result<Services>>

/**
 * Opens the database and wires the services, once, reporting progress as a `ViewState`.
 *
 * The app's own boot is a data-backed view like any other, so it uses the same four-state
 * vocabulary rather than a bespoke pair of booleans. `empty` never occurs — there is no
 * such thing as a successful boot that produced nothing — which the mapping makes explicit
 * rather than leaving a caller to wonder.
 *
 * @param source Where the services come from. Defaults to opening the device database.
 * @returns `loading` while opening, `error` if the database could not be prepared, and
 *   `ready` with the services once it has been.
 */
export function useBootstrap(source: ServicesSource = openServices): ViewState<Services> {
  const [state, setState] = useState<ViewState<Services>>({ kind: 'loading' })

  useEffect(() => {
    // StrictMode runs effects twice in development, and a slow open can still be in flight
    // when the layout remounts. Without this guard the second run's result would land on an
    // unmounted tree, and — worse — two databases would be open.
    let current = true

    // The effect callback itself cannot be async: React reads its return value as the
    // cleanup function, and a promise is not one.
    async function boot(): Promise<void> {
      try {
        const result = await source()
        if (current) {
          setState(toState(result))
        }
      } catch (cause) {
        // `openServices` returns its failures, so a throw here is something unforeseen — a
        // native module missing, a driver raising where it documented a result. It still
        // has to become a state, or the app shows a permanent spinner and says nothing.
        if (current) {
          setState({ kind: 'error', error: unexpected(cause) })
        }
      }
    }

    void boot()

    return () => {
      current = false
    }
  }, [source])

  return state
}

/** Maps the boot outcome onto the two states it can produce. */
function toState(result: Result<Services>): ViewState<Services> {
  return isErr(result)
    ? { kind: 'error', error: result.error }
    : { kind: 'ready', data: result.value }
}

/** Wraps a rejection the composition root was not supposed to be able to produce. */
function unexpected(cause: unknown): AppError {
  return { kind: 'storage', messageKey: 'app.bootstrap-failed', cause }
}
