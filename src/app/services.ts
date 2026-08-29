import type { Clock } from '@/domain/ports/clock'
import type { IdGenerator } from '@/domain/ports/id-generator'
import type { Logger } from '@/domain/ports/logger'
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
}

/*
 * Not yet here: `unitOfWork`, and with it the repository set. Nothing implements the
 * repository ports until T059, and a factory that threw when called would be worse than
 * the omission — it would compile, wire cleanly, and fail at the first read. The field is
 * additive when the first repository lands; T059 carries the reminder.
 */
