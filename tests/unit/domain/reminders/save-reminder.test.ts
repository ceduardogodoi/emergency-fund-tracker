import { storageError } from '@/domain/errors'
import type { Repositories } from '@/domain/ports/repositories'
import type { UnitOfWork } from '@/domain/ports/unit-of-work'
import { saveReminder } from '@/domain/reminders/save-reminder'
import { DEFAULT_REMINDER_SETTING } from '@/domain/reminders/schedule'
import type { ReminderSetting } from '@/domain/reminders/types'
import { err } from '@/domain/result'
import {
  CountingIdGenerator,
  FakeClock,
  FakeNotifier,
  createInMemoryRepositories,
} from '@tests/support/doubles'
import { expectErr, expectOk } from '@tests/support/expect-result'

/**
 * Saving the reminder setting (FR-034 – FR-036), which is two writes to two places: the
 * stored setting, and the schedule the device holds. The rules here are about keeping them
 * in agreement, because the failure that matters is the one the user cannot see — a screen
 * that says "on" with nothing scheduled, or "off" with a reminder still arriving.
 *
 * Neither fixture is the default schedule, so a save that stored the default would show.
 */
const WEEKLY_ON: ReminderSetting = {
  enabled: true,
  frequency: 'weekly',
  dayOfMonth: null,
  dayOfWeek: 4,
  timeOfDay: '07:45',
}

const MONTHLY_ON: ReminderSetting = {
  enabled: true,
  frequency: 'monthly',
  dayOfMonth: 17,
  dayOfWeek: null,
  timeOfDay: '20:30',
}

let repositories: Repositories
let unitOfWork: UnitOfWork
let notifier: FakeNotifier

beforeEach(() => {
  repositories = createInMemoryRepositories(new FakeClock('2026-11-07'), new CountingIdGenerator())
  unitOfWork = { run: (work) => work(repositories) }
  notifier = new FakeNotifier()
})

async function stored(): Promise<ReminderSetting> {
  return expectOk(await repositories.reminders.get())
}

/** Stores a setting and schedules it, as an earlier successful save would have. */
async function previously(setting: ReminderSetting): Promise<void> {
  expectOk(await repositories.reminders.save(setting))
  notifier.scheduled = setting.enabled ? setting : null
}

describe('saveReminder', () => {
  it('refuses a malformed schedule before asking or storing anything', async () => {
    const error = expectErr(
      await saveReminder(unitOfWork, notifier, { ...MONTHLY_ON, dayOfMonth: 29 }),
    )

    expect(error).toEqual({
      kind: 'validation',
      field: 'dayOfMonth',
      messageKey: 'reminder.day-of-month-out-of-range',
    })
    expect(notifier.calls).toEqual([])
    expect(await stored()).toEqual(DEFAULT_REMINDER_SETTING)
  })

  describe('turning reminders on', () => {
    // Story 6, scenario 2: the schedule the user chose is the one the device holds.
    it('asks for permission, stores the setting, and schedules it', async () => {
      const saved = expectOk(await saveReminder(unitOfWork, notifier, MONTHLY_ON))

      expect(saved).toEqual(MONTHLY_ON)
      expect(await stored()).toEqual(MONTHLY_ON)
      expect(notifier.methods()).toEqual(['requestPermission', 'schedule'])
      expect(notifier.scheduled).toEqual(MONTHLY_ON)
    })

    // A change to a schedule already on goes through the same door. The permission may have
    // been withdrawn in the system settings since; asking again is how that is found out,
    // and the adapter answers without a prompt when it is still granted.
    it('reschedules a changed schedule, asking again', async () => {
      await previously(WEEKLY_ON)

      expectOk(await saveReminder(unitOfWork, notifier, MONTHLY_ON))

      expect(notifier.methods()).toEqual(['requestPermission', 'schedule'])
      expect(notifier.scheduled).toEqual(MONTHLY_ON)
      expect(await stored()).toEqual(MONTHLY_ON)
    })

    // Story 6, scenario 1, and FR-035: declined, the setting stays as it was — off — and
    // the refusal is reported for the screen to explain.
    it('stores nothing and schedules nothing when permission is declined', async () => {
      const before: ReminderSetting = { ...WEEKLY_ON, enabled: false }
      await previously(before)
      notifier.permission = 'denied'

      const error = expectErr(await saveReminder(unitOfWork, notifier, MONTHLY_ON))

      expect(error).toEqual({ kind: 'permission-denied', capability: 'notifications' })
      expect(await stored()).toEqual(before)
      expect(notifier.methods()).toEqual(['requestPermission'])
      expect(notifier.scheduled).toBeNull()
    })

    it('stores nothing when the permission cannot be asked for', async () => {
      notifier.failing.add('requestPermission')

      const error = expectErr(await saveReminder(unitOfWork, notifier, MONTHLY_ON))

      expect(error.kind).toBe('device')
      expect(await stored()).toEqual(DEFAULT_REMINDER_SETTING)
      expect(notifier.methods()).toEqual(['requestPermission'])
    })

    // Stored first, scheduled second: a schedule with no setting behind it would be a
    // reminder the screen does not know about and cannot turn off.
    it('schedules nothing when the setting cannot be stored', async () => {
      jest
        .spyOn(repositories.reminders, 'save')
        .mockResolvedValue(err(storageError('reminders.save-failed')))

      const error = expectErr(await saveReminder(unitOfWork, notifier, MONTHLY_ON))

      expect(error).toEqual({ kind: 'storage', messageKey: 'reminders.save-failed' })
      expect(notifier.methods()).toEqual(['requestPermission'])
      expect(notifier.scheduled).toBeNull()
    })

    // The device would not take the schedule, so nothing will arrive — and the stored
    // setting is put to off to say so, rather than left on over an empty schedule. The
    // cancel clears whatever the failed attempt may have left half-done.
    it('ends off on both sides when the device will not schedule it', async () => {
      await previously(WEEKLY_ON)
      notifier.failing.add('schedule')

      const error = expectErr(await saveReminder(unitOfWork, notifier, MONTHLY_ON))

      expect(error).toEqual({
        kind: 'device',
        capability: 'notifications',
        messageKey: 'notifications.schedule-failed',
      })
      expect(notifier.methods()).toEqual(['requestPermission', 'schedule', 'cancelAll'])
      expect(notifier.scheduled).toBeNull()
      expect(await stored()).toEqual({ ...MONTHLY_ON, enabled: false })
    })
  })

  describe('turning reminders off', () => {
    // Story 6, scenario 3, and FR-036: nothing further arrives. No permission is asked
    // for — FR-035 asks only on enabling.
    it('cancels what is scheduled and stores the setting off', async () => {
      await previously(MONTHLY_ON)
      const off: ReminderSetting = { ...MONTHLY_ON, enabled: false }

      expect(expectOk(await saveReminder(unitOfWork, notifier, off))).toEqual(off)

      expect(notifier.methods()).toEqual(['cancelAll'])
      expect(notifier.scheduled).toBeNull()
      expect(await stored()).toEqual(off)
    })

    // Cancelled first, stored second. The other order could store "off" and then fail to
    // cancel, leaving reminders arriving that the screen says are off — FR-036 broken
    // silently. This way a failure leaves the setting truthfully on.
    it('leaves the setting on when the device will not cancel', async () => {
      await previously(MONTHLY_ON)
      notifier.failing.add('cancelAll')

      const error = expectErr(
        await saveReminder(unitOfWork, notifier, { ...MONTHLY_ON, enabled: false }),
      )

      expect(error.kind).toBe('device')
      expect(await stored()).toEqual(MONTHLY_ON)
    })
  })
})
