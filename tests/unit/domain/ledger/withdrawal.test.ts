import { calendarDate } from '@/domain/dates/calendar-date'
import { overBalanceError } from '@/domain/errors/app-error'
import { validateEntry } from '@/domain/ledger/entry'
import { recordEntry } from '@/domain/ledger/record-entry'
import type { EntryType, LedgerEntryInput } from '@/domain/ledger/types'
import {
  MAXIMUM_REASON_LENGTH,
  WITHDRAWAL_REASONS,
  assessWithdrawal,
  isWithdrawalReasonKey,
} from '@/domain/ledger/withdrawal'
import { money } from '@/domain/money/money'
import type { Repositories } from '@/domain/ports/repositories'
import { CountingIdGenerator, FakeClock, createInMemoryRepositories } from '@tests/support/doubles'
import { expectErr, expectOk } from '@tests/support/expect-result'

/**
 * Withdrawals (FR-016, FR-017): a withdrawal says why it was made, and one larger than the
 * balance is recorded only once the user has confirmed it.
 */
const TODAY = calendarDate('2026-10-01')
const CONTEXT = { today: TODAY, hasOpening: false }

/** A withdrawal of R$ 300,00 for a predefined reason, unless told otherwise. */
function withdrawal(overrides: Partial<LedgerEntryInput> = {}): LedgerEntryInput {
  return {
    type: 'withdrawal',
    amount: money(30_000),
    date: calendarDate('2026-09-20'),
    note: null,
    withdrawalReason: 'car-repair',
    ...overrides,
  }
}

describe('the predefined reasons', () => {
  // The export contract's own example stores `car-repair`, so that key is fixed; the rest
  // were chosen with the user on 2026-11-01.
  it('are the five agreed, as stable keys', () => {
    expect(WITHDRAWAL_REASONS).toEqual([
      'medical',
      'car-repair',
      'home-repair',
      'income-loss',
      'family',
    ])
  })

  it('are told apart from a reason the user wrote', () => {
    expect(isWithdrawalReasonKey('car-repair')).toBe(true)
    expect(isWithdrawalReasonKey('Conserto do carro')).toBe(false)
    // A key is matched whole, not by case or by a prefix.
    expect(isWithdrawalReasonKey('Car-repair')).toBe(false)
    expect(isWithdrawalReasonKey('car')).toBe(false)
  })
})

describe('validateEntry, for the reason (FR-016)', () => {
  it('accepts a predefined reason', () => {
    expectOk(validateEntry(withdrawal(), CONTEXT))
  })

  it('accepts a reason the user wrote', () => {
    expectOk(validateEntry(withdrawal({ withdrawalReason: 'Dentista' }), CONTEXT))
  })

  it('refuses a withdrawal with no reason, naming the reason', () => {
    expect(expectErr(validateEntry(withdrawal({ withdrawalReason: null }), CONTEXT))).toEqual({
      kind: 'validation',
      field: 'reason',
      messageKey: 'entry.reason-required',
    })
  })

  // Spaces would show in the history as a reason with nothing in it.
  it('refuses a reason that is only whitespace', () => {
    expect(
      expectErr(validateEntry(withdrawal({ withdrawalReason: '   ' }), CONTEXT)),
    ).toMatchObject({ field: 'reason', messageKey: 'entry.reason-required' })
  })

  it('accepts a reason at the limit and refuses one past it', () => {
    expectOk(
      validateEntry(withdrawal({ withdrawalReason: 'a'.repeat(MAXIMUM_REASON_LENGTH) }), CONTEXT),
    )
    expect(
      expectErr(
        validateEntry(
          withdrawal({ withdrawalReason: 'a'.repeat(MAXIMUM_REASON_LENGTH + 1) }),
          CONTEXT,
        ),
      ),
    ).toMatchObject({ field: 'reason', messageKey: 'entry.reason-too-long' })
  })

  // The schema refuses it too, with a CHECK; this is the refusal an import can report.
  it.each<EntryType>(['contribution', 'opening'])('refuses a reason on %s', (type) => {
    expect(
      expectErr(validateEntry(withdrawal({ type, withdrawalReason: 'Dentista' }), CONTEXT)),
    ).toMatchObject({ field: 'reason', messageKey: 'entry.reason-not-allowed' })
  })

  // In the order the user would correct them: the amount first, as for every entry.
  it('reports an amount of zero before a missing reason', () => {
    expect(
      expectErr(validateEntry(withdrawal({ amount: money(0), withdrawalReason: null }), CONTEXT)),
    ).toMatchObject({ field: 'amount' })
  })
})

describe('assessWithdrawal (FR-017)', () => {
  it('lets through a withdrawal smaller than the balance', () => {
    expectOk(assessWithdrawal(money(30_000), money(500_000)))
  })

  // Emptying the fund is not overdrawing it.
  it('lets through a withdrawal of exactly the balance', () => {
    expectOk(assessWithdrawal(money(500_000), money(500_000)))
  })

  // Spec, Story 5 scenario 2: a balance of 5,000 and a withdrawal of 6,000.
  it('refuses one larger than the balance, saying the balance and how far below zero it leaves the fund', () => {
    expect(expectErr(assessWithdrawal(money(600_000), money(500_000)))).toEqual({
      kind: 'over-balance',
      balance: 500_000,
      belowZeroBy: 100_000,
    })
  })

  // A fund already overdrawn is overdrawn further by any withdrawal at all.
  it('counts from a balance already below zero', () => {
    expect(expectErr(assessWithdrawal(money(10_000), money(-50_000)))).toEqual(
      overBalanceError(money(-50_000), money(60_000)),
    )
  })
})

describe('recordEntry, for a withdrawal larger than the balance (FR-017)', () => {
  let repositories: Repositories

  beforeEach(() => {
    repositories = createInMemoryRepositories(new FakeClock(TODAY), new CountingIdGenerator())
  })

  /** Stores a contribution directly, the way an earlier save would have. */
  async function contributed(minorUnits: number, date = '2026-09-05'): Promise<void> {
    expectOk(
      await repositories.ledger.add({
        type: 'contribution',
        amount: money(minorUnits),
        date: calendarDate(date),
        note: null,
        withdrawalReason: null,
      }),
    )
  }

  async function stored(): Promise<readonly unknown[]> {
    return expectOk(await repositories.ledger.list())
  }

  it('refuses it unconfirmed, with the balance it was measured against, and writes nothing', async () => {
    await contributed(500_000)

    const refused = await recordEntry(repositories, withdrawal({ amount: money(600_000) }), TODAY)

    expect(expectErr(refused)).toEqual({
      kind: 'over-balance',
      balance: 500_000,
      belowZeroBy: 100_000,
    })
    expect(await stored()).toHaveLength(1)
  })

  it('records it once confirmed', async () => {
    await contributed(500_000)

    expectOk(
      await recordEntry(repositories, withdrawal({ amount: money(600_000) }), TODAY, {
        overBalanceConfirmed: true,
      }),
    )

    expect(await stored()).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'withdrawal', amount: 600_000 })]),
    )
  })

  it('records a withdrawal within the balance without asking', async () => {
    await contributed(500_000)

    expectOk(await recordEntry(repositories, withdrawal({ amount: money(300_000) }), TODAY))

    expect(await stored()).toHaveLength(2)
  })

  // FR-033: money dated next week is not money the user has. Counted, the 300_000 here
  // would put the balance at 800_000 and let the withdrawal through.
  it('measures against the balance as of today, leaving out entries dated after it', async () => {
    await contributed(500_000)
    await contributed(300_000, '2026-10-10')

    expect(
      expectErr(await recordEntry(repositories, withdrawal({ amount: money(600_000) }), TODAY)),
    ).toMatchObject({ kind: 'over-balance', balance: 500_000 })
  })

  // The rules come first: a confirmation is about the amount, not a way past the reason.
  it('refuses a missing reason even when the overdraw is confirmed', async () => {
    expect(
      expectErr(
        await recordEntry(
          repositories,
          withdrawal({ amount: money(600_000), withdrawalReason: null }),
          TODAY,
          { overBalanceConfirmed: true },
        ),
      ),
    ).toMatchObject({ kind: 'validation', field: 'reason' })
    expect(await stored()).toHaveLength(0)
  })

  // A contribution never lowers the balance, so it is never asked about.
  it('records a contribution into an overdrawn fund without asking', async () => {
    expectOk(
      await repositories.ledger.add(withdrawal({ amount: money(50_000), withdrawalReason: 'x' })),
    )

    expectOk(
      await recordEntry(
        repositories,
        { ...withdrawal({ type: 'contribution', withdrawalReason: null }) },
        TODAY,
      ),
    )
  })
})
