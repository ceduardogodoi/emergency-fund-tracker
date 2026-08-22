import { calendarDate } from '@/domain/dates/calendar-date'
import { notFoundError } from '@/domain/errors/app-error'
import type { LedgerEntryInput } from '@/domain/ledger/types'
import { money } from '@/domain/money/money'
import { err, ok } from '@/domain/result'
import {
  CountingIdGenerator,
  createInMemoryRepositories,
  FakeClock,
  uuidShaped,
} from '@tests/support/doubles'

/**
 * Test doubles are infrastructure, but a wrong one produces confident green tests about
 * behaviour the app does not have. Only the parts with a decision in them are covered
 * here — the null-versus-absent edit, the ledger's ordering, and the milestone re-crossing
 * rule. Trivial getters are left to the suites that use them.
 */
describe('test doubles', () => {
  describe('FakeClock', () => {
    it('reports the day it was given, with a midday instant that cannot shift it', () => {
      const clock = new FakeClock('2026-03-01')

      expect({ today: clock.today(), now: clock.now(), zone: clock.timeZone() }).toEqual({
        today: '2026-03-01',
        now: '2026-03-01T12:00:00.000Z',
        zone: 'UTC',
      })
    })

    it('moves both the day and the instant together', () => {
      const clock = new FakeClock('2026-03-01')

      clock.setToday('2026-04-15')

      expect({ today: clock.today(), now: clock.now() }).toEqual({
        today: '2026-04-15',
        now: '2026-04-15T12:00:00.000Z',
      })
    })

    it('advances the instant alone, so same-day writes stay distinguishable', () => {
      const clock = new FakeClock('2026-03-01')

      clock.setNow('2026-03-01T18:30:00.000Z')

      expect({ today: clock.today(), now: clock.now() }).toEqual({
        today: '2026-03-01',
        now: '2026-03-01T18:30:00.000Z',
      })
    })
  })

  describe('CountingIdGenerator', () => {
    it('issues a readable sequence a test can name outright', () => {
      const ids = new CountingIdGenerator()

      expect([ids.uuid(), ids.uuid(), ids.count]).toEqual(['id-1', 'id-2', 2])
    })

    it('issues well-formed v4 identifiers when the shape has to look real', () => {
      const ids = new CountingIdGenerator(uuidShaped)

      expect(ids.uuid()).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      )
    })
  })

  describe('in-memory ledger', () => {
    const contribution: LedgerEntryInput = {
      type: 'contribution',
      amount: money(50_000),
      date: calendarDate('2026-03-10'),
      note: 'March',
      withdrawalReason: null,
    }

    /** A fresh repository set on a fixed clock, so ids and timestamps are predictable. */
    function build() {
      const clock = new FakeClock('2026-03-20')
      return { clock, repos: createInMemoryRepositories(clock, new CountingIdGenerator()) }
    }

    it('stamps id and audit fields from the injected sources, not the caller', async () => {
      const { repos } = build()

      const result = await repos.ledger.add(contribution)

      expect(result).toEqual(
        ok({
          ...contribution,
          id: 'id-1',
          createdAt: '2026-03-20T12:00:00.000Z',
          updatedAt: '2026-03-20T12:00:00.000Z',
        }),
      )
    })

    it('orders by date, then by creation so one day keeps its insertion order', async () => {
      const { repos } = build()
      await repos.ledger.add({ ...contribution, date: calendarDate('2026-03-10'), note: 'second' })
      await repos.ledger.add({ ...contribution, date: calendarDate('2026-03-01'), note: 'first' })
      await repos.ledger.add({ ...contribution, date: calendarDate('2026-03-10'), note: 'third' })

      const listed = await repos.ledger.list()

      expect(listed.ok && listed.value.map((entry) => entry.note)).toEqual([
        'first',
        'second',
        'third',
      ])
    })

    it('scopes a range with both bounds inclusive', async () => {
      const { repos } = build()
      await repos.ledger.add({ ...contribution, date: calendarDate('2026-02-28'), note: 'before' })
      await repos.ledger.add({ ...contribution, date: calendarDate('2026-03-01'), note: 'from' })
      await repos.ledger.add({ ...contribution, date: calendarDate('2026-03-31'), note: 'to' })
      await repos.ledger.add({ ...contribution, date: calendarDate('2026-04-01'), note: 'after' })

      const listed = await repos.ledger.list({
        from: calendarDate('2026-03-01'),
        to: calendarDate('2026-03-31'),
      })

      expect(listed.ok && listed.value.map((entry) => entry.note)).toEqual(['from', 'to'])
    })

    it('surfaces only entries dated after today (FR-033)', async () => {
      const { repos } = build()
      await repos.ledger.add({ ...contribution, date: calendarDate('2026-03-20'), note: 'today' })
      await repos.ledger.add({ ...contribution, date: calendarDate('2026-03-21'), note: 'future' })

      const listed = await repos.ledger.listFutureDated(calendarDate('2026-03-20'))

      expect(listed.ok && listed.value.map((entry) => entry.note)).toEqual(['future'])
    })

    it('leaves a field alone when the patch omits it', async () => {
      const { repos, clock } = build()
      await repos.ledger.add(contribution)
      clock.setNow('2026-03-21T09:00:00.000Z')

      const updated = await repos.ledger.update('id-1', { amount: money(75_000) })

      expect(updated).toEqual(
        ok({
          ...contribution,
          amount: money(75_000),
          id: 'id-1',
          createdAt: '2026-03-20T12:00:00.000Z',
          updatedAt: '2026-03-21T09:00:00.000Z',
        }),
      )
    })

    it('clears a note when the patch sets it to null, rather than treating that as absent', async () => {
      const { repos } = build()
      await repos.ledger.add(contribution)

      const updated = await repos.ledger.update('id-1', { note: null })

      expect(updated.ok && updated.value.note).toBeNull()
    })

    it('reports a not-found failure for an unknown id rather than a silent no-op', async () => {
      const { repos } = build()

      const updated = await repos.ledger.update('missing', { note: null })

      expect(updated).toEqual(err(notFoundError('ledger-entry')))
    })

    it('reports a not-found failure when removing an unknown id', async () => {
      const { repos } = build()

      expect(await repos.ledger.remove('missing')).toEqual(err(notFoundError('ledger-entry')))
    })

    it('removes the entry it was asked for', async () => {
      const { repos } = build()
      await repos.ledger.add(contribution)

      await repos.ledger.remove('id-1')

      expect(await repos.ledger.getById('id-1')).toEqual(ok(null))
    })
  })

  describe('in-memory milestones', () => {
    /** A repository set whose clock and ids are irrelevant to milestones. */
    function build() {
      return createInMemoryRepositories(new FakeClock(), new CountingIdGenerator())
    }

    it('lists acknowledgements ascending', async () => {
      const repos = build()
      await repos.milestones.acknowledge(75)
      await repos.milestones.acknowledge(25)

      expect(await repos.milestones.listAcknowledged()).toEqual(ok([25, 75]))
    })

    it('forgets thresholds above the balance, so a recovery announces them again', async () => {
      const repos = build()
      await repos.milestones.acknowledge(25)
      await repos.milestones.acknowledge(50)
      await repos.milestones.acknowledge(75)

      await repos.milestones.clearAbove(50)

      expect(await repos.milestones.listAcknowledged()).toEqual(ok([25, 50]))
    })
  })

  describe('in-memory goal', () => {
    it('preserves the original creation instant across a revision', async () => {
      const clock = new FakeClock('2026-03-01')
      const repos = createInMemoryRepositories(clock, new CountingIdGenerator())
      const input = {
        target: money(1_200_000),
        source: 'calculated',
        levelKey: 'balanced',
        coverageMonths: 6,
        desiredCompletionDate: null,
      } as const
      await repos.goal.save(input)
      clock.setToday('2026-06-01')

      const revised = await repos.goal.save({ ...input, coverageMonths: 9 })

      expect(revised).toEqual(
        ok({
          ...input,
          coverageMonths: 9,
          createdAt: '2026-03-01T12:00:00.000Z',
          updatedAt: '2026-06-01T12:00:00.000Z',
        }),
      )
    })

    it('keeps revisions in the order they happened, oldest first', async () => {
      const repos = createInMemoryRepositories(new FakeClock(), new CountingIdGenerator())
      const change = {
        previousTarget: money(1_200_000),
        newTarget: money(1_800_000),
        previousExpenses: money(200_000),
        newExpenses: money(300_000),
        previousCoverageMonths: 6,
        newCoverageMonths: 6,
      }
      await repos.goal.recordChange(change)
      await repos.goal.recordChange({ ...change, newTarget: money(2_400_000) })

      const changes = await repos.goal.listChanges()

      expect(changes.ok && changes.value.map((entry) => entry.id)).toEqual(['id-1', 'id-2'])
    })
  })
})
