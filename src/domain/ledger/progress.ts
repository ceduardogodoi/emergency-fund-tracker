import { maxOf, subtract, zero, type Money } from '../money/money'
import { percentOf } from '../money/rounding'
import type { ProgressSummary } from './types'

/**
 * How far the fund has got, as Home reports it (FR-013) and as "reached" is defined (FR-015).
 *
 * Computed in one place so every screen states the same thing. The invariant worth naming:
 * `remaining` and `surplus` are never both non-zero, and `remaining` is never negative —
 * FR-015 forbids showing one, and a summary that could produce it would leave every screen
 * to remember to clamp. At exactly the target both are zero and the goal is reached.
 *
 * `percentComplete` is for display only. It is the one figure here derived by division, and
 * `percentOf` clamps it to 0–100 so a surplus renders as a reached goal rather than 130%,
 * and a negative balance as no progress rather than a negative share.
 *
 * @param balance The current balance, which may be negative after a withdrawal.
 * @param target The goal's target, always above zero.
 * @returns Every figure a screen needs to describe the position.
 */
export function summarizeProgress(balance: Money, target: Money): ProgressSummary {
  return {
    balance,
    target,
    remaining: maxOf(subtract(target, balance), zero),
    surplus: maxOf(subtract(balance, target), zero),
    percentComplete: percentOf(balance, target),
    isReached: balance >= target,
  }
}
