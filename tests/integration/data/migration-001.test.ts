import { initialSchema } from '@/data/sqlite/migrations/001-initial'
import type { SqlValue } from '@/data/sqlite/driver'
import { migrate } from '@/data/sqlite/migrations/runner'
import { createTestDatabase, type TestDatabase } from '@tests/support/sqlite-harness'

/**
 * Every constraint in data-model.md, asserted against the engine rather than trusted.
 *
 * A CHECK constraint that was never exercised is a comment. These matter because the
 * schema is the last line of defence for invariants the domain also enforces — an import,
 * a future migration, and a bug in a repository all reach the tables directly.
 *
 * Each rejection names the constraint it expects. Asserting only "it threw" would pass
 * just as happily when the wrong rule fires, which is exactly the mistake worth catching.
 */
describe('migration 001', () => {
  const NOW = '2026-08-22T10:00:00.000Z'
  let db: TestDatabase

  beforeEach(async () => {
    db = createTestDatabase()
    // Pinned to this one step rather than the whole set, so adding migration 002 does not
    // start changing what these assertions are about.
    await migrate(db, [initialSchema])
  })

  afterEach(async () => {
    await db.close()
  })

  /**
   * Inserts a row built from an object, so each test names only the field it varies.
   *
   * @returns Rows written — always 1 on success, which is what the accepting tests check.
   */
  async function insert(table: string, row: Record<string, SqlValue>): Promise<number> {
    const columns = Object.keys(row)
    const placeholders = columns.map(() => '?').join(', ')
    const result = await db.run(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
      Object.values(row),
    )
    return result.changes
  }

  /** @returns The names of every schema object of the given kind, alphabetically. */
  async function schemaNames(kind: 'table' | 'index'): Promise<string[]> {
    const rows = await db.selectAll<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type = ? ORDER BY name`,
      [kind],
    )
    return rows.map((row) => row.name)
  }

  describe('schema', () => {
    it('leaves the database at version 1', async () => {
      expect(await db.selectOne('PRAGMA user_version')).toEqual({ user_version: 1 })
    })

    it('creates exactly the six tables the data model defines', async () => {
      expect(await schemaNames('table')).toEqual([
        'goal',
        'goal_change',
        'ledger_entry',
        'milestone_ack',
        'profile',
        'reminder_setting',
      ])
    })

    it('indexes entry_date, which every statistic and the pace window scan by', async () => {
      expect(await schemaNames('index')).toContain('ix_ledger_entry_entry_date')
    })

    it('creates the partial unique index that admits only one opening balance', async () => {
      expect(await schemaNames('index')).toContain('ux_ledger_entry_opening')
    })
  })

  describe('profile', () => {
    const valid = {
      id: 1,
      monthly_expenses_minor: 200_000,
      currency_code: 'BRL',
      created_at: NOW,
      updated_at: NOW,
    }

    it('accepts the single valid row', async () => {
      await expect(insert('profile', valid)).resolves.toBe(1)
    })

    it('refuses a second row, because there is exactly one person per device', async () => {
      await insert('profile', valid)
      await expect(insert('profile', { ...valid, id: 2 })).rejects.toThrow('profile_single_row')
    })

    it.each([0, -1])(
      'refuses monthly expenses of %i, which FR-001 requires above zero',
      async (expenses) => {
        await expect(
          insert('profile', { ...valid, monthly_expenses_minor: expenses }),
        ).rejects.toThrow('profile_expenses_positive')
      },
    )

    it('refuses a currency code that is not three uppercase letters', async () => {
      await expect(insert('profile', { ...valid, currency_code: 'brl' })).rejects.toThrow(
        'profile_currency_shape',
      )
    })
  })

  describe('goal', () => {
    const valid = {
      id: 1,
      target_minor: 1_200_000,
      source: 'calculated',
      level_key: 'balanced',
      coverage_months: 6,
      desired_completion_date: null,
      created_at: NOW,
      updated_at: NOW,
    }

    it('accepts the single valid row', async () => {
      await expect(insert('goal', valid)).resolves.toBe(1)
    })

    it('refuses a second row', async () => {
      await insert('goal', valid)
      await expect(insert('goal', { ...valid, id: 2 })).rejects.toThrow('goal_single_row')
    })

    it('refuses a zero target, which the spec calls out as an edge case', async () => {
      await expect(insert('goal', { ...valid, target_minor: 0 })).rejects.toThrow(
        'goal_target_positive',
      )
    })

    it('refuses a source outside calculated and user_defined (FR-005)', async () => {
      await expect(insert('goal', { ...valid, source: 'guessed' })).rejects.toThrow(
        'goal_source_known',
      )
    })

    it('refuses a level key outside the five the spec names (FR-002)', async () => {
      await expect(insert('goal', { ...valid, level_key: 'paranoid' })).rejects.toThrow(
        'goal_level_known',
      )
    })

    it.each([0, 25])('refuses coverage of %i months, outside the 1–24 range', async (months) => {
      await expect(insert('goal', { ...valid, coverage_months: months })).rejects.toThrow(
        'goal_coverage_range',
      )
    })

    it.each([1, 24])('accepts coverage of %i months, at the range boundary', async (months) => {
      await expect(insert('goal', { ...valid, coverage_months: months })).resolves.toBe(1)
    })

    it('refuses a completion date that is not YYYY-MM-DD, since dates sort as text', async () => {
      await expect(
        insert('goal', { ...valid, desired_completion_date: '31/12/2027' }),
      ).rejects.toThrow('goal_completion_date_shape')
    })

    it('accepts a well-formed completion date (FR-031)', async () => {
      await expect(
        insert('goal', { ...valid, desired_completion_date: '2027-12-31' }),
      ).resolves.toBe(1)
    })
  })

  describe('goal_change', () => {
    const valid = {
      id: 'change-1',
      changed_at: NOW,
      previous_target_minor: 1_200_000,
      new_target_minor: 1_800_000,
      previous_expenses_minor: 200_000,
      new_expenses_minor: 300_000,
      previous_coverage_months: 6,
      new_coverage_months: 6,
    }

    it('accepts a valid revision record', async () => {
      await expect(insert('goal_change', valid)).resolves.toBe(1)
    })

    it('accepts many rows, because the log is append-only rather than single-row', async () => {
      await insert('goal_change', valid)
      await expect(insert('goal_change', { ...valid, id: 'change-2' })).resolves.toBe(1)
    })

    it('refuses a duplicate id', async () => {
      await insert('goal_change', valid)
      await expect(insert('goal_change', valid)).rejects.toThrow('UNIQUE constraint failed')
    })

    it('refuses a non-positive previous target', async () => {
      await expect(insert('goal_change', { ...valid, previous_target_minor: 0 })).rejects.toThrow(
        'goal_change_previous_target_positive',
      )
    })

    it('refuses coverage outside 1–24 on the new side of the change', async () => {
      await expect(insert('goal_change', { ...valid, new_coverage_months: 25 })).rejects.toThrow(
        'goal_change_new_coverage_range',
      )
    })
  })

  describe('ledger_entry', () => {
    const valid = {
      id: 'entry-1',
      type: 'contribution',
      amount_minor: 50_000,
      entry_date: '2026-08-01',
      note: null,
      withdrawal_reason: null,
      created_at: NOW,
      updated_at: NOW,
    }
    const withdrawal = { ...valid, type: 'withdrawal', withdrawal_reason: 'car repair' }

    it('accepts a contribution', async () => {
      await expect(insert('ledger_entry', valid)).resolves.toBe(1)
    })

    it('accepts a withdrawal carrying a reason (FR-016)', async () => {
      await expect(insert('ledger_entry', withdrawal)).resolves.toBe(1)
    })

    it('refuses a type outside opening, contribution, and withdrawal', async () => {
      await expect(insert('ledger_entry', { ...valid, type: 'transfer' })).rejects.toThrow(
        'ledger_entry_type_known',
      )
    })

    it.each([0, -50_000])(
      'refuses an amount of %i, since direction is carried by type alone',
      async (amount) => {
        await expect(insert('ledger_entry', { ...valid, amount_minor: amount })).rejects.toThrow(
          'ledger_entry_amount_positive',
        )
      },
    )

    it('refuses a withdrawal with no reason (FR-016)', async () => {
      await expect(
        insert('ledger_entry', { ...withdrawal, withdrawal_reason: null }),
      ).rejects.toThrow('ledger_entry_reason_matches_type')
    })

    it('refuses a reason on an entry that is not a withdrawal', async () => {
      await expect(
        insert('ledger_entry', { ...valid, withdrawal_reason: 'car repair' }),
      ).rejects.toThrow('ledger_entry_reason_matches_type')
    })

    it('refuses a note longer than 280 characters', async () => {
      await expect(insert('ledger_entry', { ...valid, note: 'x'.repeat(281) })).rejects.toThrow(
        'ledger_entry_note_length',
      )
    })

    it('accepts a note of exactly 280 characters, at the boundary', async () => {
      await expect(insert('ledger_entry', { ...valid, note: 'x'.repeat(280) })).resolves.toBe(1)
    })

    it('refuses a note on a withdrawal, whose text belongs in the reason', async () => {
      await expect(insert('ledger_entry', { ...withdrawal, note: 'why' })).rejects.toThrow(
        'ledger_entry_note_placement',
      )
    })

    it('refuses an entry date that is not YYYY-MM-DD', async () => {
      await expect(insert('ledger_entry', { ...valid, entry_date: '01-08-2026' })).rejects.toThrow(
        'ledger_entry_date_shape',
      )
    })

    it('refuses a second opening balance', async () => {
      const opening = { ...valid, type: 'opening' }
      await insert('ledger_entry', opening)
      // Names the indexed column rather than the index, which is how SQLite reports it.
      // Still specific: a clash on `type` can only be the partial opening index, since
      // `type` is not unique anywhere else.
      await expect(insert('ledger_entry', { ...opening, id: 'entry-2' })).rejects.toThrow(
        'UNIQUE constraint failed: ledger_entry.type',
      )
    })

    it('allows many contributions, so the unique index is scoped to openings only', async () => {
      await insert('ledger_entry', valid)
      await expect(insert('ledger_entry', { ...valid, id: 'entry-2' })).resolves.toBe(1)
    })

    it('refuses a duplicate id, which is what makes merge deduplication exact (FR-047)', async () => {
      await insert('ledger_entry', valid)
      await expect(insert('ledger_entry', valid)).rejects.toThrow('UNIQUE constraint failed')
    })
  })

  describe('reminder_setting', () => {
    const monthly = {
      id: 1,
      enabled: 0,
      frequency: 'monthly',
      day_of_month: 1,
      day_of_week: null,
      time_of_day: '09:00',
    }
    const weekly = { ...monthly, frequency: 'weekly', day_of_month: null, day_of_week: 1 }

    it('accepts a monthly schedule', async () => {
      await expect(insert('reminder_setting', monthly)).resolves.toBe(1)
    })

    it('accepts a weekly schedule', async () => {
      await expect(insert('reminder_setting', weekly)).resolves.toBe(1)
    })

    it('refuses a second row', async () => {
      await insert('reminder_setting', monthly)
      await expect(insert('reminder_setting', { ...monthly, id: 2 })).rejects.toThrow(
        'reminder_single_row',
      )
    })

    it('refuses an enabled flag that is not 0 or 1', async () => {
      await expect(insert('reminder_setting', { ...monthly, enabled: 2 })).rejects.toThrow(
        'reminder_enabled_flag',
      )
    })

    it('refuses a frequency outside weekly and monthly', async () => {
      await expect(insert('reminder_setting', { ...monthly, frequency: 'daily' })).rejects.toThrow(
        'reminder_frequency_known',
      )
    })

    it('refuses day 29, since not every month has one', async () => {
      await expect(insert('reminder_setting', { ...monthly, day_of_month: 29 })).rejects.toThrow(
        'reminder_day_of_month_range',
      )
    })

    it('refuses a monthly schedule with no day of month', async () => {
      await expect(insert('reminder_setting', { ...monthly, day_of_month: null })).rejects.toThrow(
        'reminder_monthly_has_day',
      )
    })

    it('refuses a weekly schedule with no day of week', async () => {
      await expect(insert('reminder_setting', { ...weekly, day_of_week: null })).rejects.toThrow(
        'reminder_weekly_has_day',
      )
    })

    it('refuses a day of week outside 0–6', async () => {
      await expect(insert('reminder_setting', { ...weekly, day_of_week: 7 })).rejects.toThrow(
        'reminder_day_of_week_range',
      )
    })

    it('refuses a time that is not HH:MM', async () => {
      await expect(insert('reminder_setting', { ...monthly, time_of_day: '9am' })).rejects.toThrow(
        'reminder_time_shape',
      )
    })
  })

  describe('milestone_ack', () => {
    it.each([25, 50, 75, 100])('accepts the %i%% threshold', async (threshold) => {
      await expect(insert('milestone_ack', { threshold, acknowledged_at: NOW })).resolves.toBe(1)
    })

    it('refuses a threshold the spec does not define', async () => {
      await expect(
        insert('milestone_ack', { threshold: 60, acknowledged_at: NOW }),
      ).rejects.toThrow('milestone_threshold_known')
    })

    it('refuses the same threshold twice, so a milestone fires once per crossing', async () => {
      await insert('milestone_ack', { threshold: 50, acknowledged_at: NOW })
      await expect(
        insert('milestone_ack', { threshold: 50, acknowledged_at: NOW }),
      ).rejects.toThrow('UNIQUE constraint failed')
    })
  })
})
