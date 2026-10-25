import { createMilestoneRepository } from '@/data/sqlite/repositories/milestone-repository'
import type { MilestoneRepository } from '@/domain/ports/repositories'
import { FakeClock } from '@tests/support/doubles'
import { expectErr, expectOk } from '@tests/support/expect-result'
import { createMigratedDatabase, type TestDatabase } from '@tests/support/sqlite-harness'

/**
 * Which milestones have been acknowledged, against real SQL (research decision D-006).
 *
 * The table is what makes FR-024 fire once per crossing rather than on every render, and
 * `clearAbove` is what makes it fire again after the fund falls back below a threshold and
 * climbs past it. Both halves are tested here, because a missing delete is silent: the user
 * recovers from a withdrawal and passes 50% with nothing said.
 */
describe('MilestoneRepository', () => {
  let db: TestDatabase
  let clock: FakeClock
  let repository: MilestoneRepository

  beforeEach(async () => {
    db = await createMigratedDatabase()
    clock = new FakeClock('2026-10-15')
    repository = createMilestoneRepository(db, clock)
  })

  afterEach(async () => {
    await db.close()
  })

  /** The rows as stored, read past the repository so its own reads are not the witness. */
  async function storedRows(): Promise<readonly unknown[]> {
    return db.selectAll('SELECT threshold, acknowledged_at FROM milestone_ack ORDER BY threshold')
  }

  it('has acknowledged nothing on a fresh store', async () => {
    expect(expectOk(await repository.listAcknowledged())).toEqual([])
  })

  // AP-003, in a form reversing the writes cannot catch. `threshold` is the table's
  // INTEGER PRIMARY KEY, which makes it the rowid, so a plain scan already returns rows
  // sorted by it — the ORDER BY could be deleted and the rows would still arrive in order,
  // whatever order they were written in. Measured: that mutation survived. SQLite promises
  // no order without the clause, though, so it stays, and this pragma is how the test sees
  // it: it reverses every SELECT that has no ORDER BY.
  it('lists what was acknowledged, lowest first', async () => {
    await db.execute('PRAGMA reverse_unordered_selects = ON')
    expectOk(await repository.acknowledge(75))
    expectOk(await repository.acknowledge(25))

    expect(expectOk(await repository.listAcknowledged())).toEqual([25, 75])
  })

  // The audit instant comes from the clock, never from the caller or the engine.
  it('stamps when each was acknowledged', async () => {
    clock.setNow('2026-10-15T09:30:00.000Z')
    expectOk(await repository.acknowledge(50))

    expect(await storedRows()).toEqual([
      { threshold: 50, acknowledged_at: '2026-10-15T09:30:00.000Z' },
    ])
  })

  // The table's primary key refuses a second row. Acknowledging again is not a failure —
  // the milestone has been shown, which is all the row says — and the first instant stands,
  // because that is when it was shown.
  it('acknowledges a threshold already acknowledged without failing, keeping the first time', async () => {
    clock.setNow('2026-10-15T09:30:00.000Z')
    expectOk(await repository.acknowledge(50))
    clock.setNow('2026-10-16T09:30:00.000Z')

    expectOk(await repository.acknowledge(50))

    expect(await storedRows()).toEqual([
      { threshold: 50, acknowledged_at: '2026-10-15T09:30:00.000Z' },
    ])
  })

  describe('clearAbove', () => {
    beforeEach(async () => {
      for (const threshold of [25, 50, 75, 100] as const) {
        expectOk(await repository.acknowledge(threshold))
      }
    })

    // The re-crossing rule (data-model, milestone_ack). At 60%, 75% and 100% are ahead of
    // the fund again, so crossing them later is a crossing worth saying.
    it('forgets every threshold above the progress given', async () => {
      expectOk(await repository.clearAbove(60))

      expect(expectOk(await repository.listAcknowledged())).toEqual([25, 50])
    })

    // A fund at exactly 50% has reached 50%. Forgetting it would announce it again on the
    // next contribution, which crosses nothing.
    it('keeps a threshold the progress sits exactly on', async () => {
      expectOk(await repository.clearAbove(50))

      expect(expectOk(await repository.listAcknowledged())).toEqual([25, 50])
    })

    // Progress arrives to two decimals. 49,99% is below 50.
    it('compares against fractional progress', async () => {
      expectOk(await repository.clearAbove(49.99))

      expect(expectOk(await repository.listAcknowledged())).toEqual([25])
    })

    it('forgets everything for a fund back at nothing', async () => {
      expectOk(await repository.clearAbove(0))

      expect(expectOk(await repository.listAcknowledged())).toEqual([])
    })

    it('forgets nothing at a reached goal', async () => {
      expectOk(await repository.clearAbove(100))

      expect(expectOk(await repository.listAcknowledged())).toEqual([25, 50, 75, 100])
    })
  })

  // A failed read must say so rather than answer with nothing: "no milestone acknowledged"
  // would announce every one of them again.
  it('reports a failed read as a storage failure', async () => {
    const failing = createMilestoneRepository(
      {
        ...db,
        async selectAll() {
          throw new Error('disk I/O error')
        },
      },
      clock,
    )

    expect(expectErr(await failing.listAcknowledged())).toMatchObject({ kind: 'storage' })
  })

  it('reports a failed write as a storage failure', async () => {
    const failing = createMilestoneRepository(
      {
        ...db,
        async run() {
          throw new Error('disk I/O error')
        },
      },
      clock,
    )

    expect(expectErr(await failing.acknowledge(25))).toMatchObject({ kind: 'storage' })
    expect(expectErr(await failing.clearAbove(25))).toMatchObject({ kind: 'storage' })
  })
})
