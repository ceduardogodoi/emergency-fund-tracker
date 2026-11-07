import { isWithdrawalReasonKey } from '@/domain/ledger/withdrawal'
import { strings } from './strings'

/**
 * A stored withdrawal reason as a reader sees it (FR-016).
 *
 * A predefined reason is stored as its key, which is not something to show anyone, so it
 * reads as its label; a reason the user wrote reads as they wrote it.
 *
 * @param reason The reason as stored.
 * @returns The text to show.
 */
export function withdrawalReasonText(reason: string): string {
  return isWithdrawalReasonKey(reason) ? strings.withdrawal.reasons[reason].label : reason
}
