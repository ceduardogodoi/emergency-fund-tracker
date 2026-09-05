import { screen, userEvent } from '@testing-library/react-native'
import type { ReactNode } from 'react'

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
