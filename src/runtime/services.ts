import type { CurrencyCode } from '@/domain/money/currency'
import type { Clock } from '@/domain/ports/clock'
import type { IdGenerator } from '@/domain/ports/id-generator'
import type { Logger } from '@/domain/ports/logger'
import type { UnitOfWork } from '@/domain/ports/unit-of-work'
import type { Formatters } from '@/ui/format'

/**
 * Every port the app depends on, resolved to a concrete implementation.
 *
 * Assembled once at startup and passed down, rather than imported where used. That is what
 * makes the dependency inversion in Principle III real at runtime: a screen asks for what
 * it needs and cannot reach past this object to a module-level singleton.
 *
 * The type lives apart from both the wiring that builds it and the context that carries
 * it, so a module that only needs to name the shape — a test fake, a feature hook's
 * signature — does not pull the adapters or React in behind it.
 */
export interface Services {
  /** Supplies today and now. Nothing else in the app reads the wall clock. */
  readonly clock: Clock
  /** Supplies the identifiers that travel in the export document (FR-047). */
  readonly ids: IdGenerator
  /** The single logging interface. Never leaves the device (FR-041). */
  readonly logger: Logger
  /** The single way stored values become text (the ui-contract's copy rule). */
  readonly format: Formatters
  /**
   * The currency every amount is stored and shown in, fixed at setup (FR-039).
   *
   * Carried here as well as inside `format` because the domain needs it to write a profile,
   * and reading it back out of a formatter would mean the value the app stores and the
   * value it renders came from different places.
   */
  readonly currency: CurrencyCode
  /**
   * The only door to storage. Every read and write runs inside one of its transactions.
   *
   * The repository set is reached through here rather than exposed alongside it, so no
   * caller can hold a repository outside a transaction — which is what would let two
   * writes half-succeed. Not every repository behind it is implemented yet; the ones that
   * are not fail loudly rather than answering. See `src/data/sqlite/repositories/pending.ts`.
   */
  readonly unitOfWork: UnitOfWork
}
