import { render, screen } from '@testing-library/react-native'
import { randomUUID } from 'expo-crypto'
import type { ReactNode } from 'react'

import { createServices } from '@/app/composition-root'
import { ServicesProvider, useServices } from '@/app/services-context'
import type { SqliteDatabase } from '@/data/sqlite/driver'
import { money } from '@/domain/money/money'
import { Text } from '@/ui/primitives'

/**
 * The composition root is the one place the app decides which adapter satisfies which
 * port. These tests pin the decisions that would otherwise only be visible by reading it:
 * the currency, the locale, and the fact that nothing may reach a service without a
 * provider above it.
 *
 * `createServices` takes an open database rather than opening one, so these run against a
 * stand-in that answers nothing. That is the point of the split: the wiring decisions are
 * checkable without a database, and `openServices` — the half that touches the device — is
 * covered by the on-device smoke flow instead.
 */
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn() }))

/**
 * A database that is never queried.
 *
 * Every method rejects rather than returning empty: nothing in these tests should reach
 * storage, and a stub that quietly answered would let a test pass while exercising a code
 * path it was not meant to.
 */
const unusedDatabase: SqliteDatabase = {
  execute: () => Promise.reject(new Error('The test database was not meant to be used.')),
  run: () => Promise.reject(new Error('The test database was not meant to be used.')),
  selectAll: () => Promise.reject(new Error('The test database was not meant to be used.')),
  selectOne: () => Promise.reject(new Error('The test database was not meant to be used.')),
  close: () => Promise.reject(new Error('The test database was not meant to be used.')),
}

describe('createServices', () => {
  it('binds the formatters to BRL, the single currency this release ships (D-019)', () => {
    expect(createServices(unusedDatabase).format.money(money(123_456))).toContain('R$')
  })

  it('binds the formatters to pt-BR, so the text and the numbers agree (D-020)', () => {
    // pt-BR groups with '.' and separates decimals with ','. en-US would be the reverse,
    // which would put a Portuguese screen's amounts in another language's notation.
    expect(createServices(unusedDatabase).format.money(money(123_456))).toContain('1.234,56')
  })

  it('supplies a clock that reports the device zone rather than assuming UTC', () => {
    expect(createServices(unusedDatabase).clock.timeZone()).toBe(
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    )
  })

  // Asserting two ids differ would not work here: jest-expo replaces the native module,
  // and its `randomUUID` returns undefined, so both calls would be equal for a reason that
  // says nothing about this file. Mocking the source instead tests what is actually being
  // decided here — that the port is bound to the platform generator, and that every call
  // reaches it rather than a value captured once.
  it('binds the id generator to the platform UUID source', () => {
    jest
      .mocked(randomUUID)
      .mockReturnValueOnce('11111111-1111-4111-8111-111111111111')
      .mockReturnValueOnce('22222222-2222-4222-8222-222222222222')
    const { ids } = createServices(unusedDatabase)
    expect(ids.uuid()).toBe('11111111-1111-4111-8111-111111111111')
    expect(ids.uuid()).toBe('22222222-2222-4222-8222-222222222222')
  })

  it('builds an independent set per call, so one test cannot observe another', () => {
    expect(createServices(unusedDatabase)).not.toBe(createServices(unusedDatabase))
  })
})

describe('useServices', () => {
  it('reaches the services the provider was given', async () => {
    const services = createServices(unusedDatabase)

    function Amount(): ReactNode {
      return <Text>{useServices().format.money(money(500))}</Text>
    }

    await render(
      <ServicesProvider services={services}>
        <Amount />
      </ServicesProvider>,
    )
    expect(screen.getByText(services.format.money(money(500)))).toBeTruthy()
  })

  // Without this, a component rendered outside the provider would read a default set of
  // services that works — and would keep working, silently holding its own clock and its
  // own database handle, until something depended on the two agreeing.
  it('refuses to fall back to a default set when no provider is above it', async () => {
    function Orphan(): ReactNode {
      return <Text>{useServices().format.money(money(500))}</Text>
    }

    await expect(render(<Orphan />)).rejects.toThrow(/ServicesProvider/)
  })
})
