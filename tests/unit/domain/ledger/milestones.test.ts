import { crossedMilestones } from '@/domain/ledger/milestones'
import { summarizeProgress } from '@/domain/ledger/progress'
import type { ProgressSummary } from '@/domain/ledger/types'
import { money } from '@/domain/money/money'

/**
 * Which milestones a change in the fund passes on the way up (FR-024).
 *
 * Measured on `percentComplete`, the figure Home shows, so a milestone is acknowledged at
 * the moment the screen first reads 25%, and not a centavo before or after. `percentOf`
 * already keeps that figure from reading 100 below the target (AP-012), which is what
 * makes the 100% milestone safe to read from it.
 *
 * Target 10 000,00 throughout unless a case says otherwise, so 2 500,00 is 25%.
 */
const TARGET = 1_000_000

/** The position at a balance, against {@link TARGET} unless another target is given. */
function at(balance: number, target: number = TARGET): ProgressSummary {
  return summarizeProgress(money(balance), money(target))
}

describe('crossedMilestones', () => {
  it('reports the milestone a change passes', () => {
    expect(crossedMilestones(at(200_000), at(300_000))).toEqual([25])
  })

  // One large contribution can pass several. All are reported, lowest first, so the
  // caller can record each and say the highest.
  it('reports every milestone a single change passes, ascending', () => {
    expect(crossedMilestones(at(200_000), at(800_000))).toEqual([25, 50, 75])
  })

  // Reaching a threshold exactly is crossing it.
  it('counts landing exactly on a threshold', () => {
    expect(crossedMilestones(at(499_900), at(500_000))).toEqual([50])
  })

  // Already there before the change: nothing was crossed. Without this a contribution at
  // 60% would announce 50% again every time.
  it('does not report a milestone the fund had already reached', () => {
    expect(crossedMilestones(at(500_000), at(600_000))).toEqual([])
  })

  it('reports nothing for a change that stays between thresholds', () => {
    expect(crossedMilestones(at(300_000), at(400_000))).toEqual([])
  })

  // Going down passes thresholds too, in the wrong direction. Nothing to celebrate.
  it('reports nothing on the way down', () => {
    expect(crossedMilestones(at(600_000), at(400_000))).toEqual([])
  })

  // The re-crossing rule (data-model, milestone_ack): a fund that falls back below 50%
  // and recovers has crossed it again.
  it('reports a milestone crossed again after a withdrawal took the fund below it', () => {
    const beforeWithdrawal = at(600_000)
    const afterWithdrawal = at(400_000)
    const afterRecovery = at(550_000)

    expect(crossedMilestones(beforeWithdrawal, afterWithdrawal)).toEqual([])
    expect(crossedMilestones(afterWithdrawal, afterRecovery)).toEqual([50])
  })

  // A raised target moves the fund back below a threshold without a centavo leaving it.
  // 6 000,00 is 60% of 10 000,00 and 30% of 20 000,00; saving to 11 000,00 crosses 50%
  // of the new target.
  it('reports a milestone crossed again after the target was raised', () => {
    const beforeRevision = at(600_000)
    const afterRevision = at(600_000, 2_000_000)
    const afterSaving = at(1_100_000, 2_000_000)

    expect(crossedMilestones(beforeRevision, afterRevision)).toEqual([])
    expect(crossedMilestones(afterRevision, afterSaving)).toEqual([50])
  })

  // AP-012's case. One centavo short of 12 000,00 shows 99,99%, not 100% — the goal is not
  // reached (FR-015), and the 100% milestone must not say it is.
  it('reports 100% only when the target is met', () => {
    const target = 1_200_000

    expect(crossedMilestones(at(1_100_000, target), at(1_199_999, target))).toEqual([])
    expect(crossedMilestones(at(1_199_999, target), at(1_200_000, target))).toEqual([100])
  })

  // Past the target, progress stays at 100: a surplus is not a new milestone.
  it('reports nothing for saving beyond the target', () => {
    expect(crossedMilestones(at(1_000_000), at(1_300_000))).toEqual([])
  })

  // An overdrawn fund shows no progress rather than a negative share, and climbing out of
  // it crosses from there.
  it('crosses from an overdrawn fund', () => {
    expect(crossedMilestones(at(-100_000), at(300_000))).toEqual([25])
  })
})
