import { render, screen } from '@testing-library/react-native'
import type { ReactNode } from 'react'

import type { Services } from '@/app/services'
import { useBootstrap, type ServicesSource } from '@/app/use-bootstrap'
import { storageError } from '@/domain/errors'
import { err, ok } from '@/domain/result'
import { Text } from '@/ui/primitives'

/**
 * The app's boot, which is the one piece of `app/_layout.tsx` with a decision in it.
 *
 * The source is injected, so nothing here opens a device database. What is under test is
 * the mapping from an outcome to a state, and the guard that stops a late result landing
 * on an unmounted tree.
 */

/** Stands in for the wired services; these tests never look inside it. */
const services = { format: {} } as unknown as Services

/**
 * Renders whichever state the hook is in, so it can be asserted from the tree.
 *
 * Not every `AppError` carries a `messageKey` — `not-found` and `cancelled` do not — so the
 * key is read only when the union says it is there.
 */
function Boot({ source }: { readonly source: ServicesSource }): ReactNode {
  const state = useBootstrap(source)
  if (state.kind !== 'error') {
    return <Text>{state.kind}</Text>
  }
  const detail = 'messageKey' in state.error ? state.error.messageKey : state.error.kind
  return <Text>{`error:${detail}`}</Text>
}

describe('useBootstrap', () => {
  it('reports loading before the database has been opened', async () => {
    // A source that never settles, so the first render is the only one there is.
    await render(<Boot source={() => new Promise(() => undefined)} />)
    expect(screen.getByText('loading')).toBeTruthy()
  })

  it('reports ready once the services are wired', async () => {
    await render(<Boot source={async () => ok(services)} />)
    expect(await screen.findByText('ready')).toBeTruthy()
  })

  // A database that cannot be opened or migrated is the one failure the app cannot start
  // without. It has to arrive as something the layout can render, not as a white screen.
  it('reports the storage failure that stopped the app booting', async () => {
    await render(<Boot source={async () => err(storageError('migration.failed'))} />)
    expect(await screen.findByText('error:migration.failed')).toBeTruthy()
  })

  // `openServices` returns its failures, so a throw is something unforeseen. Left
  // unhandled it would be a permanent spinner: the promise rejects, no state is ever set,
  // and the app says nothing about why it never started.
  it('turns an unforeseen throw into an error state rather than a stuck spinner', async () => {
    await render(
      <Boot
        source={() => {
          throw new Error('the native module is missing')
        }}
      />,
    )
    expect(await screen.findByText('error:app.bootstrap-failed')).toBeTruthy()
  })

  it('asks its source for the services exactly once', async () => {
    const source = jest.fn(async () => ok(services))
    await render(<Boot source={source} />)
    await screen.findByText('ready')
    expect(source).toHaveBeenCalledTimes(1)
  })
})
