import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { cleanup, render } from '@testing-library/react-native'
import type { ReactNode } from 'react'

import { createQueryClient } from '@/app/query'
import type { Services } from '@/app/services'
import { ServicesProvider } from '@/app/services-context'
import { currencyCode } from '@/domain/money/currency'
import type { Repositories } from '@/domain/ports/repositories'
import type { UnitOfWork } from '@/domain/ports/unit-of-work'
import { createFormatters } from '@/ui/format'
import { CountingIdGenerator, FakeClock, createInMemoryRepositories } from './doubles'

/**
 * The providers `app/_layout.tsx` supplies in production, assembled for one test.
 *
 * Screens reach storage through the services and the query client, so a test that renders
 * one has to stand both up. Doing that here rather than per file keeps the teardown in a
 * single place — and the teardown is the part with a trap in it (see {@link teardown}).
 *
 * Over the in-memory repositories, deliberately. SQL is the integration tests' subject,
 * and `better-sqlite3` is a native module: loading it inside the React Native test
 * environment leaves handles that keep the process alive after the assertions have passed,
 * so the suite succeeds and then never exits.
 */
export interface AppHarness {
  /** The storage the rendered screens read and write. Assert against it directly. */
  readonly repositories: Repositories
  /** The cache behind every hook, for tests that inspect or seed it. */
  readonly queryClient: QueryClient
  /** The services the tree is given, so a test can see what a screen sees. */
  readonly services: Services
  /** Renders a screen inside the providers. Await it — render is async in this version. */
  render: (ui: ReactNode) => Promise<unknown>
  /** Shuts everything down. Call it from `afterEach`. */
  teardown: () => Promise<void>
}

/** The locale tests format money in, fixed so assertions do not depend on the machine. */
const LOCALE = 'pt-BR'

/**
 * Builds a harness for one test.
 *
 * @param today The date the fake clock reports, when a test cares.
 * @returns The harness. Call `teardown` in `afterEach`.
 */
export function createAppHarness(today = '2026-08-22'): AppHarness {
  const clock = new FakeClock(today)
  const ids = new CountingIdGenerator()
  const repositories = createInMemoryRepositories(clock, ids)
  const queryClient = createQueryClient()
  const currency = currencyCode('BRL')

  const services: Services = {
    clock,
    ids,
    logger: { debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
    format: createFormatters({ currency, locale: LOCALE }),
    currency,
    unitOfWork: directUnitOfWork(repositories),
  }

  return {
    repositories,
    queryClient,
    services,
    render: (ui) =>
      render(
        <ServicesProvider services={services}>
          <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
        </ServicesProvider>,
      ),
    teardown: () => teardown(queryClient),
  }
}

/**
 * A unit of work with no transaction.
 *
 * Rolling back is a property of the engine, so there is nothing here a double could
 * imitate honestly — `tests/integration/data/database.test.ts` is where that is tested.
 * This exists so screens reach repositories through the same door they use in production.
 */
function directUnitOfWork(repositories: Repositories): UnitOfWork {
  return { run: (work) => work(repositories) }
}

/**
 * Everything the client leaves running, in the order it has to be shut down.
 *
 * `cleanup` first, and explicitly: unmounting is what makes a query or a mutation schedule
 * its collection, so anything torn down before it is simply rescheduled afterwards. The
 * library registers the same call as its own `afterEach` when it is imported, which is
 * before any test file's own hooks — so Jest runs it last, too late to help.
 *
 * Then the mutations, by hand. `clear()` destroys every query, but for mutations it only
 * drops them from the cache and leaves their timers armed — so the five-minute default
 * `gcTime` keeps the Jest worker alive long after the assertions have passed. Left alone,
 * a suite reports success in a second and the process sits idle for five minutes.
 *
 * `unmount()` last, for the client's own focus and connectivity listeners.
 */
async function teardown(queryClient: QueryClient): Promise<void> {
  await cleanup()
  for (const mutation of queryClient.getMutationCache().getAll()) {
    mutation.destroy()
  }
  queryClient.clear()
  queryClient.unmount()
}
