import { calendarDate } from '@/domain/dates/calendar-date'
import { storageError } from '@/domain/errors/app-error'
import {
  acknowledgeMilestones,
  forgetMilestonesAbove,
  readProgress,
} from '@/domain/ledger/acknowledge-milestones'
import { summarizeProgress } from '@/domain/ledger/progress'
import type { LedgerEntryInput, ProgressSummary } from '@/domain/ledger/types'
import { money } from '@/domain/money/money'
import type { Repositories } from '@/domain/ports/repositories'
import { err } from '@/domain/result'
import {
  CountingIdGenerator,
  FakeClock,
  InMemoryMilestoneRepository,
  createInMemoryRepositories,
} from '@tests/support/doubles'
import { expectErr, expectOk } from '@tests/support/expect-result'

/**
 * What the save path does with a crossing (FR-024): records it, so it is acknowledged once
 * and never again, and forgets thresholds the fund has fallen back below, so the next
 * climb past one is acknowledged again.
 *
 * Target 10 000,00 throughout, so 2 500,00 is 25%.
 */
const TODAY = '2026-10-15'
const TARGET = 1_000_000

/** The position at a balance against {@link TARGET}. */
function at(balance: number): ProgressSummary {
  return summarizeProgress(money(balance), money(TARGET))
}

/** A contribution, dated today unless a case says otherwise. */
function contribution(minorUnits: number, date: string = TODAY): LedgerEntryInput {
  return {
    type: 'contribution',
    amount: money(minorUnits),
    date: calendarDate(date),
    note: null,
    withdrawalReason: null,
  }
}

describe('acknowledgeMilestones', () => {
  let milestones: InMemoryMilestoneRepository

  beforeEach(() => {
    milestones = new InMemoryMilestoneRepository()
  })

  it('records and returns the milestones a change crossed', async () => {
    expect(expectOk(await acknowledgeMilestones(milestones, at(200_000), at(600_000)))).toEqual([
      25, 50,
    ])
    expect(expectOk(await milestones.listAcknowledged())).toEqual([25, 50])
  })

  // Once acknowledged, never again — the "not again on the next launch" of quickstart's
  // Story 3. A crossing already on record is not news.
  it('leaves out a crossing already acknowledged', async () => {
    expectOk(await milestones.acknowledge(25))

    expect(expectOk(await acknowledgeMilestones(milestones, at(200_000), at(600_000)))).toEqual([
      50,
    ])
  })

  // The re-crossing rule. A withdrawal from 60% to 40% puts 50% ahead of the fund again,
  // and forgetting it here is what lets the recovery past it be acknowledged.
  it('forgets the milestones the fund has fallen back below', async () => {
    expectOk(await acknowledgeMilestones(milestones, at(200_000), at(600_000)))

    expect(expectOk(await acknowledgeMilestones(milestones, at(600_000), at(400_000)))).toEqual([])
    expect(expectOk(await milestones.listAcknowledged())).toEqual([25])
    expect(expectOk(await acknowledgeMilestones(milestones, at(400_000), at(550_000)))).toEqual([
      50,
    ])
  })

  it('reports a storage failure rather than a crossing it could not record', async () => {
    jest
      .spyOn(milestones, 'listAcknowledged')
      .mockResolvedValue(err(storageError('milestones.list-failed')))

    expect(
      expectErr(await acknowledgeMilestones(milestones, at(200_000), at(600_000))),
    ).toMatchObject({ kind: 'storage' })
  })

  it('stops at a failed acknowledgement, reporting it', async () => {
    jest
      .spyOn(milestones, 'acknowledge')
      .mockResolvedValue(err(storageError('milestones.acknowledge-failed')))

    expect(
      expectErr(await acknowledgeMilestones(milestones, at(200_000), at(600_000))),
    ).toMatchObject({ messageKey: 'milestones.acknowledge-failed' })
  })

  it('reports a failure to forget', async () => {
    jest
      .spyOn(milestones, 'clearAbove')
      .mockResolvedValue(err(storageError('milestones.clear-failed')))

    expect(
      expectErr(await acknowledgeMilestones(milestones, at(600_000), at(400_000))),
    ).toMatchObject({ messageKey: 'milestones.clear-failed' })
  })
})

describe('reading the position', () => {
  let repositories: Repositories

  beforeEach(() => {
    repositories = createInMemoryRepositories(new FakeClock(TODAY), new CountingIdGenerator())
  })

  /** A goal of {@link TARGET}. */
  async function storeGoal(target: number = TARGET): Promise<void> {
    expectOk(
      await repositories.goal.save({
        target: money(target),
        source: 'calculated',
        levelKey: 'cautious',
        coverageMonths: 9,
        desiredCompletionDate: null,
      }),
    )
  }

  // Before setup there is no target, so nothing to measure a milestone against. Null rather
  // than a failure: a fund with no goal is a state, not an error.
  it('has no position without a goal', async () => {
    expect(expectOk(await readProgress(repositories, calendarDate(TODAY)))).toBeNull()
  })

  // The balance Home shows, so the milestone and the screen agree: an entry dated after
  // today is not in it (FR-033).
  it('measures the balance as of today against the target', async () => {
    await storeGoal()
    expectOk(await repositories.ledger.add(contribution(300_000, '2026-10-01')))
    expectOk(await repositories.ledger.add(contribution(500_000, '2026-10-20')))

    expect(expectOk(await readProgress(repositories, calendarDate(TODAY)))).toEqual(at(300_000))
  })

  it('reports a goal that cannot be read', async () => {
    jest.spyOn(repositories.goal, 'get').mockResolvedValue(err(storageError('goal.read-failed')))

    expect(expectErr(await readProgress(repositories, calendarDate(TODAY)))).toMatchObject({
      messageKey: 'goal.read-failed',
    })
  })

  it('reports a ledger that cannot be read', async () => {
    await storeGoal()
    jest
      .spyOn(repositories.ledger, 'list')
      .mockResolvedValue(err(storageError('ledger.list-failed')))

    expect(expectErr(await readProgress(repositories, calendarDate(TODAY)))).toMatchObject({
      messageKey: 'ledger.list-failed',
    })
  })

  // A raised target moves the fund back below a threshold with no entry written, so the
  // save path never sees it. A revision has to forget too (data-model, state transitions),
  // or a fund raised from 60% to 30% would pass 50% again in silence.
  it('forgets, after a revision, the milestones now above the fund', async () => {
    await storeGoal()
    expectOk(await repositories.ledger.add(contribution(600_000, '2026-10-01')))
    for (const threshold of [25, 50] as const) {
      expectOk(await repositories.milestones.acknowledge(threshold))
    }
    await storeGoal(2_000_000)

    expectOk(await forgetMilestonesAbove(repositories, calendarDate(TODAY)))

    expect(expectOk(await repositories.milestones.listAcknowledged())).toEqual([25])
  })

  it('forgets nothing when there is no goal to measure against', async () => {
    expectOk(await repositories.milestones.acknowledge(25))

    expectOk(await forgetMilestonesAbove(repositories, calendarDate(TODAY)))

    expect(expectOk(await repositories.milestones.listAcknowledged())).toEqual([25])
  })

  it('reports a position that cannot be read rather than forgetting on a guess', async () => {
    jest.spyOn(repositories.goal, 'get').mockResolvedValue(err(storageError('goal.read-failed')))

    expect(expectErr(await forgetMilestonesAbove(repositories, calendarDate(TODAY)))).toMatchObject(
      { messageKey: 'goal.read-failed' },
    )
  })
})
