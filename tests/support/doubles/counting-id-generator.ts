import type { IdGenerator } from '@/domain/ports/id-generator'

/** Turns a issue number into the identifier text. */
export type IdFormat = (sequence: number) => string

/**
 * Formats the counter as a well-formed UUID v4.
 *
 * Use where the identifier's *shape* matters — export document validation and the merge
 * path of FR-047 — and the readable default would pass a test the real app would fail.
 *
 * @param sequence The issue number, from 1.
 */
export const uuidShaped: IdFormat = (sequence) =>
  `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`

/**
 * Issues predictable identifiers in the order they were asked for.
 *
 * The port exists so nothing reaches for randomness inside a rule; this is the half that
 * makes the resulting test assertable. A test can name `id-3` outright rather than
 * matching a pattern, which is the difference between asserting *which* entry was written
 * and asserting merely that one was.
 */
export class CountingIdGenerator implements IdGenerator {
  private issued = 0

  /**
   * @param format How to render the counter. Defaults to `id-1`, `id-2`, …; pass
   *   {@link uuidShaped} where the identifier has to look real.
   */
  public constructor(private readonly format: IdFormat = (sequence) => `id-${sequence}`) {}

  /** @returns The next identifier in the sequence. */
  public uuid(): string {
    this.issued += 1
    return this.format(this.issued)
  }

  /** How many identifiers have been handed out, for asserting nothing issued one extra. */
  public get count(): number {
    return this.issued
  }
}
