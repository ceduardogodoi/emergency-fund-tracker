import type { Migration } from './runner'

/**
 * `YYYY-MM-DD`, as a SQLite GLOB pattern.
 *
 * Calendar dates are compared and ordered as text by every range query in this app, so a
 * malformed one does not fail loudly — it sorts into the wrong place and quietly changes
 * a balance. The schema refuses it at the door.
 */
const DATE_PATTERN = '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'

/** The person's saving context. Exactly one row, created during onboarding. */
const PROFILE = `
  CREATE TABLE profile (
    id                     INTEGER NOT NULL PRIMARY KEY,
    monthly_expenses_minor INTEGER NOT NULL,
    currency_code          TEXT    NOT NULL,
    created_at             TEXT    NOT NULL,
    updated_at             TEXT    NOT NULL,
    CONSTRAINT profile_single_row       CHECK (id = 1),
    CONSTRAINT profile_expenses_positive CHECK (monthly_expenses_minor > 0),
    CONSTRAINT profile_currency_shape    CHECK (currency_code GLOB '[A-Z][A-Z][A-Z]')
  )
`

/**
 * The active target. Exactly one row.
 *
 * `coverage_months` is kept even when `source` is `user_defined`, so switching back to a
 * calculated target restores the level the user had chosen rather than a default.
 */
const GOAL = `
  CREATE TABLE goal (
    id                      INTEGER NOT NULL PRIMARY KEY,
    target_minor            INTEGER NOT NULL,
    source                  TEXT    NOT NULL,
    level_key               TEXT    NOT NULL,
    coverage_months         INTEGER NOT NULL,
    desired_completion_date TEXT,
    created_at              TEXT    NOT NULL,
    updated_at              TEXT    NOT NULL,
    CONSTRAINT goal_single_row     CHECK (id = 1),
    CONSTRAINT goal_target_positive CHECK (target_minor > 0),
    CONSTRAINT goal_source_known    CHECK (source IN ('calculated', 'user_defined')),
    CONSTRAINT goal_level_known
      CHECK (level_key IN ('lean', 'balanced', 'cautious', 'maximum', 'custom')),
    CONSTRAINT goal_coverage_range  CHECK (coverage_months BETWEEN 1 AND 24),
    CONSTRAINT goal_completion_date_shape
      CHECK (desired_completion_date IS NULL OR desired_completion_date GLOB '${DATE_PATTERN}')
  )
`

/**
 * One row per revision to expenses, level, or target.
 *
 * Append-only: never edited, never deleted except by a full erase or a replacing import.
 * It exists because the spec requires that when expenses change, history is preserved
 * with the change recorded.
 */
const GOAL_CHANGE = `
  CREATE TABLE goal_change (
    id                        TEXT    NOT NULL PRIMARY KEY,
    changed_at                TEXT    NOT NULL,
    previous_target_minor     INTEGER NOT NULL,
    new_target_minor          INTEGER NOT NULL,
    previous_expenses_minor   INTEGER NOT NULL,
    new_expenses_minor        INTEGER NOT NULL,
    previous_coverage_months  INTEGER NOT NULL,
    new_coverage_months       INTEGER NOT NULL,
    CONSTRAINT goal_change_previous_target_positive   CHECK (previous_target_minor > 0),
    CONSTRAINT goal_change_new_target_positive        CHECK (new_target_minor > 0),
    CONSTRAINT goal_change_previous_expenses_positive CHECK (previous_expenses_minor > 0),
    CONSTRAINT goal_change_new_expenses_positive      CHECK (new_expenses_minor > 0),
    CONSTRAINT goal_change_previous_coverage_range
      CHECK (previous_coverage_months BETWEEN 1 AND 24),
    CONSTRAINT goal_change_new_coverage_range
      CHECK (new_coverage_months BETWEEN 1 AND 24)
  )
`

/**
 * Every movement of money. This table is the fund — balance, progress, statistics, and
 * the forecast are all derived from it and none of them is stored.
 *
 * `amount_minor` is always positive; direction is carried by `type` and never by a sign,
 * so no query has to remember which way a negative number points.
 */
const LEDGER_ENTRY = `
  CREATE TABLE ledger_entry (
    id                TEXT    NOT NULL PRIMARY KEY,
    type              TEXT    NOT NULL,
    amount_minor      INTEGER NOT NULL,
    entry_date        TEXT    NOT NULL,
    note              TEXT,
    withdrawal_reason TEXT,
    created_at        TEXT    NOT NULL,
    updated_at        TEXT    NOT NULL,
    CONSTRAINT ledger_entry_type_known
      CHECK (type IN ('opening', 'contribution', 'withdrawal')),
    CONSTRAINT ledger_entry_amount_positive CHECK (amount_minor > 0),
    CONSTRAINT ledger_entry_date_shape      CHECK (entry_date GLOB '${DATE_PATTERN}'),
    CONSTRAINT ledger_entry_note_length     CHECK (note IS NULL OR length(note) <= 280),
    CONSTRAINT ledger_entry_note_placement  CHECK (note IS NULL OR type <> 'withdrawal'),
    CONSTRAINT ledger_entry_reason_matches_type
      CHECK ((type = 'withdrawal') = (withdrawal_reason IS NOT NULL))
  )
`

/** The pace window and every statistic scan by date, so the date is indexed. */
const LEDGER_ENTRY_DATE_INDEX = `
  CREATE INDEX ix_ledger_entry_entry_date ON ledger_entry (entry_date)
`

/**
 * At most one opening balance, enforced by the engine.
 *
 * A partial unique index rather than a CHECK, because the rule is about the table as a
 * whole and a CHECK can only see the row in front of it.
 */
const LEDGER_ENTRY_OPENING_INDEX = `
  CREATE UNIQUE INDEX ux_ledger_entry_opening ON ledger_entry (type) WHERE type = 'opening'
`

/**
 * The reminder schedule. Exactly one row, disabled by default (FR-034).
 *
 * `day_of_month` stops at 28 so the chosen day exists in February.
 */
const REMINDER_SETTING = `
  CREATE TABLE reminder_setting (
    id           INTEGER NOT NULL PRIMARY KEY,
    enabled      INTEGER NOT NULL DEFAULT 0,
    frequency    TEXT    NOT NULL,
    day_of_month INTEGER,
    day_of_week  INTEGER,
    time_of_day  TEXT    NOT NULL,
    CONSTRAINT reminder_single_row       CHECK (id = 1),
    CONSTRAINT reminder_enabled_flag     CHECK (enabled IN (0, 1)),
    CONSTRAINT reminder_frequency_known  CHECK (frequency IN ('weekly', 'monthly')),
    CONSTRAINT reminder_day_of_month_range
      CHECK (day_of_month IS NULL OR day_of_month BETWEEN 1 AND 28),
    CONSTRAINT reminder_day_of_week_range
      CHECK (day_of_week IS NULL OR day_of_week BETWEEN 0 AND 6),
    CONSTRAINT reminder_monthly_has_day
      CHECK ((frequency = 'monthly') = (day_of_month IS NOT NULL)),
    CONSTRAINT reminder_weekly_has_day
      CHECK ((frequency = 'weekly') = (day_of_week IS NOT NULL)),
    CONSTRAINT reminder_time_shape       CHECK (time_of_day GLOB '[0-2][0-9]:[0-5][0-9]')
  )
`

/**
 * Which progress milestones have already been shown, so FR-024 fires once per crossing
 * rather than on every render.
 *
 * Rows are deleted when the balance falls back below their threshold, which is what makes
 * a recovered withdrawal announce 50% again instead of passing it in silence.
 */
const MILESTONE_ACK = `
  CREATE TABLE milestone_ack (
    threshold       INTEGER NOT NULL PRIMARY KEY,
    acknowledged_at TEXT    NOT NULL,
    CONSTRAINT milestone_threshold_known CHECK (threshold IN (25, 50, 75, 100))
  )
`

/** Every statement of the initial schema, in dependency order. */
const STATEMENTS = [
  PROFILE,
  GOAL,
  GOAL_CHANGE,
  LEDGER_ENTRY,
  LEDGER_ENTRY_DATE_INDEX,
  LEDGER_ENTRY_OPENING_INDEX,
  REMINDER_SETTING,
  MILESTONE_ACK,
]

/**
 * The initial schema: the six tables of data-model.md and their constraints.
 *
 * Every rule the data model states is declared here as well as in the domain. That is
 * deliberate duplication, not redundancy — an import document, a later migration, and a
 * repository bug all reach these tables without passing through a domain function, and
 * the constraint is the only thing standing between them and a corrupt fund.
 */
export const initialSchema: Migration = {
  version: 1,
  name: 'initial-schema',
  apply: async (db) => {
    await db.execute(STATEMENTS.join(';\n'))
  },
}
