import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'

import { useServices } from '@/runtime/services-context'
import type { CalendarDate } from '@/domain/dates/calendar-date'
import type { AppError } from '@/domain/errors'
import { COVERAGE_MONTHS } from '@/domain/goal/levels'
import { submitGoal } from '@/domain/goal/submit-goal'
import { calculateTarget } from '@/domain/goal/target'
import { recordEntry } from '@/domain/ledger/record-entry'
import type { CurrencyCode } from '@/domain/money/currency'
import { money } from '@/domain/money/money'
import type { Repositories } from '@/domain/ports/repositories'
import { isErr, ok, type Result } from '@/domain/result'
import { createSeededRandom, planHistory, type SeedRequest } from './seed-history'

/** Where every generated history starts, so the same command writes the same entries. */
const RANDOM_START = 2_026

/** The seeded saver's essential expenses, R$ 2.000,00 a month. */
const SEED_EXPENSES = money(200_000)

/**
 * Empties the store and, for a seed, writes a goal and a history (T087).
 *
 * Through `submitGoal` and `recordEntry`, the operations the app's own screens use, so a
 * seeded fund is one the app could have produced: every entry passes the rules a typed one
 * would. The goal is balanced, six months of R$ 2.000,00, the level a new user starts on.
 *
 * Run inside one transaction by the caller, so a seed that fails partway leaves the fund
 * as it was rather than erased and half written.
 *
 * @param repositories The repository set for the current transaction.
 * @param request What to write.
 * @param today The current date, from the `Clock` port.
 * @param currency The currency the fund is kept in.
 * @returns Nothing, or the first failure.
 */
export async function applySeed(
  repositories: Repositories,
  request: SeedRequest,
  today: CalendarDate,
  currency: CurrencyCode,
): Promise<Result<void>> {
  const erased = await repositories.store.eraseAll()
  if (isErr(erased) || request.kind === 'reset') {
    return erased
  }

  const goal = await submitGoal(repositories, {
    monthlyExpenses: SEED_EXPENSES,
    goal: {
      target: calculateTarget(SEED_EXPENSES, COVERAGE_MONTHS.balanced),
      source: 'calculated',
      levelKey: 'balanced',
      coverageMonths: COVERAGE_MONTHS.balanced,
      desiredCompletionDate: null,
    },
    currency,
  })
  if (isErr(goal)) {
    return goal
  }

  const random = createSeededRandom(RANDOM_START)
  for (const entry of planHistory(request.months, request.pattern, today, random)) {
    const recorded = await recordEntry(repositories, entry, today)
    if (isErr(recorded)) {
      return recorded
    }
  }
  return ok(undefined)
}

/**
 * Seeds or resets the store, then refreshes every cached read.
 *
 * Everything is invalidated, not only the ledger: the goal and the profile were replaced
 * too, and a screen reading either from the cache would show the fund that was erased.
 *
 * @returns The mutation. A failure is logged for the developer who ran the script.
 */
export function useSeed(): UseMutationResult<void, AppError, SeedRequest> {
  const { unitOfWork, clock, currency, logger } = useServices()
  const queryClient = useQueryClient()

  return useMutation<void, AppError, SeedRequest>({
    mutationFn: async (request) => {
      const result = await unitOfWork.run(async (repositories) =>
        applySeed(repositories, request, clock.today(), currency),
      )
      if (isErr(result)) {
        logger.error('dev.seed-failed', { kind: result.error.kind })
        throw result.error
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ refetchType: 'all' })
    },
  })
}
