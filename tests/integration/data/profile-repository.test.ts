import { createProfileRepository } from '@/data/sqlite/repositories/profile-repository'
import { currencyCode } from '@/domain/money/currency'
import { money } from '@/domain/money/money'
import type { ProfileRepository } from '@/domain/ports/repositories'
import type { ProfileInput } from '@/domain/profile/types'
import { FakeClock } from '@tests/support/doubles'
import { expectOk } from '@tests/support/expect-result'
import { createMigratedDatabase, type TestDatabase } from '@tests/support/sqlite-harness'

/**
 * Against the real engine, so the constraints in migration 001 are part of what is tested.
 * The single-row rule in particular is the schema's, not the repository's — asserting it
 * against an array-backed double would prove nothing about the fund on a device.
 */
const BRL = currencyCode('BRL')

/** The profile under test, so each case states only the field it is about. */
function profileInput(overrides: Partial<ProfileInput> = {}): ProfileInput {
  return { monthlyExpenses: money(200_000), currency: BRL, ...overrides }
}

describe('ProfileRepository', () => {
  let db: TestDatabase
  let clock: FakeClock
  let repository: ProfileRepository

  beforeEach(async () => {
    db = await createMigratedDatabase()
    clock = new FakeClock('2026-08-22')
    repository = createProfileRepository(db, clock)
  })

  afterEach(async () => {
    await db.close()
  })

  it('reports no profile before onboarding has written one', async () => {
    expect(await repository.get()).toEqual({ ok: true, value: null })
  })

  it('saves a profile and stamps its audit fields from the clock, not the caller', async () => {
    expect(await repository.save(profileInput())).toEqual({
      ok: true,
      value: {
        monthlyExpenses: money(200_000),
        currency: BRL,
        createdAt: clock.now(),
        updatedAt: clock.now(),
      },
    })
  })

  it('reads back exactly what was written, with the money still a whole number of units', async () => {
    await repository.save(profileInput({ monthlyExpenses: money(133_337) }))
    expect(await repository.get()).toEqual({
      ok: true,
      value: {
        monthlyExpenses: money(133_337),
        currency: BRL,
        createdAt: clock.now(),
        updatedAt: clock.now(),
      },
    })
  })

  // FR-006: revising expenses preserves everything else. `createdAt` is when the fund
  // began, and an update that reset it would silently rewrite that history.
  it('keeps the original createdAt when the profile is revised, and moves updatedAt', async () => {
    const created = expectOk(await repository.save(profileInput()))
    clock.setToday('2026-09-01')
    const revised = expectOk(
      await repository.save(profileInput({ monthlyExpenses: money(250_000) })),
    )

    expect(revised).toEqual({
      monthlyExpenses: money(250_000),
      currency: BRL,
      createdAt: created.createdAt,
      updatedAt: clock.now(),
    })
    expect(revised.updatedAt).not.toBe(created.updatedAt)
  })

  // The `profile_single_row` CHECK is what makes "exactly one per install" true even for a
  // write that never passed through this repository — a later migration, or an import.
  it('replaces the profile rather than accumulating rows', async () => {
    await repository.save(profileInput())
    await repository.save(profileInput({ monthlyExpenses: money(250_000) }))

    const rows = await db.selectAll<{ readonly count: number }>(
      'SELECT COUNT(*) AS count FROM profile',
    )
    expect(rows).toEqual([{ count: 1 }])
  })

  // Principle II: no swallowed failures. The domain rejects this first, but a repository
  // that turned a constraint violation into a thrown exception would escape every caller's
  // Result handling and reach the user as a crash.
  it('returns a storage failure when the schema rejects the write', async () => {
    expect(await repository.save(profileInput({ monthlyExpenses: money(0) }))).toEqual({
      ok: false,
      error: expect.objectContaining({ kind: 'storage', messageKey: 'profile.save-failed' }),
    })
  })

  it('returns a storage failure rather than throwing when the database is gone', async () => {
    await db.close()
    expect(await repository.get()).toEqual({
      ok: false,
      error: expect.objectContaining({ kind: 'storage', messageKey: 'profile.read-failed' }),
    })
  })
})
