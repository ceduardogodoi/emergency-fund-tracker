import type { ReminderSetting } from '../reminders/types'
import type { Result } from '../result'

/** Whether the OS granted the notification permission. */
export type PermissionOutcome = 'granted' | 'denied'

/**
 * Schedules the optional contribution reminders (FR-034 – FR-036).
 *
 * Local notifications only. Push would require a network and a server, both excluded by
 * FR-040 and FR-041, and would mean shipping a device token off the device.
 */
export interface Notifier {
  /**
   * Asks the OS for permission.
   *
   * Called only at the moment the user enables reminders (FR-035), never at launch — a
   * cold-start permission prompt is both worse manners and worse for opt-in rates.
   *
   * @returns The user's answer. A denial is a normal outcome, not a failure.
   */
  requestPermission(): Promise<Result<PermissionOutcome>>

  /**
   * Replaces any scheduled reminders with ones matching `setting`.
   *
   * Replaces rather than adds, so repeated saves cannot stack duplicate notifications.
   */
  schedule(setting: ReminderSetting): Promise<Result<void>>

  /** Cancels every scheduled reminder, so nothing arrives after the user opts out. */
  cancelAll(): Promise<Result<void>>
}
