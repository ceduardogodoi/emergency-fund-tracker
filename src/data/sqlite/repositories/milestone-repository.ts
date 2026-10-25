import type { MilestoneThreshold } from '@/domain/ledger/types'
import type { Clock } from '@/domain/ports/clock'
import type { MilestoneRepository } from '@/domain/ports/repositories'
import type { Result } from '@/domain/result'

import type { SqliteDatabase } from '../driver'
import { attempt } from './attempt'

/** A stored acknowledgement, as the query returns it. */
interface MilestoneRow {
  readonly threshold: number
}

/** Lowest first, so a caller reading "the highest acknowledged" reads the last. */
const SELECT_ALL = `SELECT threshold FROM milestone_ack ORDER BY threshold ASC`

/**
 * `OR IGNORE`, because acknowledging a threshold already acknowledged is not a failure: the
 * row says the milestone was shown, and it was. The first instant stands, since that is
 * when it was shown.
 */
const INSERT = `INSERT OR IGNORE INTO milestone_ack (threshold, acknowledged_at) VALUES (?, ?)`

/** Strictly above: a fund sitting exactly on a threshold has reached it. */
const DELETE_ABOVE = `DELETE FROM milestone_ack WHERE threshold > ?`

/**
 * Builds the SQLite-backed {@link MilestoneRepository}.
 *
 * The table records which milestones have been shown, so FR-024 fires once per crossing.
 * `clearAbove` is the half that is easy to forget and silent when forgotten: without it, a
 * user who withdraws and then recovers passes 50% again with nothing said.
 *
 * @param db The connection the current transaction runs on.
 * @param clock Supplies the instant each acknowledgement is stamped with.
 * @returns The repository.
 */
export function createMilestoneRepository(db: SqliteDatabase, clock: Clock): MilestoneRepository {
  return {
    async listAcknowledged(): Promise<Result<readonly MilestoneThreshold[]>> {
      return attempt('milestones.list-failed', async () => {
        const rows = await db.selectAll<MilestoneRow>(SELECT_ALL)
        // The schema's CHECK admits 25, 50, 75, and 100 alone, so a stored threshold is
        // always one of them. The cast states that; re-validating would test SQLite.
        return rows.map((row) => row.threshold as MilestoneThreshold)
      })
    },

    async acknowledge(threshold: MilestoneThreshold): Promise<Result<void>> {
      return attempt('milestones.acknowledge-failed', async () => {
        await db.run(INSERT, [threshold, clock.now()])
      })
    },

    async clearAbove(percent: number): Promise<Result<void>> {
      return attempt('milestones.clear-failed', async () => {
        await db.run(DELETE_ABOVE, [percent])
      })
    },
  }
}
