import { instant } from '@/domain/dates/instant'
import type { Clock } from '@/domain/ports/clock'
import type { ProfileRepository } from '@/domain/ports/repositories'
import type { Profile, ProfileInput } from '@/domain/profile/types'
import type { Result } from '@/domain/result'

import type { SqliteDatabase } from '../driver'
import { toProfile, type ProfileRow } from '../mappers/profile'
import { attempt } from './attempt'

/** Every column the mapper needs, named so the row shape cannot drift from the query. */
const COLUMNS = 'monthly_expenses_minor, currency_code, created_at, updated_at'

/**
 * The single profile row, addressed by its fixed id.
 *
 * `id = 1` is not a lookup — the `profile_single_row` CHECK permits no other value. It is
 * written out so the upsert has a conflict target, which is what makes "save" mean replace
 * rather than accumulate.
 */
const SELECT = `SELECT ${COLUMNS} FROM profile WHERE id = 1`

/**
 * Creates the row or replaces the fields that can change.
 *
 * `created_at` is absent from the update because an update has no business touching it.
 * That omission is not what preserves it, though — `excluded.created_at` already holds the
 * original, read before the write. `save` is what keeps it correct; this only makes the
 * statement say so.
 */
const UPSERT = `
  INSERT INTO profile (id, monthly_expenses_minor, currency_code, created_at, updated_at)
  VALUES (1, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    monthly_expenses_minor = excluded.monthly_expenses_minor,
    currency_code          = excluded.currency_code,
    updated_at             = excluded.updated_at
`

/**
 * Builds the SQLite-backed {@link ProfileRepository}.
 *
 * @param db The open database.
 * @param clock Supplies the audit timestamps, which are never taken from the caller —
 *   a caller-supplied `createdAt` could be back-dated, by a bug or by an imported file.
 * @returns The repository.
 */
export function createProfileRepository(db: SqliteDatabase, clock: Clock): ProfileRepository {
  return {
    async get(): Promise<Result<Profile | null>> {
      return attempt('profile.read-failed', async () => {
        const row = await db.selectOne<ProfileRow>(SELECT)
        return row === null ? null : toProfile(row)
      })
    },

    async save(profile: ProfileInput): Promise<Result<Profile>> {
      return attempt('profile.save-failed', async () => {
        // Read before writing rather than after. The only thing the caller cannot know is
        // the original `created_at`, and reading it first means the returned profile is
        // built from values already in hand — with no "written but not readable" case to
        // invent an answer for.
        const existing = await db.selectOne<ProfileRow>(SELECT)
        const now = clock.now()
        const createdAt = existing === null ? now : instant(existing.created_at)

        await db.run(UPSERT, [profile.monthlyExpenses, profile.currency, createdAt, now])
        return { ...profile, createdAt, updatedAt: now }
      })
    },
  }
}
