import { randomUUID } from 'expo-crypto'

import type { Services } from '@/runtime/services'
import { bootstrapDatabase, createUnitOfWork } from '@/data/sqlite/database'
import type { SqliteDatabase } from '@/data/sqlite/driver'
import { openDeviceDatabase } from '@/data/sqlite/expo-driver'
import { createRepositoriesFactory } from '@/data/sqlite/repositories/factory'
import { currencyCode } from '@/domain/money/currency'
import { SystemClock } from '@/platform/clock/system-clock'
import { createIdGenerator } from '@/platform/id/uuid-generator'
import { createLogger } from '@/platform/logging/logger'
import { isErr, ok, type Result } from '@/domain/result'
import { createFormatters } from '@/ui/format'

/**
 * The single currency this release stores and renders (FR-039, research decision D-019).
 *
 * A constant rather than a setting: currency selection needs a picker, a migration path
 * for existing amounts, and an answer for what happens to history when it changes — none
 * of which is specified. Keeping it here means adding selection later is a screen and a
 * migration, not a change to the data model.
 */
const CURRENCY = currencyCode('BRL')

/**
 * The single locale (research decision D-020).
 *
 * Pinned rather than left to the device, which is what `createFormatters` does when given
 * no locale. The interface text is Portuguese, and a device set to en-US would render
 * Portuguese copy around `R$1,234.56` — a mix that reads as a bug and, with the separators
 * swapped, as a different amount.
 */
const LOCALE = 'pt-BR'

/**
 * Binds every port to its adapter, given an already-open database.
 *
 * Takes the database rather than opening one, which is what keeps this function pure
 * wiring: it is synchronous, cannot fail, and can be exercised against any implementation
 * of the driver port. {@link openServices} is the half that touches the device.
 *
 * @param db An open, migrated database.
 * @returns A fresh, independent set of services.
 */
export function createServices(db: SqliteDatabase): Services {
  const clock = new SystemClock()
  const ids = createIdGenerator(randomUUID)

  return {
    clock,
    ids,
    // `__DEV__` rather than a build flag of our own: it is the one signal both platforms
    // already agree on, and it is statically false in a release bundle, so the branch that
    // ships is the silent one.
    logger: createLogger({ enabled: __DEV__ }),
    format: createFormatters({ currency: CURRENCY, locale: LOCALE }),
    currency: CURRENCY,
    unitOfWork: createUnitOfWork(db, createRepositoriesFactory(clock, ids)),
  }
}

/**
 * Opens the device database, brings it to the current schema, and wires the services.
 *
 * Returns a `Result` rather than throwing: a database that cannot be opened or migrated is
 * the one failure the app cannot start without, and it has to reach the root layout as
 * something it can render an error state for. A thrown exception here would be a white
 * screen.
 *
 * @returns The services, or the storage failure that stopped the app booting.
 */
export async function openServices(): Promise<Result<Services>> {
  const db = await openDeviceDatabase()
  const migrated = await bootstrapDatabase(db)
  if (isErr(migrated)) {
    return migrated
  }
  return ok(createServices(db))
}
