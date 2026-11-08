import { fireEvent, screen, waitFor, within } from '@testing-library/react-native'
import { Linking } from 'react-native'

import { deviceError, storageError } from '@/domain/errors'
import { DEFAULT_REMINDER_SETTING } from '@/domain/reminders/schedule'
import type { ReminderSetting } from '@/domain/reminders/types'
import { err } from '@/domain/result'
import { strings } from '@/ui/strings'
import { createAppHarness, type AppHarness } from '@tests/support/app-harness'
import { expectOk } from '@tests/support/expect-result'
import RemindersScreen from '../../app/settings/reminders'

/**
 * The reminders screen (Story 6, FR-034 – FR-036): turning a recurring reminder on, choosing
 * when it comes, and turning it off.
 *
 * The permission is asked for when a reminder is saved on, never sooner (FR-035) — so the
 * notifier's calls are asserted as well as the storage, since a prompt shown at the wrong
 * moment would pass every check of what was stored. The stored fixture is weekly on
 * Thursday at 07:45, unlike the default in every field (AP-002).
 */
const mockBack = jest.fn()
const mockReplace = jest.fn()

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockBack,
    replace: mockReplace,
    canGoBack: () => true,
  }),
}))

const WEEKLY_ON: ReminderSetting = {
  enabled: true,
  frequency: 'weekly',
  dayOfMonth: null,
  dayOfWeek: 4,
  timeOfDay: '07:45',
}

let harness: AppHarness

beforeEach(() => {
  harness = createAppHarness('2026-11-07')
  mockBack.mockClear()
  mockReplace.mockClear()
})

afterEach(async () => {
  jest.restoreAllMocks()
  await harness.teardown()
})

async function render(): Promise<void> {
  await harness.render(<RemindersScreen />)
}

async function stored(): Promise<ReminderSetting> {
  return expectOk(await harness.repositories.reminders.get())
}

async function storedAs(setting: ReminderSetting): Promise<void> {
  expectOk(await harness.repositories.reminders.save(setting))
}

/** The switch, once the stored setting has been read. */
async function enabledSwitch(): Promise<ReturnType<typeof screen.getByTestId>> {
  return screen.findByTestId('reminder-enabled')
}

async function turn(on: boolean): Promise<void> {
  await fireEvent(await enabledSwitch(), 'valueChange', on)
}

async function press(testID: string, times = 1): Promise<void> {
  for (let count = 0; count < times; count += 1) {
    await fireEvent.press(screen.getByTestId(testID))
  }
}

async function save(): Promise<void> {
  await press('save-reminder')
}

describe('opening the screen', () => {
  // FR-034: off by default, and with nothing to configure until it is on.
  it('opens off, with no schedule shown', async () => {
    await render()

    expect((await enabledSwitch()).props.value).toBe(false)
    expect(screen.queryByTestId('frequency-monthly')).toBeNull()
    expect(screen.queryByTestId('hour-stepper')).toBeNull()
  })

  it('opens on the stored schedule', async () => {
    await storedAs(WEEKLY_ON)
    await render()

    expect((await enabledSwitch()).props.value).toBe(true)
    expect(screen.getByTestId('frequency-weekly').props.accessibilityState).toMatchObject({
      selected: true,
    })
    expect(screen.getByTestId('day-of-week-4').props.accessibilityState).toMatchObject({
      selected: true,
    })
    expect(screen.getByTestId('hour-value')).toHaveTextContent('07')
    expect(screen.getByTestId('minute-value')).toHaveTextContent('45')
    expect(screen.getByTestId('reminder-summary')).toHaveTextContent(
      strings.reminders.summaryWeekly(strings.reminders.weekdays[4].every, '07:45'),
    )
  })

  // A schedule that was turned off is kept, so turning it back on starts where it was.
  it('turned on, shows the schedule stored while it was off', async () => {
    await storedAs({ ...WEEKLY_ON, enabled: false })
    await render()

    await turn(true)

    expect(screen.getByTestId('day-of-week-4').props.accessibilityState).toMatchObject({
      selected: true,
    })
    expect(screen.getByTestId('reminder-summary')).toHaveTextContent(
      strings.reminders.summaryWeekly(strings.reminders.weekdays[4].every, '07:45'),
    )
  })

  it('shows the error state when the setting cannot be read', async () => {
    jest
      .spyOn(harness.repositories.reminders, 'get')
      .mockResolvedValue(err(storageError('reminders.read-failed')))
    await render()

    expect(await screen.findByText(strings.state.errorTitle)).toBeOnTheScreen()
    expect(screen.queryByTestId('reminder-enabled')).toBeNull()
  })
})

describe('turning reminders on', () => {
  // Decided with the user on 2026-11-07: close to a typical payday.
  it('starts on the default schedule, monthly on the 5th at 09:00', async () => {
    await render()
    await turn(true)

    expect(screen.getByTestId('frequency-monthly').props.accessibilityState).toMatchObject({
      selected: true,
    })
    expect(screen.getByTestId('day-of-month-5').props.accessibilityState).toMatchObject({
      selected: true,
    })
    expect(screen.getByTestId('reminder-summary')).toHaveTextContent(
      strings.reminders.summaryMonthly(5, '09:00'),
    )
  })

  // FR-035: the switch is a draft. Nothing is asked until the reminder is saved on.
  it('does not ask for permission when the switch is turned', async () => {
    await render()
    await turn(true)

    expect(harness.notifier.calls).toEqual([])
  })

  // Story 6, scenario 2: the schedule chosen is the one stored and scheduled.
  it('saves the chosen monthly schedule, asks for permission, schedules it, and leaves', async () => {
    await render()
    await turn(true)

    await press('day-of-month-17')
    await press('hour-increase', 11)
    await press('minute-increase', 2)
    expect(screen.getByTestId('reminder-summary')).toHaveTextContent(
      strings.reminders.summaryMonthly(17, '20:30'),
    )
    await save()

    const expected: ReminderSetting = {
      enabled: true,
      frequency: 'monthly',
      dayOfMonth: 17,
      dayOfWeek: null,
      timeOfDay: '20:30',
    }
    await waitFor(() => {
      expect(mockBack).toHaveBeenCalled()
    })
    expect(await stored()).toEqual(expected)
    expect(harness.notifier.methods()).toEqual(['requestPermission', 'schedule'])
    expect(harness.notifier.scheduled).toEqual(expected)
  })

  it('saves a weekly schedule on the chosen weekday', async () => {
    await render()
    await turn(true)

    await press('frequency-weekly')
    await press('day-of-week-2')
    await press('hour-decrease', 2)
    await press('minute-decrease')
    expect(screen.queryByTestId('day-of-month-5')).toBeNull()
    await save()

    await waitFor(() => {
      expect(mockBack).toHaveBeenCalled()
    })
    expect(await stored()).toEqual({
      enabled: true,
      frequency: 'weekly',
      dayOfMonth: null,
      dayOfWeek: 2,
      timeOfDay: '07:45',
    })
  })

  // The day of the month stops at 28, so a reminder can never skip February.
  it('offers the days 1 to 28 and no later', async () => {
    await render()
    await turn(true)

    expect(screen.getByTestId('day-of-month-1')).toBeOnTheScreen()
    expect(screen.getByTestId('day-of-month-28')).toBeOnTheScreen()
    expect(screen.queryByTestId('day-of-month-29')).toBeNull()
    expect(screen.getByText(strings.reminders.dayOfMonthHelp(28))).toBeOnTheScreen()
  })

  // FR-050. At iOS's largest text size the hour stepper alone takes two thirds of an iPhone
  // 15's width, and with the two side by side the minute stepper ran off the screen, its +
  // out of reach (seen on the simulator during T147). Wrapping puts it under the hour.
  it('lets the minute stepper wrap under the hour when they do not fit side by side', async () => {
    await render()
    await turn(true)

    const time = screen.getByTestId('reminder-time')
    expect(time).toHaveStyle({ flexDirection: 'row', flexWrap: 'wrap' })
    expect(within(time).getByTestId('hour-stepper')).toBeOnTheScreen()
    expect(within(time).getByTestId('minute-stepper')).toBeOnTheScreen()
  })

  // A screen reader adjusts a stepper with a swipe rather than finding its two buttons.
  it('lets a screen reader adjust the hour', async () => {
    await render()
    await turn(true)

    const stepper = screen.getByTestId('hour-stepper')
    expect(stepper.props.accessibilityValue).toEqual({ text: '09' })
    await fireEvent(stepper, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } })
    expect(screen.getByTestId('hour-value')).toHaveTextContent('10')
    await fireEvent(stepper, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } })
    await fireEvent(stepper, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } })
    expect(screen.getByTestId('hour-value')).toHaveTextContent('08')
  })
})

describe('when permission is declined', () => {
  // Story 6, scenario 1: explained, and the setting left off.
  it('explains, leaves the setting off, and stays on the screen', async () => {
    harness.notifier.permission = 'denied'
    await render()
    await turn(true)
    await press('day-of-month-17')

    await save()

    expect(await screen.findByText(strings.reminders.deniedBody)).toBeOnTheScreen()
    expect((await enabledSwitch()).props.value).toBe(false)
    expect(await stored()).toEqual(DEFAULT_REMINDER_SETTING)
    expect(harness.notifier.scheduled).toBeNull()
    expect(mockBack).not.toHaveBeenCalled()
  })

  // Once refused, the system will not ask again; the way out is its settings. Decided with
  // the user on 2026-11-07.
  it('offers to open the system settings', async () => {
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined)
    harness.notifier.permission = 'denied'
    await render()
    await turn(true)
    await save()

    await fireEvent.press(await screen.findByTestId('open-settings'))

    expect(openSettings).toHaveBeenCalledTimes(1)
  })

  // The explanation is about the attempt; a new one clears it.
  it('clears the explanation once the switch is turned again', async () => {
    harness.notifier.permission = 'denied'
    await render()
    await turn(true)
    await save()
    await screen.findByText(strings.reminders.deniedBody)

    await turn(true)

    expect(screen.queryByText(strings.reminders.deniedBody)).toBeNull()
  })
})

describe('turning reminders off', () => {
  // Story 6, scenario 3, and FR-036: nothing further arrives. No permission is asked for.
  it('cancels the reminder, stores it off, and leaves', async () => {
    await storedAs(WEEKLY_ON)
    harness.notifier.scheduled = WEEKLY_ON
    await render()

    await turn(false)
    expect(screen.queryByTestId('hour-stepper')).toBeNull()
    await save()

    await waitFor(() => {
      expect(mockBack).toHaveBeenCalled()
    })
    expect(harness.notifier.methods()).toEqual(['cancelAll'])
    expect(harness.notifier.scheduled).toBeNull()
    expect(await stored()).toEqual({ ...WEEKLY_ON, enabled: false })
  })
})

// The screen reads the setting through the cache, and a save writes past it. Reopened, the
// screen has to show what was stored rather than what it read last time.
describe('opening the screen again', () => {
  async function reopen(): Promise<void> {
    await screen.unmount()
    await render()
  }

  it('shows the schedule just saved', async () => {
    await render()
    await turn(true)
    await press('day-of-month-17')
    await save()
    await waitFor(() => {
      expect(mockBack).toHaveBeenCalled()
    })

    await reopen()

    expect((await enabledSwitch()).props.value).toBe(true)
    expect(screen.getByTestId('reminder-summary')).toHaveTextContent(
      strings.reminders.summaryMonthly(17, '09:00'),
    )
  })

  // A schedule the device refused leaves the setting stored off. That is a change too, and
  // the screen reopened has to show it off rather than the "on" it read before.
  it('shows the setting off after the device refused to schedule it', async () => {
    await storedAs(WEEKLY_ON)
    harness.notifier.failing.add('schedule')
    await render()
    await enabledSwitch()
    await save()
    await screen.findByText(strings.reminders.deviceFailedBody)

    await reopen()

    await waitFor(() => {
      expect(screen.getByTestId('reminder-enabled').props.value).toBe(false)
    })
  })
})

describe('when the device or storage fails', () => {
  it('says the reminder could not be scheduled, and stays', async () => {
    harness.notifier.failing.add('schedule')
    await render()
    await turn(true)

    await save()

    expect(await screen.findByText(strings.reminders.deviceFailedBody)).toBeOnTheScreen()
    expect(mockBack).not.toHaveBeenCalled()
    expect((await stored()).enabled).toBe(false)
  })

  // Principle II: a failure the user is told about is also logged, with the platform's own
  // words — the copy on screen says what to do, and the log says what went wrong.
  it("logs a device failure with the platform's message", async () => {
    jest
      .spyOn(harness.notifier, 'schedule')
      .mockResolvedValue(
        err(deviceError('notifications', 'notifications.schedule-failed', new Error('no channel'))),
      )
    await render()
    await turn(true)

    await save()

    await screen.findByText(strings.reminders.deviceFailedBody)
    expect(harness.services.logger.warn).toHaveBeenCalledWith('reminders.save-failed', {
      kind: 'device',
      messageKey: 'notifications.schedule-failed',
      cause: 'no channel',
    })
  })

  // A declined permission is the user's answer, not a fault: nothing to log.
  it('logs nothing when permission is declined', async () => {
    harness.notifier.permission = 'denied'
    await render()
    await turn(true)

    await save()

    await screen.findByText(strings.reminders.deniedBody)
    expect(harness.services.logger.warn).not.toHaveBeenCalled()
  })

  it('says the setting could not be saved, and stays', async () => {
    jest
      .spyOn(harness.repositories.reminders, 'save')
      .mockResolvedValue(err(storageError('reminders.save-failed')))
    await render()
    await turn(true)

    await save()

    expect(await screen.findByText(strings.reminders.saveFailedBody)).toBeOnTheScreen()
    expect(mockBack).not.toHaveBeenCalled()
  })
})
