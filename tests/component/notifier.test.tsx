import { AndroidImportance, SchedulableTriggerInputTypes } from 'expo-notifications'
import type { NotificationPermissionsStatus } from 'expo-notifications'

import type { Notifier } from '@/domain/ports/notifier'
import type { ReminderSetting } from '@/domain/reminders/types'
import {
  REMINDER_CHANNEL_ID,
  createNotifier,
  showNotificationsWhileOpen,
  type NotificationsApi,
  type NotifierOptions,
} from '@/platform/notifications/notifier'
import { expectErr, expectOk } from '@tests/support/expect-result'

/**
 * The `Notifier` adapter over `expo-notifications` (D-013): local notifications only.
 *
 * In the component project although it renders nothing: `expo-notifications` is shipped as
 * ES modules that import `expo`, which the plain-Node unit project cannot load (measured —
 * `Cannot use import statement outside a module`). `jest-expo` transforms it, as it does
 * for the composition root's test.
 *
 * The library is handed in rather than imported, so these tests drive the adapter against
 * a recording stand-in. What they pin is the translation — our 0–6 weekdays against the
 * library's 1–7, the Android channel that has to exist before Android 13 will even show a
 * permission prompt — and that every way the device can fail arrives as a value.
 */
const MONTHLY: ReminderSetting = {
  enabled: true,
  frequency: 'monthly',
  dayOfMonth: 17,
  dayOfWeek: null,
  timeOfDay: '20:30',
}

const WEEKLY: ReminderSetting = {
  enabled: true,
  frequency: 'weekly',
  dayOfMonth: null,
  dayOfWeek: 4,
  timeOfDay: '07:45',
}

const CONTENT = { title: 'Hora de contribuir', body: 'Registre o que você guardou.' }

/** A permission answer, with only the field the adapter reads set meaningfully. */
function permission(granted: boolean): NotificationPermissionsStatus {
  return {
    granted,
    canAskAgain: true,
    expires: 'never',
    status: granted ? 'granted' : 'denied',
  } as NotificationPermissionsStatus
}

let api: jest.Mocked<NotificationsApi>

beforeEach(() => {
  api = {
    getPermissionsAsync: jest.fn().mockResolvedValue(permission(false)),
    requestPermissionsAsync: jest.fn().mockResolvedValue(permission(true)),
    setNotificationChannelAsync: jest.fn().mockResolvedValue(null),
    scheduleNotificationAsync: jest.fn().mockResolvedValue('notification-id'),
    cancelAllScheduledNotificationsAsync: jest.fn().mockResolvedValue(undefined),
    setNotificationHandler: jest.fn(),
  }
})

/**
 * A notifier that manages its Android channel, as a real Android build does, or one with no
 * channel: iOS, which has none, and Expo Go on Android, which refuses them.
 */
type Channels = 'channel' | 'no channel'

function notifierWith(channels: Channels): Notifier {
  const options: NotifierOptions = {
    notifications: api,
    content: CONTENT,
    channel: channels === 'channel' ? { name: 'Lembretes' } : null,
  }
  return createNotifier(options)
}

describe('requestPermission', () => {
  it('asks the system and reports a grant', async () => {
    expect(expectOk(await notifierWith('no channel').requestPermission())).toBe('granted')
    expect(api.requestPermissionsAsync).toHaveBeenCalledTimes(1)
  })

  // A denial is the user's answer, not a failure (the port's contract).
  it('reports a denial as an outcome', async () => {
    api.requestPermissionsAsync.mockResolvedValue(permission(false))

    expect(expectOk(await notifierWith('no channel').requestPermission())).toBe('denied')
  })

  // Saving a changed schedule asks again; already granted, nothing is shown to the user.
  it('does not prompt when permission is already granted', async () => {
    api.getPermissionsAsync.mockResolvedValue(permission(true))

    expect(expectOk(await notifierWith('no channel').requestPermission())).toBe('granted')
    expect(api.requestPermissionsAsync).not.toHaveBeenCalled()
  })

  // Android 13 shows no permission prompt until a channel exists, so asking without one
  // would be a silent denial on exactly the devices that ask.
  it('creates the reminder channel before asking, where it manages one', async () => {
    await notifierWith('channel').requestPermission()

    expect(api.setNotificationChannelAsync).toHaveBeenCalledWith(REMINDER_CHANNEL_ID, {
      name: 'Lembretes',
      importance: AndroidImportance.DEFAULT,
    })
    const channelOrder = api.setNotificationChannelAsync.mock.invocationCallOrder[0]
    const askOrder = api.getPermissionsAsync.mock.invocationCallOrder[0]
    expect(channelOrder).toBeLessThan(askOrder ?? 0)
  })

  // iOS has no channels. Expo Go on Android refuses them — measured on 2026-11-07, the call
  // rejected with a NullPointerException for `NotificationsChannelsProvider` — and a channel
  // it refuses to create would fail every save.
  it('creates no channel where it manages none', async () => {
    await notifierWith('no channel').requestPermission()

    expect(api.setNotificationChannelAsync).not.toHaveBeenCalled()
  })

  it('reports a system that will not answer as a device failure', async () => {
    const cause = new Error('no activity')
    api.requestPermissionsAsync.mockRejectedValue(cause)

    expect(expectErr(await notifierWith('no channel').requestPermission())).toEqual({
      kind: 'device',
      capability: 'notifications',
      messageKey: 'notifications.permission-failed',
      cause,
    })
  })
})

describe('schedule', () => {
  // The library counts weekdays from 1, Sunday; ours from 0. Thursday is 4 here and 5
  // there — the off-by-one that would move every weekly reminder a day early.
  it('schedules a weekly reminder on the library weekday', async () => {
    expectOk(await notifierWith('no channel').schedule(WEEKLY))

    expect(api.scheduleNotificationAsync).toHaveBeenCalledWith({
      content: CONTENT,
      trigger: {
        type: SchedulableTriggerInputTypes.WEEKLY,
        weekday: 5,
        hour: 7,
        minute: 45,
      },
    })
  })

  it('schedules a monthly reminder on the day of the month', async () => {
    expectOk(await notifierWith('no channel').schedule(MONTHLY))

    expect(api.scheduleNotificationAsync).toHaveBeenCalledWith({
      content: CONTENT,
      trigger: {
        type: SchedulableTriggerInputTypes.MONTHLY,
        day: 17,
        hour: 20,
        minute: 30,
      },
    })
  })

  // A trigger naming a channel posts to it; one that names none takes the platform's
  // default, which is what a channel that was never created would leave it without.
  it('posts to the reminder channel where it manages one, and names none otherwise', async () => {
    await notifierWith('channel').schedule(MONTHLY)
    await notifierWith('no channel').schedule(WEEKLY)

    const triggers = api.scheduleNotificationAsync.mock.calls.map(([request]) => request.trigger)
    expect(triggers[0]).toMatchObject({ channelId: REMINDER_CHANNEL_ID })
    expect(triggers[1]).not.toHaveProperty('channelId')
  })

  // Replaces rather than adds (the port's contract): every save would otherwise stack
  // another reminder on top of the last.
  it('cancels what was scheduled before scheduling the new one', async () => {
    await notifierWith('no channel').schedule(MONTHLY)

    const cancelOrder = api.cancelAllScheduledNotificationsAsync.mock.invocationCallOrder[0]
    const scheduleOrder = api.scheduleNotificationAsync.mock.invocationCallOrder[0]
    expect(cancelOrder).toBeLessThan(scheduleOrder ?? 0)
  })

  // The channel the trigger names has to exist, or Android has nowhere to post it.
  it('makes sure the channel exists before scheduling to it', async () => {
    await notifierWith('channel').schedule(MONTHLY)

    expect(api.setNotificationChannelAsync).toHaveBeenCalledWith(
      REMINDER_CHANNEL_ID,
      expect.anything(),
    )
  })

  it('schedules nothing for a setting that is off, and clears what was there', async () => {
    expectOk(await notifierWith('no channel').schedule({ ...MONTHLY, enabled: false }))

    expect(api.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1)
    expect(api.scheduleNotificationAsync).not.toHaveBeenCalled()
  })

  // The domain validates first, so this is a programmer error — and it still arrives as a
  // failure, rather than as nothing scheduled and success reported.
  it.each([
    ['a time that is not one', { ...MONTHLY, timeOfDay: '24:00' }],
    ['a monthly reminder with no day', { ...MONTHLY, dayOfMonth: null }],
    ['a weekly reminder with no day', { ...WEEKLY, dayOfWeek: null }],
  ])('fails rather than scheduling nothing for %s', async (_case, setting) => {
    const error = expectErr(await notifierWith('no channel').schedule(setting))

    expect(error).toEqual(
      expect.objectContaining({ kind: 'device', messageKey: 'notifications.schedule-failed' }),
    )
    expect(api.scheduleNotificationAsync).not.toHaveBeenCalled()
  })

  it('reports a schedule the device refuses as a device failure', async () => {
    api.scheduleNotificationAsync.mockRejectedValue(new Error('alarm manager unavailable'))

    expect(expectErr(await notifierWith('no channel').schedule(MONTHLY))).toEqual(
      expect.objectContaining({ kind: 'device', messageKey: 'notifications.schedule-failed' }),
    )
  })
})

describe('cancelAll', () => {
  it('cancels every scheduled reminder', async () => {
    expectOk(await notifierWith('no channel').cancelAll())

    expect(api.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1)
  })

  it('reports a cancel the device refuses as a device failure', async () => {
    api.cancelAllScheduledNotificationsAsync.mockRejectedValue(new Error('unavailable'))

    expect(expectErr(await notifierWith('no channel').cancelAll())).toEqual(
      expect.objectContaining({ kind: 'device', messageKey: 'notifications.cancel-failed' }),
    )
  })
})

describe('showNotificationsWhileOpen', () => {
  // A reminder that falls due while the app is open is shown, not swallowed: by default
  // the system hides a notification from the app in the foreground.
  it('has the system show a notification that arrives while the app is open', async () => {
    showNotificationsWhileOpen(api)

    const handler = api.setNotificationHandler.mock.calls[0]?.[0]
    expect(handler).toBeDefined()
    await expect(handler?.handleNotification({} as never)).resolves.toEqual({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    })
  })
})
