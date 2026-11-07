import { permissionDeniedError } from '../errors'
import type { Notifier } from '../ports/notifier'
import type { UnitOfWork } from '../ports/unit-of-work'
import { err, isErr, ok, type Result } from '../result'
import { validateReminderSetting } from './schedule'
import type { ReminderSetting } from './types'

/**
 * Saves the reminder setting and brings the device's schedule into line with it
 * (FR-034 – FR-036).
 *
 * Two writes to two places, which cannot share a transaction, so the order of each is
 * chosen for what a failure between them leaves behind. The failure that matters is one
 * the user cannot see: a screen saying "on" with nothing scheduled, or "off" with a
 * reminder still arriving.
 *
 *   - **On**: permission first (FR-035 — asked when enabling, and only then), then stored,
 *     then scheduled. A schedule with no stored setting behind it would be a reminder the
 *     screen does not know about and cannot turn off. If the device will not take the
 *     schedule, everything is cancelled and the setting stored off, so both sides agree
 *     that nothing will arrive.
 *   - **Off**: cancelled first, then stored. The other way round could store "off" and then
 *     fail to cancel, and reminders would go on arriving under a switch that says they do
 *     not — FR-036 broken silently. This way a failure leaves the setting truthfully on.
 *
 * The permission is asked for on every save that leaves reminders on, not only the first.
 * It may have been withdrawn in the system settings since, and asking is how that is found
 * out; the adapter answers without a prompt when it is still granted.
 *
 * The store write runs in its own transaction, outside the permission prompt — holding a
 * transaction open while the user reads a system dialog would hold the database with it.
 *
 * @param unitOfWork The door to storage.
 * @param notifier The device's notification scheduler.
 * @param setting The setting the user saved.
 * @returns The setting as stored, or why it was not: a validation failure, a declined
 *   permission (`permission-denied`), a device failure, or a storage failure.
 */
export async function saveReminder(
  unitOfWork: UnitOfWork,
  notifier: Notifier,
  setting: ReminderSetting,
): Promise<Result<ReminderSetting>> {
  const validated = validateReminderSetting(setting)
  if (isErr(validated)) {
    return validated
  }
  return setting.enabled
    ? turnOn(unitOfWork, notifier, validated.value)
    : turnOff(unitOfWork, notifier, validated.value)
}

async function turnOn(
  unitOfWork: UnitOfWork,
  notifier: Notifier,
  setting: ReminderSetting,
): Promise<Result<ReminderSetting>> {
  const permission = await notifier.requestPermission()
  if (isErr(permission)) {
    return permission
  }
  if (permission.value === 'denied') {
    return err(permissionDeniedError('notifications'))
  }

  const saved = await store(unitOfWork, setting)
  if (isErr(saved)) {
    return saved
  }

  const scheduled = await notifier.schedule(setting)
  if (isErr(scheduled)) {
    // Whatever the failed attempt left half-done is cleared, and the setting stored off to
    // match. Either of these failing too leaves nothing better to do than report the
    // original failure, which is the one the user acted on.
    await notifier.cancelAll()
    await store(unitOfWork, { ...setting, enabled: false })
    return scheduled
  }
  return ok(saved.value)
}

async function turnOff(
  unitOfWork: UnitOfWork,
  notifier: Notifier,
  setting: ReminderSetting,
): Promise<Result<ReminderSetting>> {
  const cancelled = await notifier.cancelAll()
  if (isErr(cancelled)) {
    return cancelled
  }
  return store(unitOfWork, setting)
}

function store(unitOfWork: UnitOfWork, setting: ReminderSetting): Promise<Result<ReminderSetting>> {
  return unitOfWork.run(async (repositories) => repositories.reminders.save(setting))
}
