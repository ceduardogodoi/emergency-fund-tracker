import { bootstrapDatabase, createUnitOfWork } from '@/data/sqlite/database'
import { storageError } from '@/domain/errors/app-error'
import type { Repositories } from '@/domain/ports/repositories'
import { err, ok } from '@/domain/result'
import type { UnitOfWork } from '@/domain/ports/unit-of-work'
import { createTestDatabase, type TestDatabase } from '@tests/support/sqlite-harness'

/**
 * FR-046 says no partial import may ever be applied, and FR-044's erase is likewise
 * all-or-nothing. Neither is a rule the import code can be careful enough to keep on its
 * own — they are properties of this wrapper, so this is where they are proved.
 *
 * The work callbacks below write with raw SQL rather than through repositories. The
 * transaction boundary is what is under test, and no repository exists yet whose bugs
 * could be mistaken for a boundary failure.
 */
describe('sqlite database', () => {
  let db: TestDatabase

  beforeEach(async () => {
    db = createTestDatabase()
    await bootstrapDatabase(db)
  })

  afterEach(async () => {
    await db.close()
  })

  describe('bootstrapDatabase', () => {
    it('brings a fresh database up to the newest schema version', async () => {
      expect(await db.selectOne('PRAGMA user_version')).toEqual({ user_version: 1 })
    })

    it('reports what it migrated, so a boot log can say what changed', async () => {
      const fresh = createTestDatabase()

      const result = await bootstrapDatabase(fresh)

      expect(result).toEqual(
        ok({ from: 0, to: 1, applied: [{ version: 1, name: 'initial-schema' }] }),
      )
      await fresh.close()
    })

    it('enables foreign key enforcement, which SQLite leaves off by default', async () => {
      expect(await db.selectOne('PRAGMA foreign_keys')).toEqual({ foreign_keys: 1 })
    })

    it('applies nothing on a second boot', async () => {
      const result = await bootstrapDatabase(db)

      expect(result).toEqual(ok({ from: 1, to: 1, applied: [] }))
    })
  })

  describe('createUnitOfWork', () => {
    /** A stand-in for the repository set, which this suite hands through untouched. */
    const repositories = {} as Repositories
    let unitOfWork: UnitOfWork

    beforeEach(() => {
      unitOfWork = createUnitOfWork(db, () => repositories)
    })

    /** Writes one milestone acknowledgement — a row that is trivial to look for. */
    function acknowledge(threshold: number): Promise<unknown> {
      return db.run('INSERT INTO milestone_ack (threshold, acknowledged_at) VALUES (?, ?)', [
        threshold,
        '2026-08-22T10:00:00.000Z',
      ])
    }

    /** @returns Every acknowledged threshold currently in the table, ascending. */
    async function acknowledged(): Promise<number[]> {
      const rows = await db.selectAll<{ threshold: number }>(
        'SELECT threshold FROM milestone_ack ORDER BY threshold',
      )
      return rows.map((row) => row.threshold)
    }

    it('hands the work the repositories the factory built', async () => {
      const received: Repositories[] = []

      await unitOfWork.run(async (repos) => {
        received.push(repos)
        return ok(undefined)
      })

      expect(received).toEqual([repositories])
    })

    it('returns the value the work produced', async () => {
      const result = await unitOfWork.run(async () => ok('done'))

      expect(result).toEqual(ok('done'))
    })

    it('commits the writes when the work succeeds', async () => {
      await unitOfWork.run(async () => {
        await acknowledge(25)
        return ok(undefined)
      })

      expect(await acknowledged()).toEqual([25])
    })

    it('rolls back when the work returns a failure, since that is a decision to abort', async () => {
      await unitOfWork.run(async () => {
        await acknowledge(25)
        return err(storageError('storage.write-failed'))
      })

      expect(await acknowledged()).toEqual([])
    })

    it('returns the failure the work chose, without rewrapping it', async () => {
      const result = await unitOfWork.run(async () => err(storageError('storage.write-failed')))

      expect(result).toEqual(err(storageError('storage.write-failed')))
    })

    it('rolls back when the work throws', async () => {
      await unitOfWork.run(async () => {
        await acknowledge(25)
        throw new Error('driver exploded')
      })

      expect(await acknowledged()).toEqual([])
    })

    it('reports a thrown failure as a storage error carrying the cause for the log', async () => {
      const boom = new Error('driver exploded')

      const result = await unitOfWork.run(async () => {
        throw boom
      })

      expect(result).toEqual(err(storageError('storage.transaction-failed', boom)))
    })

    describe('nesting', () => {
      it('lets an inner failure roll back only its own writes', async () => {
        await unitOfWork.run(async () => {
          await acknowledge(25)
          await unitOfWork.run(async () => {
            await acknowledge(50)
            return err(storageError('storage.write-failed'))
          })
          return ok(undefined)
        })

        expect(await acknowledged()).toEqual([25])
      })

      it('rolls back committed inner work when the outer transaction aborts', async () => {
        await unitOfWork.run(async () => {
          await unitOfWork.run(async () => {
            await acknowledge(50)
            return ok(undefined)
          })
          return err(storageError('storage.write-failed'))
        })

        expect(await acknowledged()).toEqual([])
      })
    })

    it('serialises overlapping transactions rather than interleaving them', async () => {
      const failing = unitOfWork.run(async () => {
        await acknowledge(25)
        return err(storageError('storage.write-failed'))
      })
      const succeeding = unitOfWork.run(async () => {
        await acknowledge(50)
        return ok(undefined)
      })
      await Promise.all([failing, succeeding])

      expect(await acknowledged()).toEqual([50])
    })
  })
})
