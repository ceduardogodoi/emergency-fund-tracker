import { deviceError, type AppError } from '@/domain/errors'
import type { Notifier, PermissionOutcome } from '@/domain/ports/notifier'
import type { ReminderSetting } from '@/domain/reminders/types'
import { err, ok, type Result } from '@/domain/result'

/** The calls a {@link FakeNotifier} has received, in order. */
export type NotifierCall =
  | { readonly method: 'requestPermission' }
  | { readonly method: 'schedule'; readonly setting: ReminderSetting }
  | { readonly method: 'cancelAll' }

/**
 * A notifier that schedules nothing and remembers what it was asked.
 *
 * Hand-written for the reason the in-memory repositories are: it implements the port, so
 * it stops compiling when the port changes. {@link scheduled} is what the device would
 * deliver — the last schedule, or nothing after a cancel — which is what FR-036 is about.
 */
export class FakeNotifier implements Notifier {
  /** What the user answers when asked. Granted unless a test says otherwise. */
  public permission: PermissionOutcome = 'granted'
  /** Methods that fail when called, for the paths where the device lets us down. */
  public readonly failing = new Set<NotifierCall['method']>()
  /** Every call received, in order. */
  public readonly calls: NotifierCall[] = []
  /** The schedule the device holds now, or null when nothing would arrive. */
  public scheduled: ReminderSetting | null = null

  public async requestPermission(): Promise<Result<PermissionOutcome>> {
    this.calls.push({ method: 'requestPermission' })
    return this.failure('requestPermission') ?? ok(this.permission)
  }

  public async schedule(setting: ReminderSetting): Promise<Result<void>> {
    this.calls.push({ method: 'schedule', setting })
    const failed = this.failure('schedule')
    if (failed !== null) {
      return failed
    }
    this.scheduled = setting
    return ok(undefined)
  }

  public async cancelAll(): Promise<Result<void>> {
    this.calls.push({ method: 'cancelAll' })
    const failed = this.failure('cancelAll')
    if (failed !== null) {
      return failed
    }
    this.scheduled = null
    return ok(undefined)
  }

  /** The names of the methods called, in order — for asserting a sequence. */
  public methods(): readonly NotifierCall['method'][] {
    return this.calls.map((call) => call.method)
  }

  private failure(method: NotifierCall['method']): Result<never, AppError> | null {
    return this.failing.has(method)
      ? err(deviceError('notifications', `notifications.${method}-failed`))
      : null
  }
}
