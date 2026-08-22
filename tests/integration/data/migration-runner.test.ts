import { migrate, type Migration } from '@/data/sqlite/migrations/runner'
import { err, ok } from '@/domain/result'
import { storageError } from '@/domain/errors/app-error'
import { createTestDatabase, type TestDatabase } from '@tests/support/sqlite-harness'

/**
 * The runner is the mechanism data-model.md's schema-versioning section describes: each
 * numbered step applied in order, inside its own transaction, with `PRAGMA user_version`
 * bumped as the last statement of the step.
 *
 * These assertions exist because FR-043 promises data survives app updates. The failure
 * that promise dies to is a migration that half-applies and leaves the version behind,
 * so half-application is what most of this file is about.
 */
describe('migrate', () => {
  let db: TestDatabase

  beforeEach(() => {
    db = createTestDatabase()
  })

  afterEach(async () => {
    await db.close()
  })

  /** Reads the schema version the way the runner does. */
  async function currentVersion(): Promise<number> {
    const row = await db.selectOne<{ user_version: number }>('PRAGMA user_version')
    return row === null ? -1 : row.user_version
  }

  /** True when the named table exists in the schema. */
  async function hasTable(name: string): Promise<boolean> {
    const row = await db.selectOne(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`,
      [name],
    )
    return row !== null
  }

  /** A migration that creates a one-column table named after itself. */
  function creating(version: number, name: string, order?: string[]): Migration {
    return {
      version,
      name,
      apply: async (target) => {
        order?.push(name)
        await target.execute(`CREATE TABLE ${name} (id INTEGER PRIMARY KEY)`)
      },
    }
  }

  describe('on a fresh database', () => {
    it('starts at version 0, which is what makes every migration pending', async () => {
      expect(await currentVersion()).toBe(0)
    })

    it('applies every migration and reports what it did', async () => {
      const result = await migrate(db, [creating(1, 'alpha'), creating(2, 'beta')])

      expect(result).toEqual(
        ok({
          from: 0,
          to: 2,
          applied: [
            { version: 1, name: 'alpha' },
            { version: 2, name: 'beta' },
          ],
        }),
      )
    })

    it('leaves the schema version at the highest applied migration', async () => {
      await migrate(db, [creating(1, 'alpha'), creating(2, 'beta')])

      expect(await currentVersion()).toBe(2)
    })

    it('applies in ascending version order regardless of the order given', async () => {
      const order: string[] = []

      await migrate(db, [
        creating(3, 'third', order),
        creating(1, 'first', order),
        creating(2, 'second', order),
      ])

      expect(order).toEqual(['first', 'second', 'third'])
    })
  })

  describe('on a database already at a version', () => {
    it('applies nothing on a second run, so booting twice is not booting twice as far', async () => {
      const migrations = [creating(1, 'alpha'), creating(2, 'beta')]
      await migrate(db, migrations)

      const second = await migrate(db, migrations)

      expect(second).toEqual(ok({ from: 2, to: 2, applied: [] }))
    })

    it('applies only the steps above the current version', async () => {
      await migrate(db, [creating(1, 'alpha')])

      const result = await migrate(db, [creating(1, 'alpha'), creating(2, 'beta')])

      expect(result).toEqual(ok({ from: 1, to: 2, applied: [{ version: 2, name: 'beta' }] }))
    })

    it('refuses a database newer than the code, since migrations are forward-only', async () => {
      await migrate(db, [creating(1, 'alpha'), creating(2, 'beta')])

      const result = await migrate(db, [creating(1, 'alpha')])

      expect(result).toEqual(err(storageError('storage.schema-ahead')))
    })
  })

  describe('when a migration fails', () => {
    const boom = new Error('constraint blew up')

    /** Creates a table, then fails — the shape that would corrupt a schema. */
    function halfApplying(version: number): Migration {
      return {
        version,
        name: `broken-${version}`,
        apply: async (target) => {
          await target.execute(`CREATE TABLE orphan_${version} (id INTEGER PRIMARY KEY)`)
          throw boom
        },
      }
    }

    it('reports the failure with the driver error attached for the log', async () => {
      const result = await migrate(db, [halfApplying(1)])

      expect(result).toEqual(err(storageError('storage.migration-failed', boom)))
    })

    it('rolls the whole step back, leaving no table it had already created', async () => {
      await migrate(db, [halfApplying(1)])

      expect(await hasTable('orphan_1')).toBe(false)
    })

    it('leaves the schema version untouched, so the step is retried on next boot', async () => {
      await migrate(db, [halfApplying(1)])

      expect(await currentVersion()).toBe(0)
    })

    it('keeps steps that already committed, because each step is its own transaction', async () => {
      await migrate(db, [creating(1, 'alpha'), halfApplying(2)])

      expect({ alpha: await hasTable('alpha'), version: await currentVersion() }).toEqual({
        alpha: true,
        version: 1,
      })
    })

    it('does not attempt any step after the failure', async () => {
      const order: string[] = []

      await migrate(db, [halfApplying(1), creating(2, 'beta', order)])

      expect(order).toEqual([])
    })
  })

  describe('when the migration list itself is wrong', () => {
    it('rejects duplicate versions, which would make the applied set ambiguous', async () => {
      const result = await migrate(db, [creating(1, 'alpha'), creating(1, 'beta')])

      expect(result).toEqual(err(storageError('storage.migrations-invalid')))
    })

    it('rejects version 0, which is indistinguishable from an unmigrated database', async () => {
      const result = await migrate(db, [creating(0, 'alpha')])

      expect(result).toEqual(err(storageError('storage.migrations-invalid')))
    })

    it('rejects a fractional version, which has no ordering the pragma can hold', async () => {
      const result = await migrate(db, [creating(1.5, 'alpha')])

      expect(result).toEqual(err(storageError('storage.migrations-invalid')))
    })

    it('applies nothing when the list is rejected', async () => {
      await migrate(db, [creating(1, 'alpha'), creating(1, 'beta')])

      expect(await hasTable('alpha')).toBe(false)
    })

    it('accepts an empty list, since a schema with no migrations is legitimately at 0', async () => {
      const result = await migrate(db, [])

      expect(result).toEqual(ok({ from: 0, to: 0, applied: [] }))
    })
  })
})
