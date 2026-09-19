import { summarizeProgress } from '@/domain/ledger/progress'
import { money, zero } from '@/domain/money/money'

/**
 * What Home reports (FR-013) and what "reached" means (FR-015).
 *
 * The invariant worth stating once: `remaining` and `surplus` are never both non-zero, and
 * `remaining` is never negative. FR-015 forbids showing a negative remaining, and a
 * summary that could produce one would leave every screen to remember to clamp it.
 */
const TARGET = money(1_200_000)

describe('summarizeProgress', () => {
  it('reports the distance to a target nothing has been saved towards', () => {
    expect(summarizeProgress(zero, TARGET)).toEqual({
      balance: zero,
      target: TARGET,
      remaining: TARGET,
      surplus: zero,
      percentComplete: 0,
      isReached: false,
    })
  })

  it('reports what is left part of the way there', () => {
    const summary = summarizeProgress(money(300_000), TARGET)

    expect(summary.remaining).toBe(money(900_000))
    expect(summary.surplus).toBe(zero)
    expect(summary.percentComplete).toBe(25)
    expect(summary.isReached).toBe(false)
  })

  // The boundary FR-015 turns on. Exactly the target is reached, with nothing remaining and
  // no surplus — the one case where both figures are legitimately zero.
  it('counts exactly the target as reached, with neither remaining nor surplus', () => {
    const summary = summarizeProgress(TARGET, TARGET)

    expect(summary.remaining).toBe(zero)
    expect(summary.surplus).toBe(zero)
    expect(summary.percentComplete).toBe(100)
    expect(summary.isReached).toBe(true)
  })

  // FR-015: past the target the extra is stated as a surplus, and remaining stays at zero
  // rather than going negative.
  it('states the surplus past the target, and never a negative remaining', () => {
    const summary = summarizeProgress(money(1_500_000), TARGET)

    expect(summary.remaining).toBe(zero)
    expect(summary.surplus).toBe(money(300_000))
    expect(summary.isReached).toBe(true)
  })

  // Clamped for display: a fund at 125% is a reached goal with a surplus, and a progress
  // bar drawn from an unclamped figure would overflow its own track.
  it('clamps the percentage at a hundred rather than reporting more', () => {
    expect(summarizeProgress(money(1_500_000), TARGET).percentComplete).toBe(100)
  })

  // A withdrawal can take the balance below zero. Progress towards the target is then none
  // of it, not a negative share of it.
  it('reports no progress from a negative balance, and the whole target remaining', () => {
    const summary = summarizeProgress(money(-50_000), TARGET)

    expect(summary.percentComplete).toBe(0)
    expect(summary.remaining).toBe(money(1_250_000))
    expect(summary.surplus).toBe(zero)
    expect(summary.isReached).toBe(false)
  })

  // Two decimals, because the spec's own example is 4.17% — enough to see a single
  // contribution move the figure, without implying precision the fund does not have.
  it('rounds the percentage to two decimals', () => {
    expect(summarizeProgress(money(50_000), money(1_200_000)).percentComplete).toBe(4.17)
  })
})
