import { createContext, use, type ReactNode } from 'react'

import type { Services } from '@/app/services'

/**
 * Undefined until a provider supplies a value, which is what lets {@link useServices} tell
 * "outside the provider" apart from "inside a provider holding services".
 */
const ServicesContext = createContext<Services | undefined>(undefined)

/** Props for {@link ServicesProvider}. */
export interface ServicesProviderProps {
  /** The service set every descendant will read. */
  readonly services: Services
  /** The tree that may use them. */
  readonly children: ReactNode
}

/**
 * Makes a service set available to a tree.
 *
 * Takes the services rather than building them. That is the whole reason this module is
 * separate from `composition-root.tsx`: a screen and its tests depend on the context, not
 * on the wiring, so a test can render against a fixed clock and a counting id generator
 * without the real adapters — or the native modules behind them — entering the graph.
 *
 * @param props - See {@link ServicesProviderProps}
 * @returns The provided tree
 */
export function ServicesProvider({ services, children }: ServicesProviderProps): ReactNode {
  return <ServicesContext value={services}>{children}</ServicesContext>
}

/**
 * Reads the service set.
 *
 * Throws when there is no provider above, rather than falling back to a default set. A
 * fallback would work — and would keep working, quietly holding a second clock and a
 * second database handle, until something depended on the two agreeing. Failing at the
 * first render makes the missing provider the error it is.
 *
 * @returns The services the nearest provider supplied.
 * @throws {Error} When called outside a {@link ServicesProvider}.
 */
export function useServices(): Services {
  const services = use(ServicesContext)
  if (services === undefined) {
    throw new Error('useServices was called outside a ServicesProvider.')
  }
  return services
}
