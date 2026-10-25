import { MILESTONE_THRESHOLDS, type MilestoneThreshold, type ProgressSummary } from './types'

/**
 * The milestones a change in the fund passes on the way up (FR-024).
 *
 * A threshold is crossed when the fund was below it before the change and is at or above
 * it after. Already there before means nothing was crossed, and going down crosses nothing
 * worth acknowledging — the re-crossing rule lives in the repository instead, which forgets
 * a threshold once the fund falls back below it so the next climb past it counts.
 *
 * Read from `percentComplete`, the figure Home shows, so the milestone and the screen agree
 * about when the fund reached 25%. That figure never reads 100 below the target —
 * `percentOf` caps a fund one centavo short at 99,99 (AP-012) — which is what makes the
 * 100% milestone safe to take from it.
 *
 * @param previous Where the fund stood before the change.
 * @param next Where it stands after.
 * @returns The thresholds crossed, ascending. Empty when none were.
 */
export function crossedMilestones(
  previous: ProgressSummary,
  next: ProgressSummary,
): readonly MilestoneThreshold[] {
  return MILESTONE_THRESHOLDS.filter(
    (threshold) => previous.percentComplete < threshold && next.percentComplete >= threshold,
  )
}
