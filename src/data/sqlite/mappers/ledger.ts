import { calendarDate } from '@/domain/dates/calendar-date'
import { instant } from '@/domain/dates/instant'
import type { EntryType, LedgerEntry } from '@/domain/ledger/types'
import { money } from '@/domain/money/money'

/** The `ledger_entry` row as SQLite hands it back. */
export interface LedgerEntryRow {
  readonly id: string
  readonly type: string
  readonly amount_minor: number
  readonly entry_date: string
  readonly note: string | null
  readonly withdrawal_reason: string | null
  readonly created_at: string
  readonly updated_at: string
}

/**
 * Turns a stored row into a {@link LedgerEntry}.
 *
 * `type` is asserted rather than parsed, for the same reason the goal mapper asserts its
 * unions: the schema's `ledger_entry_type_known` CHECK restricts the column to exactly the
 * three values {@link EntryType} names, so the constraint is what makes the assertion true.
 * Re-validating here would put the rule in two places, and the copy that drifted would be
 * this one.
 *
 * @param row The row as read.
 * @returns The domain entry.
 * @throws {RangeError} If a stored amount or date is not what the schema promised — a
 *   fractional amount, or a date that is not `YYYY-MM-DD`. Both are impossible through the
 *   app and would mean the file had been edited by hand or corrupted.
 */
export function toLedgerEntry(row: LedgerEntryRow): LedgerEntry {
  return {
    id: row.id,
    type: row.type as EntryType,
    amount: money(row.amount_minor),
    date: calendarDate(row.entry_date),
    note: row.note,
    withdrawalReason: row.withdrawal_reason,
    createdAt: instant(row.created_at),
    updatedAt: instant(row.updated_at),
  }
}
