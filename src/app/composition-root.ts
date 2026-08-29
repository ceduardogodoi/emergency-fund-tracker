import { randomUUID } from 'expo-crypto'

import type { Services } from '@/app/services'
import { currencyCode } from '@/domain/money/currency'
import { SystemClock } from '@/platform/clock/system-clock'
import { createIdGenerator } from '@/platform/id/uuid-generator'
import { createLogger } from '@/platform/logging/logger'
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
 * Builds the production service set — the one place a port is bound to an adapter.
 *
 * `SystemClock` and `createIdGenerator` both take their platform source as a parameter
 * rather than reaching for it themselves, which is what makes this the only module under
 * `src/` that imports a native Expo module. Everything else stays loadable in the fast
 * Node test project.
 *
 * @returns A fresh, independent set of services.
 */
export function createServices(): Services {
  return {
    clock: new SystemClock(),
    ids: createIdGenerator(randomUUID),
    // `__DEV__` rather than a build flag of our own: it is the one signal both platforms
    // already agree on, and it is statically false in a release bundle, so the branch that
    // ships is the silent one.
    logger: createLogger({ enabled: __DEV__ }),
    format: createFormatters({ currency: CURRENCY, locale: LOCALE }),
  }
}
