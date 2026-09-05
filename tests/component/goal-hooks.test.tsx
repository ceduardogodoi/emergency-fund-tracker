import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { render, screen, userEvent } from '@testing-library/react-native'
import type { ReactNode } from 'react'

import { createQueryClient } from '@/app/query'
import type { Services } from '@/app/services'
import { ServicesProvider } from '@/app/services-context'
import { currencyCode } from '@/domain/money/currency'
import { money } from '@/domain/money/money'
import type { Repositories } from '@/domain/ports/repositories'
import type { UnitOfWork } from '@/domain/ports/unit-of-work'
import { useGoal, useProfile, useSubmitGoal } from '@/features/goal/hooks'
import { createFormatters } from '@/ui/format'
import { Button, Text } from '@/ui/primitives'
import { CountingIdGenerator, FakeClock, createInMemoryRepositories } from '@tests/support/doubles'

/**
 * What these cover is the seam between a screen and storage: that a write lands, and that
 * every read depending on it refreshes afterwards.
 *
 * Deliberately over the in-memory repositories rather than a real database. SQL is the
 * integration tests' subject, and `better-sqlite3` is a native module — loading it inside
 * the React Native test environment leaves handles that keep the process alive after the
 * assertions have all passed, so the suite succeeds and then never exits.
 */
let repositories: Repositories
let queryClient: QueryClient

/**
 * A unit of work with no transaction.
 *
 * Rolling back is a property of the engine, so there is nothing here a double could imitate
 * honestly — `tests/integration/data/database.test.ts` is where that is tested. This exists
 * so the hooks reach repositories through the same door they use in production.
 */
function directUnitOfWork(repos: Repositories): UnitOfWork {
  return { run: (work) => work(repos) }
}

/** The services a screen would be given. */
function testServices(): Services {
  return {
    clock: new FakeClock('2026-08-22'),
    ids: new CountingIdGenerator(),
    logger: { debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
    format: createFormatters({ currency: currencyCode('BRL'), locale: 'pt-BR' }),
    currency: currencyCode('BRL'),
    unitOfWork: directUnitOfWork(repositories),
  }
}

/** Wraps a screen in the providers `app/_layout.tsx` supplies in production. */
function renderWithServices(ui: ReactNode): Promise<unknown> {
  return render(
    <ServicesProvider services={testServices()}>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </ServicesProvider>,
  )
}

/** Reads the goal and reports whichever state it is in. */
function GoalReader(): ReactNode {
  const goal = useGoal()
  if (goal.status !== 'success') {
    return <Text>{goal.status}</Text>
  }
  return <Text>{goal.data === null ? 'no-goal' : `target:${goal.data.target}`}</Text>
}

/** Reads the profile and reports whichever state it is in. */
function ProfileReader(): ReactNode {
  const profile = useProfile()
  if (profile.status !== 'success') {
    return <Text>{profile.status}</Text>
  }
  return (
    <Text>{profile.data === null ? 'no-profile' : `expenses:${profile.data.monthlyExpenses}`}</Text>
  )
}

/** Submits a goal when pressed, so a test can drive the mutation from the tree. */
function Submitter({ target }: { readonly target: number }): ReactNode {
  const submit = useSubmitGoal()
  return (
    <Button
      label="Salvar"
      onPress={() =>
        submit.mutate({
          monthlyExpenses: money(200_000),
          goal: {
            target: money(target),
            source: 'calculated',
            levelKey: 'balanced',
            coverageMonths: 6,
            desiredCompletionDate: null,
          },
        })
      }
    />
  )
}

describe('the goal hooks', () => {
  beforeEach(() => {
    repositories = createInMemoryRepositories(
      new FakeClock('2026-08-22'),
      new CountingIdGenerator(),
    )
    queryClient = createQueryClient()
  })

  // A cached query holds a garbage-collection timer, and a mounted client holds listeners
  // for focus and connectivity. Both outlive the assertions, and left running they keep the
  // worker alive after the suite has finished.
  afterEach(() => {
    queryClient.clear()
    queryClient.unmount()
  })

  it('reports no goal on a fresh install, which is what sends the user to onboarding', async () => {
    await renderWithServices(<GoalReader />)
    expect(await screen.findByText('no-goal')).toBeTruthy()
  })

  it('reports no profile on a fresh install', async () => {
    await renderWithServices(<ProfileReader />)
    expect(await screen.findByText('no-profile')).toBeTruthy()
  })

  it('reads back a goal that was submitted', async () => {
    await renderWithServices(
      <>
        <Submitter target={1_200_000} />
        <GoalReader />
      </>,
    )
    await screen.findByText('no-goal')
    await userEvent.press(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('target:1200000')).toBeTruthy()
  })

  // FR-006 asks for the change to be visible immediately. Without invalidating both keys
  // the write succeeds, the cache keeps the old answer, and the screen shows the previous
  // figures until something unrelated happens to refetch.
  it('refreshes the profile as well as the goal, since one submission writes both', async () => {
    await renderWithServices(
      <>
        <Submitter target={1_200_000} />
        <ProfileReader />
      </>,
    )
    await screen.findByText('no-profile')
    await userEvent.press(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('expenses:200000')).toBeTruthy()
  })

  // Principle II: the failure has to be visible. `submitGoal` refuses a calculated target
  // that does not match its inputs, and the screen must not end up showing a goal that was
  // never stored.
  it('stores nothing when the submission is refused', async () => {
    await renderWithServices(
      <>
        <Submitter target={1} />
        <GoalReader />
      </>,
    )
    await screen.findByText('no-goal')
    await userEvent.press(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('no-goal')).toBeTruthy()
  })
})
