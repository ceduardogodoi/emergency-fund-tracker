import { useQueryClient } from '@tanstack/react-query'
import { screen, userEvent } from '@testing-library/react-native'
import { useState, type ReactNode } from 'react'

import { queryKeys } from '@/runtime/query'
import { storageError } from '@/domain/errors/app-error'
import { calendarDate } from '@/domain/dates/calendar-date'
import type { LedgerEntry, LedgerEntryInput } from '@/domain/ledger/types'
import { money } from '@/domain/money/money'
import { err } from '@/domain/result'
import {
  useAddEntry,
  useBalance,
  useEntries,
  useFutureDatedEntries,
  useRemoveEntry,
  useUpdateEntry,
} from '@/features/entries/hooks'
import { Button, Text } from '@/ui/primitives'
import { createAppHarness, type AppHarness } from '@tests/support/app-harness'
import { expectOk } from '@tests/support/expect-result'

/**
 * The seam between a screen and the ledger: that a write lands, and that every read
 * depending on it refreshes afterwards.
 *
 * The components below are the smallest thing that can exercise a hook. The real screens
 * are tested in `entries.test.tsx`; the subject here is the hook, so anything a screen
 * would add around it is noise.
 *
 * The balance is the reason invalidation matters more here than anywhere else. It is
 * derived from these rows and stored nowhere, so a cache that does not refresh after a
 * write shows a figure that was true a moment ago — which is indistinguishable, on screen,
 * from one that is true now.
 */
const TODAY = '2026-08-22'

/** The entry under test, so each case states only the field it is about. */
function entryInput(overrides: Partial<LedgerEntryInput> = {}): LedgerEntryInput {
  return {
    type: 'contribution',
    amount: money(50_000),
    date: calendarDate(TODAY),
    note: null,
    withdrawalReason: null,
    ...overrides,
  }
}

let harness: AppHarness

beforeEach(() => {
  harness = createAppHarness(TODAY)
})

afterEach(async () => {
  await harness.teardown()
})

/** Reads the history and reports whichever state it is in. */
function EntriesReader(): ReactNode {
  const entries = useEntries()
  if (entries.status !== 'success') {
    return <Text>{entries.status}</Text>
  }
  return <Text>{`entries:${entries.data.map((entry) => entry.amount).join(',') || 'none'}`}</Text>
}

/** Reads the balance, which is the figure Home exists to show. */
function BalanceReader(): ReactNode {
  const balance = useBalance()
  return <Text>{balance.status === 'success' ? `balance:${balance.data}` : balance.status}</Text>
}

/** Reads the entries dated ahead of today, which FR-033 surfaces for correction. */
function FutureReader(): ReactNode {
  const future = useFutureDatedEntries()
  if (future.status !== 'success') {
    return <Text>{future.status}</Text>
  }
  return <Text>{`future:${future.data.length}`}</Text>
}

/**
 * Adds an entry when pressed, reporting the cache at the instant the mutation resolves.
 *
 * That instant is the one a screen acts on: it navigates there, and the screen it lands on
 * reads the cache on its first render. Waiting for a rendered status instead would allow a
 * refetch a few microtasks to land, which is exactly the gap this is watching.
 */
function Adder({ input }: { readonly input: LedgerEntryInput }): ReactNode {
  const add = useAddEntry()
  const queryClient = useQueryClient()
  const [cacheAtSuccess, setCacheAtSuccess] = useState<string | null>(null)

  const save = async (): Promise<void> => {
    try {
      await add.mutateAsync(input)
    } catch {
      // Reported through `add.status` below; a rejection here is a result, not a crash.
      return
    }
    const cached = queryClient.getQueryData<readonly LedgerEntry[]>(queryKeys.entries())
    setCacheAtSuccess(cached === undefined ? 'none' : `${cached.length}`)
  }

  return (
    <>
      <Button
        label="Adicionar"
        onPress={() => {
          void save()
        }}
      />
      <Text>{`add:${add.status}`}</Text>
      {cacheAtSuccess === null ? null : <Text>{`at-success:${cacheAtSuccess}`}</Text>}
    </>
  )
}

/** Edits the first entry it can see, so a test can drive the update mutation. */
function Editor(): ReactNode {
  const entries = useEntries()
  const update = useUpdateEntry()
  const first = entries.data?.[0]

  return (
    <Button
      label="Editar"
      disabled={first === undefined}
      onPress={() => {
        if (first !== undefined) {
          update.mutate({ id: first.id, patch: { amount: money(90_000) } })
        }
      }}
    />
  )
}

/** Deletes the first entry it can see. */
function Remover(): ReactNode {
  const entries = useEntries()
  const remove = useRemoveEntry()
  const first = entries.data?.[0]

  return (
    <Button
      label="Excluir"
      disabled={first === undefined}
      onPress={() => {
        if (first !== undefined) {
          remove.mutate(first.id)
        }
      }}
    />
  )
}

/**
 * A reader that can be dismissed, so a test can reproduce the state that matters: a query
 * whose observer has gone while its cached answer stays behind. That is the shape of the
 * defect `useSubmitGoal` was fixed for, and every mutation here can reproduce it.
 */
function Stage({ input }: { readonly input: LedgerEntryInput }): ReactNode {
  const [reading, setReading] = useState(true)
  return (
    <>
      {reading ? <BalanceReader /> : null}
      <Button
        label="Sair"
        onPress={() => {
          setReading(false)
        }}
      />
      <Adder input={input} />
    </>
  )
}

describe('the entry hooks', () => {
  it('reports an empty history on a fresh install', async () => {
    await harness.render(<EntriesReader />)

    expect(await screen.findByText('entries:none')).toBeTruthy()
  })

  it('reports a balance of zero before anything is saved', async () => {
    await harness.render(<BalanceReader />)

    expect(await screen.findByText('balance:0')).toBeTruthy()
  })

  it('reads back an entry that was added', async () => {
    await harness.render(
      <>
        <Adder input={entryInput()} />
        <EntriesReader />
      </>,
    )
    await screen.findByText('entries:none')

    await userEvent.press(screen.getByRole('button', { name: 'Adicionar' }))

    expect(await screen.findByText('entries:50000')).toBeTruthy()
  })

  it('moves the balance with the entries it is derived from', async () => {
    await harness.render(
      <>
        <Adder input={entryInput()} />
        <BalanceReader />
      </>,
    )
    await screen.findByText('balance:0')

    await userEvent.press(screen.getByRole('button', { name: 'Adicionar' }))

    expect(await screen.findByText('balance:50000')).toBeTruthy()
  })

  // The defect class US1 shipped: a query with no observer is invalidated but never
  // refetched, so the screen navigated to reads the stale answer its predecessor left.
  it('refreshes a reader that was unmounted before the write', async () => {
    await harness.render(<Stage input={entryInput()} />)
    await screen.findByText('balance:0')
    await userEvent.press(screen.getByRole('button', { name: 'Sair' }))

    await userEvent.press(screen.getByRole('button', { name: 'Adicionar' }))

    expect(await screen.findByText('at-success:1')).toBeTruthy()
  })

  it('refreshes the history after an edit', async () => {
    await harness.render(
      <>
        <Adder input={entryInput()} />
        <Editor />
        <EntriesReader />
      </>,
    )
    await userEvent.press(screen.getByRole('button', { name: 'Adicionar' }))
    await screen.findByText('entries:50000')

    await userEvent.press(screen.getByRole('button', { name: 'Editar' }))

    expect(await screen.findByText('entries:90000')).toBeTruthy()
  })

  it('refreshes the history after a deletion', async () => {
    await harness.render(
      <>
        <Adder input={entryInput()} />
        <Remover />
        <EntriesReader />
      </>,
    )
    await userEvent.press(screen.getByRole('button', { name: 'Adicionar' }))
    await screen.findByText('entries:50000')

    await userEvent.press(screen.getByRole('button', { name: 'Excluir' }))

    expect(await screen.findByText('entries:none')).toBeTruthy()
  })

  /**
   * FR-033: dated ahead, so it is surfaced on its own and kept out of the balance. Both
   * halves matter — a warning nobody sees, or a figure counting money not yet moved.
   *
   * Seeded through the repository rather than through `useAddEntry`, because the app cannot
   * produce one: FR-009 refuses a future date at entry, and the hook enforces it. They
   * arrive the two ways the rules do not reach — an imported file (FR-046), or a device
   * whose clock was ahead when the entry was made and has since been corrected. That is
   * why FR-033 asks for them to be flagged for correction rather than prevented.
   */
  it('surfaces a future-dated entry without letting it reach the balance', async () => {
    expectOk(
      await harness.repositories.ledger.add(entryInput({ date: calendarDate('2026-08-23') })),
    )

    await harness.render(
      <>
        <FutureReader />
        <BalanceReader />
      </>,
    )

    expect(await screen.findByText('future:1')).toBeTruthy()
    expect(screen.getByText('balance:0')).toBeTruthy()
  })

  // The other half of FR-009, from the hook's side: the rule reaches the mutation, so a
  // screen cannot write a date the domain refuses by forgetting to check first.
  it('refuses a future-dated entry at entry', async () => {
    await harness.render(<Adder input={entryInput({ date: calendarDate('2026-08-23') })} />)

    await userEvent.press(screen.getByRole('button', { name: 'Adicionar' }))

    expect(await screen.findByText('add:error')).toBeTruthy()
    expect(expectOk(await harness.repositories.ledger.list())).toHaveLength(0)
  })

  // The rules in `validateEntry` reach every path that writes, not only the form. A screen
  // is not the only caller: an imported file (FR-046) arrives here too.
  it('refuses an entry the domain rejects, and writes nothing', async () => {
    await harness.render(
      <>
        <Adder input={entryInput({ amount: money(0) })} />
        <EntriesReader />
      </>,
    )
    await screen.findByText('entries:none')

    await userEvent.press(screen.getByRole('button', { name: 'Adicionar' }))

    expect(await screen.findByText('add:error')).toBeTruthy()
    expect(screen.getByText('entries:none')).toBeTruthy()
  })

  // The opening check reads the ledger, and that read can fail for reasons that have
  // nothing to do with the entry. Answering "you already have an opening balance" because
  // a disk was busy would send the user to fix something that is not wrong.
  it('reports a failed opening check as the storage failure it is', async () => {
    jest
      .spyOn(harness.repositories.ledger, 'list')
      .mockResolvedValue(err(storageError('ledger.read-failed')))

    await harness.render(<Adder input={entryInput({ type: 'opening' })} />)
    await userEvent.press(screen.getByRole('button', { name: 'Adicionar' }))

    expect(await screen.findByText('add:error')).toBeTruthy()
    jest.spyOn(harness.repositories.ledger, 'list').mockRestore()
    expect(expectOk(await harness.repositories.ledger.list())).toHaveLength(0)
  })

  it('refuses a second opening balance, naming the field rather than failing in storage', async () => {
    await harness.render(<Adder input={entryInput({ type: 'opening' })} />)
    await userEvent.press(screen.getByRole('button', { name: 'Adicionar' }))
    await screen.findByText('add:success')

    await userEvent.press(screen.getByRole('button', { name: 'Adicionar' }))

    expect(await screen.findByText('add:error')).toBeTruthy()
    expect(expectOk(await harness.repositories.ledger.list())).toHaveLength(1)
  })
})
