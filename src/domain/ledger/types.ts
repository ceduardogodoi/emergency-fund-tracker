import type { CalendarDate } from '../dates/calendar-date'
import type { Instant } from '../dates/instant'
import type { Money } from '../money/money'

/**
 * What kind of movement an entry records.
 *
 * `opening` is the money already set aside before the app was installed (FR-010). It is
 * an entry rather than a column on the profile so that the ledger stays the single source
 * of truth for the balance, and so the balance-over-time chart starts at the right place.
 * At most one may exist. Its cost is one exclusion rule: it counts toward the balance but
 * never toward "total contributed" or the contribution count.
 */
export type EntryType = 'opening' | 'contribution' | 'withdrawal'

/**
 * A single movement of money. The complete, ordered set of these is the fund — balance,
 * progress, statistics, and the forecast are all derived from them and none is stored.
 */
export interface LedgerEntry {
  /**
   * UUID generated at creation and **preserved across export and import**. This is what
   * makes merge deduplication exact rather than heuristic (FR-047).
   */
  readonly id: string
  readonly type: EntryType
  /** Always above zero. Direction comes from {@link type}, never from a negative amount. */
  readonly amount: Money
  /** The calendar date the user assigned. Never later than today at entry time (FR-009). */
  readonly date: CalendarDate
  /** Free text, at most 280 characters. Contributions and openings only. */
  readonly note: string | null
  /** Required for a withdrawal (FR-016), absent otherwise. */
  readonly withdrawalReason: string | null
  readonly createdAt: Instant
  readonly updatedAt: Instant
}

/** The caller-supplied half of a {@link LedgerEntry}; id and timestamps are generated. */
export type LedgerEntryInput = Omit<LedgerEntry, 'id' | 'createdAt' | 'updatedAt'>

/**
 * An edit to an existing entry (FR-011).
 *
 * Neither `id` nor `type` is editable. Changing an entry's type means deleting it and
 * creating the other kind, which keeps the merge identity in FR-047 stable — an id must
 * always refer to the same movement.
 */
export interface LedgerEntryPatch {
  readonly amount?: Money
  readonly date?: CalendarDate
  readonly note?: string | null
  readonly withdrawalReason?: string | null
}

/** An inclusive span of calendar dates, used to scope statistics to a period (FR-023). */
export interface DateRange {
  readonly from: CalendarDate
  readonly to: CalendarDate
}

/** The progress thresholds the app acknowledges as the balance crosses them (FR-024). */
export type MilestoneThreshold = 25 | 50 | 75 | 100

/** Every milestone, ascending — the canonical list to iterate when checking crossings. */
export const MILESTONE_THRESHOLDS: readonly MilestoneThreshold[] = [25, 50, 75, 100]
