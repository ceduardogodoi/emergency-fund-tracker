/** How often a contribution reminder repeats (FR-034). */
export type ReminderFrequency = 'weekly' | 'monthly'

/**
 * The user's optional reminder schedule.
 *
 * Defaults to disabled (FR-034), and delivery is local-only — no push service and no
 * network, since FR-040 requires every feature to work offline.
 */
export interface ReminderSetting {
  readonly enabled: boolean
  readonly frequency: ReminderFrequency
  /**
   * Day of the month for a monthly reminder, 1–28.
   *
   * Capped at 28 deliberately: every month has a 28th, so a reminder can never silently
   * skip February. Null when {@link frequency} is `weekly`.
   */
  readonly dayOfMonth: number | null
  /** Day of the week for a weekly reminder, 0 (Sunday) to 6. Null when monthly. */
  readonly dayOfWeek: number | null
  /** Local delivery time as `HH:MM`, 24-hour. */
  readonly timeOfDay: string
}
