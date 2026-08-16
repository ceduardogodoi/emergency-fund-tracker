import type { Repositories } from './repositories'
import type { Result } from '../result'

/**
 * Runs work atomically across repositories.
 *
 * FR-046 requires that a failed import leave existing data untouched, with no partial
 * application ever. That guarantee lives here: the import path runs inside exactly one
 * `run` call, so partial application is structurally impossible rather than a matter of
 * getting the ordering right. The same applies to erasing all data and to a replacing
 * import, both of which must be all-or-nothing.
 */
export interface UnitOfWork {
  /**
   * Executes `work` in a transaction.
   *
   * Commits when the callback resolves with a success. Rolls back entirely when it
   * throws, or when it resolves with a failure — a returned failure is a decision to
   * abort, not merely a value to pass along.
   *
   * @param work Receives repositories bound to the transaction. Using repositories from
   *   outside this callback would write outside the transaction and silently defeat it.
   */
  run<T>(work: (repos: Repositories) => Promise<Result<T>>): Promise<Result<T>>
}
