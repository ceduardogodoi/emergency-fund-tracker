import { screen, userEvent } from '@testing-library/react-native'
import { useState, type ReactNode } from 'react'

import { useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/runtime/query'
import type { Goal } from '@/domain/goal/types'
import { money } from '@/domain/money/money'
import { useGoal, useProfile, useSubmitGoal } from '@/features/goal/hooks'
import { Button, Text } from '@/ui/primitives'
import { createAppHarness, type AppHarness } from '@tests/support/app-harness'

/**
 * What these cover is the seam between a screen and storage: that a write lands, and that
 * every read depending on it refreshes afterwards.
 *
 * The components below are the smallest thing that can exercise a hook — a reader that
 * reports whichever state it is in, and a button that submits. The real screens are tested
 * in `onboarding.test.tsx`; the subject here is the hook, so anything a screen would add
 * around it is noise.
 */
let harness: AppHarness

beforeEach(() => {
  harness = createAppHarness()
})

afterEach(async () => {
  await harness.teardown()
})

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

/**
 * Submits a goal when pressed, so a test can drive the mutation from the tree.
 *
 * It reads the cache at the instant the mutation resolves and renders what it found. That
 * instant is the one a screen acts on — it navigates there, and the screen it navigates to
 * reads the cache on its first render. Waiting for the mutation's rendered status instead
 * would allow a refetch a few microtasks to land, which is exactly the gap under test.
 */
function Submitter({ target }: { readonly target: number }): ReactNode {
  const submit = useSubmitGoal()
  const queryClient = useQueryClient()
  const [cacheAtSuccess, setCacheAtSuccess] = useState<string | null>(null)

  const save = async (): Promise<void> => {
    try {
      await submit.mutateAsync({
        monthlyExpenses: money(200_000),
        goal: {
          target: money(target),
          source: 'calculated',
          levelKey: 'balanced',
          coverageMonths: 6,
          desiredCompletionDate: null,
        },
      })
    } catch {
      // Reported through `submit.status` below; a rejection here is a result, not a crash.
      return
    }
    const cached = queryClient.getQueryData<Goal | null>(queryKeys.goal())
    setCacheAtSuccess(cached === null || cached === undefined ? 'none' : `target:${cached.target}`)
  }

  return (
    <>
      <Button
        label="Salvar"
        onPress={() => {
          void save()
        }}
      />
      <Text>{`mutation:${submit.status}`}</Text>
      {cacheAtSuccess === null ? null : <Text>{`at-success:${cacheAtSuccess}`}</Text>}
    </>
  )
}

/**
 * A reader that can be dismissed, so a test can reproduce the state that matters: a query
 * whose observer has gone while its cached answer stays behind.
 */
function Stage({ target }: { readonly target: number }): ReactNode {
  const [reading, setReading] = useState(true)
  return (
    <>
      {reading ? <GoalReader /> : null}
      <Button
        label="Sair"
        onPress={() => {
          setReading(false)
        }}
      />
      <Submitter target={target} />
    </>
  )
}

describe('the goal hooks', () => {
  it('reports no goal on a fresh install, which is what sends the user to onboarding', async () => {
    await harness.render(<GoalReader />)
    expect(await screen.findByText('no-goal')).toBeTruthy()
  })

  it('reports no profile on a fresh install', async () => {
    await harness.render(<ProfileReader />)
    expect(await screen.findByText('no-profile')).toBeTruthy()
  })

  it('reads back a goal that was submitted', async () => {
    await harness.render(
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
    await harness.render(
      <>
        <Submitter target={1_200_000} />
        <ProfileReader />
      </>,
    )
    await screen.findByText('no-profile')
    await userEvent.press(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('expenses:200000')).toBeTruthy()
  })

  /*
   * The saved goal has to be in the cache by the time the mutation reports success, not
   * merely marked stale.
   *
   * A screen navigates on success, and the screen it lands on reads the cache. Home is the
   * case that matters: on first launch it reads the goal, finds none, and leaves that null
   * behind when it redirects into onboarding. Invalidating alone does not refetch a query
   * with no observer, so Home would mount, read that null synchronously, and redirect the
   * user straight back to step one — with their saved goal invisible until the next cold
   * start. Which is exactly what `e2e/us1-set-target.yaml` caught on a device.
   */
  it('has the write in the cache before it reports success', async () => {
    await harness.render(<Stage target={1_200_000} />)
    // Home reads the goal, finds none, and that null stays in the cache behind it.
    await screen.findByText('no-goal')
    // Home unmounts, the way it does when the user is sent into onboarding. The query
    // keeps its function and loses its observer, which is the state that matters:
    // seeding the cache directly would not reproduce it, because a query written that
    // way has no function to refetch with.
    await userEvent.press(screen.getByRole('button', { name: 'Sair' }))

    await userEvent.press(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('at-success:target:1200000')).toBeTruthy()
  })

  // Principle II: the failure has to be visible. `submitGoal` refuses a calculated target
  // that does not match its inputs, and the screen must not end up showing a goal that was
  // never stored.
  it('stores nothing when the submission is refused', async () => {
    await harness.render(
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
