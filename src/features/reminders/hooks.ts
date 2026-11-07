import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query'

import { queryKeys, unwrap } from '@/runtime/query'
import { useServices } from '@/runtime/services-context'
import type { AppError } from '@/domain/errors'
import type { SafeContext } from '@/domain/ports/logger'
import { saveReminder } from '@/domain/reminders/save-reminder'
import type { ReminderSetting } from '@/domain/reminders/types'

/**
 * Reads the reminder setting. Never empty: with nothing stored, the repository answers the
 * default, which is off (FR-034).
 *
 * @returns The query, for a screen to map onto a `ViewState` with `toViewState`.
 */
export function useReminder(): UseQueryResult<ReminderSetting, AppError> {
  const { unitOfWork } = useServices()
  return useQuery<ReminderSetting, AppError>({
    queryKey: queryKeys.reminder(),
    queryFn: async () =>
      unwrap(await unitOfWork.run(async (repositories) => repositories.reminders.get())),
  })
}

/**
 * Saves the setting and brings the device's schedule into line with it — asking for the
 * permission when it is saved on (FR-035). See `saveReminder` for the order of the writes.
 *
 * @returns The mutation. A declined permission arrives as a `permission-denied` error, for
 *   the screen to explain.
 */
export function useSaveReminder(): UseMutationResult<ReminderSetting, AppError, ReminderSetting> {
  const { unitOfWork, notifier, logger } = useServices()
  const queryClient = useQueryClient()

  return useMutation<ReminderSetting, AppError, ReminderSetting>({
    mutationFn: async (setting) => unwrap(await saveReminder(unitOfWork, notifier, setting)),
    // Principle II: the screen says what to do, and the log says what went wrong. A declined
    // permission is the user's answer rather than a fault, so it is not logged.
    onError: (error) => {
      if (error.kind !== 'permission-denied') {
        logger.warn('reminders.save-failed', failureContext(error))
      }
    },
    // Settled rather than succeeded: a schedule the device refused leaves the setting stored
    // off, which is a change the cache has to hear about as much as a save.
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.reminder(), refetchType: 'all' })
    },
  })
}

/**
 * What is logged about a failed save: its kind, its key, and the platform's own message.
 * Only those — a `SafeContext` carries primitives, and none of these is the user's data.
 */
function failureContext(error: AppError): SafeContext {
  return {
    kind: error.kind,
    messageKey: 'messageKey' in error ? error.messageKey : null,
    cause: 'cause' in error && error.cause instanceof Error ? error.cause.message : null,
  }
}
