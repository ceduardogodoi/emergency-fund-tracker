import { screen, waitFor } from '@testing-library/react-native'
import type { RedirectProps } from 'expo-router'

import { calendarDate } from '@/domain/dates/calendar-date'
import { storageError } from '@/domain/errors/app-error'
import { money } from '@/domain/money/money'
import { err } from '@/domain/result'
import { strings } from '@/ui/strings'
import { createAppHarness, type AppHarness } from '@tests/support/app-harness'
import { expectOk } from '@tests/support/expect-result'
import SeedScreen from '../../app/dev/seed'

/**
 * The development-only seed route (T087), which `npm run seed` opens by link.
 *
 * What it writes goes through the rules the app's own screens use — `submitGoal` and
 * `recordEntry` — so a seeded fund is one the app could have produced.
 */
const TODAY = '2026-10-24'

const mockReplace = jest.fn()
const mockRedirect = jest.fn()
let mockParams: Record<string, string> = {}

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useLocalSearchParams: () => mockParams,
  Redirect: ({ href }: RedirectProps) => {
    mockRedirect(href)
    return null
  },
}))

let harness: AppHarness

beforeEach(() => {
  harness = createAppHarness(TODAY)
  mockReplace.mockClear()
  mockRedirect.mockClear()
  mockParams = {}
})

afterEach(async () => {
  await harness.teardown()
})

/**
 * A fund that is plainly not what a seed writes: a target the user typed, and an entry of
 * an amount no seed produces. Whatever survives a seed or a reset is recognisable.
 */
async function storeSomethingElse(): Promise<void> {
  expectOk(
    await harness.repositories.profile.save({
      monthlyExpenses: money(333_300),
      currency: harness.services.currency,
    }),
  )
  expectOk(
    await harness.repositories.goal.save({
      target: money(5_000_000),
      source: 'user_defined',
      levelKey: 'custom',
      coverageMonths: 15,
      desiredCompletionDate: null,
    }),
  )
  expectOk(
    await harness.repositories.ledger.add({
      type: 'contribution',
      amount: money(77_777),
      date: calendarDate('2026-10-01'),
      note: 'Guardado à mão',
      withdrawalReason: null,
    }),
  )
}

/** The ledger as amount and date, the two things a seed decides. */
async function storedHistory(): Promise<readonly { amount: number; date: string }[]> {
  return expectOk(await harness.repositories.ledger.list()).map(({ amount, date }) => ({
    amount,
    date,
  }))
}

/** Sets the flag React Native compiles to false in a release build. */
function setDevelopment(value: boolean): void {
  Object.assign(globalThis, { __DEV__: value })
}

async function seeded(): Promise<void> {
  await waitFor(() => {
    expect(mockReplace).toHaveBeenCalledWith('/')
  })
}

describe('the seed route', () => {
  it('replaces what was stored with a goal and a steady history, then goes Home', async () => {
    await storeSomethingElse()
    mockParams = { months: '3', pattern: 'steady' }

    const erase = jest.spyOn(harness.repositories.store, 'eraseAll')

    await harness.render(<SeedScreen />)
    await seeded()

    expect(expectOk(await harness.repositories.profile.get())).toMatchObject({
      monthlyExpenses: 200_000,
    })
    expect(expectOk(await harness.repositories.goal.get())).toMatchObject({
      target: 1_200_000,
      source: 'calculated',
      levelKey: 'balanced',
      coverageMonths: 6,
    })
    expect(await storedHistory()).toEqual([
      { amount: 50_000, date: '2026-07-05' },
      { amount: 50_000, date: '2026-08-05' },
      { amount: 50_000, date: '2026-09-05' },
    ])
    // Once. The effect that starts it re-runs on every render, and unguarded it seeded
    // 2 835 times in 300ms, each one erasing the last.
    expect(erase).toHaveBeenCalledTimes(1)
  })

  // The same command, the same history: a figure checked by hand once can be checked again.
  it('writes the same erratic history every time it is asked', async () => {
    mockParams = { months: '12', pattern: 'erratic' }

    await harness.render(<SeedScreen />)
    await seeded()
    const first = await storedHistory()
    // A second install, torn down and rebuilt the way every test is.
    await harness.teardown()
    harness = createAppHarness(TODAY)
    mockReplace.mockClear()
    await harness.render(<SeedScreen />)
    await seeded()

    expect(await storedHistory()).toEqual(first)
    // Erratic, and not the steady saver under another name.
    expect(new Set(first.map((entry) => entry.amount)).size).toBeGreaterThan(1)
  })

  it('empties the store for a reset, which Home then treats as a first launch', async () => {
    await storeSomethingElse()
    mockParams = { reset: '1' }

    await harness.render(<SeedScreen />)
    await seeded()

    expect(expectOk(await harness.repositories.profile.get())).toBeNull()
    expect(expectOk(await harness.repositories.goal.get())).toBeNull()
    expect(await storedHistory()).toEqual([])
  })

  it('says what is wrong with the link, and touches nothing', async () => {
    await storeSomethingElse()
    mockParams = { months: '8', pattern: 'stedy' }

    await harness.render(<SeedScreen />)

    expect(await screen.findByText(strings.dev.seedProblems['pattern-unknown'])).toBeTruthy()
    expect(await storedHistory()).toEqual([{ amount: 77_777, date: '2026-10-01' }])
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('says so when seeding fails, and stays put', async () => {
    jest
      .spyOn(harness.repositories.store, 'eraseAll')
      .mockResolvedValue(err(storageError('store.erase-failed')))
    mockParams = { months: '3' }

    await harness.render(<SeedScreen />)

    expect(await screen.findByText(strings.dev.seedFailed)).toBeTruthy()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  // A production build carries every route under `app/`, this one included. Outside
  // development it must not erase anything a link tells it to.
  it('does nothing outside development but go Home', async () => {
    const development = __DEV__
    setDevelopment(false)
    try {
      await storeSomethingElse()
      mockParams = { reset: '1' }

      await harness.render(<SeedScreen />)

      expect(mockRedirect).toHaveBeenCalledWith('/')
      expect(await storedHistory()).toEqual([{ amount: 77_777, date: '2026-10-01' }])
    } finally {
      setDevelopment(development)
    }
  })
})
