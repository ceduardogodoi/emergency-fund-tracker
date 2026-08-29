import { render, screen, userEvent } from '@testing-library/react-native'
import type { ReactNode } from 'react'

import { storageError } from '@/domain/errors'
import { StateView, Text, type ViewState } from '@/ui/primitives'
import { strings } from '@/ui/strings'

/** The one renderer every caller must supply. Spelled out once so each test reads shorter. */
const empty = (): ReactNode => <Text>Nenhum lançamento ainda</Text>
const ready = (data: string): ReactNode => <Text>{data}</Text>

describe('StateView', () => {
  it('renders the loading state without asking the caller for one', async () => {
    const state: ViewState<string> = { kind: 'loading' }
    await render(<StateView state={state} empty={empty} ready={ready} />)
    expect(screen.getByText(strings.state.loading)).toBeTruthy()
  })

  // FR-025: a blank screen is not an empty state. The type requires this renderer, and
  // this asserts the component actually reaches for it.
  it('renders the empty state the caller was required to write', async () => {
    const state: ViewState<string> = { kind: 'empty' }
    await render(<StateView state={state} empty={empty} ready={ready} />)
    expect(screen.getByText('Nenhum lançamento ainda')).toBeTruthy()
  })

  it('renders the error state with copy that says what to do next', async () => {
    const state: ViewState<string> = { kind: 'error', error: storageError('entries.read') }
    await render(<StateView state={state} empty={empty} ready={ready} />)
    expect(screen.getByText(strings.state.errorTitle)).toBeTruthy()
    expect(screen.getByText(strings.state.errorBody)).toBeTruthy()
  })

  it('offers a retry only when the caller supplied one', async () => {
    const retry = jest.fn()
    const state: ViewState<string> = {
      kind: 'error',
      error: storageError('entries.read'),
      retry,
    }
    await render(<StateView state={state} empty={empty} ready={ready} />)
    await userEvent.press(screen.getByRole('button', { name: strings.action.retry }))
    expect(retry).toHaveBeenCalledTimes(1)
  })

  it('shows no retry control when retrying is not possible', async () => {
    const state: ViewState<string> = { kind: 'error', error: storageError('entries.read') }
    await render(<StateView state={state} empty={empty} ready={ready} />)
    expect(screen.queryByRole('button', { name: strings.action.retry })).toBeNull()
  })

  it('hands the ready renderer its data', async () => {
    const state: ViewState<string> = { kind: 'ready', data: 'R$ 1.234,56' }
    await render(<StateView state={state} empty={empty} ready={ready} />)
    expect(screen.getByText('R$ 1.234,56')).toBeTruthy()
  })

  it('lets a screen replace the shared loading treatment', async () => {
    const loading = (): ReactNode => <Text>Calculando</Text>
    const state: ViewState<string> = { kind: 'loading' }
    await render(<StateView state={state} loading={loading} empty={empty} ready={ready} />)
    expect(screen.getByText('Calculando')).toBeTruthy()
    expect(screen.queryByText(strings.state.loading)).toBeNull()
  })

  it('gives a custom error renderer both the error and the retry', async () => {
    const retry = jest.fn()
    const error = storageError('entries.read')
    const renderError = jest.fn((): ReactNode => <Text>Falha ao ler</Text>)
    const state: ViewState<string> = { kind: 'error', error, retry }
    await render(<StateView state={state} empty={empty} ready={ready} error={renderError} />)
    expect(screen.getByText('Falha ao ler')).toBeTruthy()
    expect(renderError).toHaveBeenCalledWith(error, retry)
  })
})
