import type { Goal, GoalChange, GoalChangeInput, GoalInput } from '../goal/types'
import type { CalendarDate } from '../dates/calendar-date'
import type {
  DateRange,
  LedgerEntry,
  LedgerEntryInput,
  LedgerEntryPatch,
  MilestoneThreshold,
} from '../ledger/types'
import type { Profile, ProfileInput } from '../profile/types'
import type { ReminderSetting } from '../reminders/types'
import type { Result } from '../result'

/**
 * Persistence interfaces, owned by the domain and implemented in `src/data`.
 *
 * Every method returns domain types. No SQL string, row shape, or driver object crosses
 * this boundary — mapping happens in the adapter. That is what lets the same domain run
 * against SQLite today and against a sync-backed store when the accounts release lands,
 * without a rule changing.
 */

/** Reads and writes the single {@link Profile} row. */
export interface ProfileRepository {
  /** @returns The profile, or null before onboarding has completed. */
  get(): Promise<Result<Profile | null>>

  /** Creates or replaces the profile, stamping audit fields from the clock. */
  save(profile: ProfileInput): Promise<Result<Profile>>
}

/** Reads and writes the single {@link Goal} row and its append-only change log. */
export interface GoalRepository {
  /** @returns The active goal, or null before onboarding has completed. */
  get(): Promise<Result<Goal | null>>

  /** Creates or replaces the active goal. Does not itself write a change row. */
  save(goal: GoalInput): Promise<Result<Goal>>

  /**
   * Appends the audit row required when expenses, level, or target change.
   *
   * Separate from {@link save} so a first-time goal does not manufacture a change record
   * for a revision that never happened.
   */
  recordChange(change: GoalChangeInput): Promise<Result<void>>

  /** @returns Every recorded revision, oldest first. */
  listChanges(): Promise<Result<readonly GoalChange[]>>
}

/** Reads and writes the ledger — the fund's only source of truth. */
export interface LedgerRepository {
  /** Inserts an entry, generating its id and audit timestamps. */
  add(entry: LedgerEntryInput): Promise<Result<LedgerEntry>>

  /**
   * Applies an edit to an existing entry (FR-011).
   *
   * @returns The updated entry, or a not-found failure if the id is unknown.
   */
  update(id: string, patch: LedgerEntryPatch): Promise<Result<LedgerEntry>>

  /** Hard-deletes an entry. The caller is responsible for confirming first (FR-011). */
  remove(id: string): Promise<Result<void>>

  /** @returns The entry, or null when no entry has that id. */
  getById(id: string): Promise<Result<LedgerEntry | null>>

  /**
   * Entries ordered by date, then by creation time so a day's entries keep their order.
   *
   * @param range Both bounds inclusive. Omit for the full history.
   */
  list(range?: DateRange): Promise<Result<readonly LedgerEntry[]>>

  /**
   * Entries dated after today — surfaced so the user can correct them, and excluded from
   * every pace, streak, and projection calculation (FR-033).
   *
   * @param today From the injected clock, never from `new Date()`.
   */
  listFutureDated(today: CalendarDate): Promise<Result<readonly LedgerEntry[]>>
}

/** Reads and writes the single reminder schedule row. */
export interface ReminderRepository {
  /** @returns The current setting, defaulting to disabled when none was ever saved. */
  get(): Promise<Result<ReminderSetting>>

  save(setting: ReminderSetting): Promise<Result<ReminderSetting>>
}

/** Tracks which progress milestones have already been shown, so each fires once. */
export interface MilestoneRepository {
  /** @returns Thresholds already acknowledged, so they are not announced twice. */
  listAcknowledged(): Promise<Result<readonly MilestoneThreshold[]>>

  acknowledge(threshold: MilestoneThreshold): Promise<Result<void>>

  /**
   * Forgets thresholds now above the balance, so crossing one again is acknowledged
   * again.
   *
   * Without this, a user who withdraws and then recovers would pass 50% in silence.
   *
   * @param percent Current progress, 0–100.
   */
  clearAbove(percent: number): Promise<Result<void>>
}

/** The full set of repositories, handed to work running inside a transaction. */
export interface Repositories {
  readonly profile: ProfileRepository
  readonly goal: GoalRepository
  readonly ledger: LedgerRepository
  readonly reminders: ReminderRepository
  readonly milestones: MilestoneRepository
}
