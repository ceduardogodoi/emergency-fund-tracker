import * as Notifications from 'expo-notifications'

import { deviceError } from '@/domain/errors'
import type { Notifier, PermissionOutcome } from '@/domain/ports/notifier'
import { parseTimeOfDay } from '@/domain/reminders/schedule'
import type { ReminderSetting } from '@/domain/reminders/types'
import { err, ok, type Result } from '@/domain/result'

/**
 * The parts of `expo-notifications` the adapter calls, taken as an argument so tests can
 * stand in for the native module.
 */
export type NotificationsApi = Pick<
  typeof Notifications,
  | 'getPermissionsAsync'
  | 'requestPermissionsAsync'
  | 'setNotificationChannelAsync'
  | 'scheduleNotificationAsync'
  | 'cancelAllScheduledNotificationsAsync'
  | 'setNotificationHandler'
>

/** What {@link createNotifier} needs. */
export interface NotifierOptions {
  /** The library, or a stand-in for it. */
  readonly notifications: NotificationsApi
  /**
   * The reminder's text. Passed in because copy lives in the strings module, which the
   * platform layer does not import.
   */
  readonly content: { readonly title: string; readonly body: string }
  /**
   * The Android channel reminders are posted to, named as Android's notification settings
   * list it — or null where the app manages no channel. That is iOS, which has none, and
   * Expo Go on Android, which refuses them: measured on 2026-11-07, creating one rejected
   * with a NullPointerException for `NotificationsChannelsProvider`, which failed every
   * save. Without one, a reminder goes to the platform's default channel.
   */
  readonly channel: { readonly name: string } | null
}

/** The Android channel every reminder is posted to. */
export const REMINDER_CHANNEL_ID = 'reminders'

/**
 * Builds the {@link Notifier} over `expo-notifications` (D-013): local notifications only,
 * with no push service, no token, and no network.
 *
 * The app holds no exact-alarm permission, so on Android the library sets an inexact alarm
 * (`setAndAllowWhileIdle`; it uses the exact call only when exact alarms are allowed). The
 * system may deliver it up to an hour late: measured on 2026-11-07 in a release build, the
 * window was an hour for a reminder a month out, and deliveries came four to six minutes
 * after the time. A reminder to record a contribution does not need the minute; the
 * exact-alarm permission would mean a second system screen, and Google Play restricts who
 * may hold it (R-003, research.md).
 *
 * Every call into the library is caught and returned as a device failure. The library
 * throws for a native module that is missing or a system service that is unavailable, and
 * either has to reach the screen as something it can explain.
 *
 * @param options See {@link NotifierOptions}.
 * @returns The notifier.
 */
export function createNotifier(options: NotifierOptions): Notifier {
  const { notifications, content, channel } = options
  const ensureChannel = (): Promise<void> => ensureReminderChannel(options)

  return {
    async requestPermission(): Promise<Result<PermissionOutcome>> {
      return attempt('notifications.permission-failed', async () => {
        await ensureChannel()
        // Asked first without a prompt: saving a changed schedule goes through here, and a
        // permission already granted should not show the user anything.
        const current = await notifications.getPermissionsAsync()
        if (current.granted) {
          return 'granted'
        }
        const answer = await notifications.requestPermissionsAsync()
        return answer.granted ? 'granted' : 'denied'
      })
    },

    async schedule(setting: ReminderSetting): Promise<Result<void>> {
      return attempt('notifications.schedule-failed', async () => {
        await ensureChannel()
        // Replaces rather than adds, so repeated saves cannot stack reminders.
        await notifications.cancelAllScheduledNotificationsAsync()
        if (setting.enabled) {
          await notifications.scheduleNotificationAsync({
            content,
            trigger: triggerFor(setting, channel === null ? null : REMINDER_CHANNEL_ID),
          })
        }
      })
    },

    async cancelAll(): Promise<Result<void>> {
      return attempt('notifications.cancel-failed', async () => {
        await notifications.cancelAllScheduledNotificationsAsync()
      })
    },
  }
}

/**
 * Creates the reminder channel, where the notifier manages one.
 *
 * Android 13 shows no permission prompt until a channel exists, and Android 8 posts nothing
 * to a named channel that does not. Creating one that exists updates it in place.
 */
async function ensureReminderChannel({ notifications, channel }: NotifierOptions): Promise<void> {
  if (channel !== null) {
    await notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
      name: channel.name,
      importance: Notifications.AndroidImportance.DEFAULT,
    })
  }
}

/**
 * Has the system show a notification that arrives while the app is open.
 *
 * By default it hides a notification from the app in the foreground, so a reminder falling
 * due while the user is looking at the fund would be swallowed. No badge: nothing in the
 * app counts unread reminders, and a badge nothing clears would stay forever.
 *
 * @param notifications The library, or a stand-in for it.
 */
export function showNotificationsWhileOpen(notifications: NotificationsApi): void {
  notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  })
}

/**
 * The library's repeating trigger for a setting.
 *
 * The library counts weekdays from 1, Sunday; ours count from 0, as `Date` does — hence
 * the `+ 1`, without which every weekly reminder would come a day early. Its monthly `day`
 * is the day of the month, 1-based, as ours is.
 *
 * @param setting The setting, enabled.
 * @param channelId The channel to post to, or null for the platform's default.
 * @returns The trigger.
 * @throws {RangeError} For a setting `validateReminderSetting` would refuse. The domain
 *   validates before it schedules, so reaching this is a programmer error; inside
 *   `attempt` it still arrives as a device failure rather than as a silent nothing.
 */
function triggerFor(
  setting: ReminderSetting,
  channelId: string | null,
): Notifications.NotificationTriggerInput {
  const time = parseTimeOfDay(setting.timeOfDay)
  if (time === null) {
    throw new RangeError(`Not a time of day: ${setting.timeOfDay}`)
  }
  // Named only when it exists; see `NotifierOptions.channel`.
  const channel = channelId === null ? {} : { channelId }
  if (setting.frequency === 'weekly' && setting.dayOfWeek !== null) {
    return {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: setting.dayOfWeek + 1,
      hour: time.hour,
      minute: time.minute,
      ...channel,
    }
  }
  if (setting.frequency === 'monthly' && setting.dayOfMonth !== null) {
    return {
      type: Notifications.SchedulableTriggerInputTypes.MONTHLY,
      day: setting.dayOfMonth,
      hour: time.hour,
      minute: time.minute,
      ...channel,
    }
  }
  throw new RangeError(`No day for a ${setting.frequency} reminder`)
}

/** Runs a call into the library, returning what it throws as a device failure. */
async function attempt<T>(messageKey: string, work: () => Promise<T>): Promise<Result<T>> {
  try {
    return ok(await work())
  } catch (cause) {
    return err(deviceError('notifications', messageKey, cause))
  }
}
