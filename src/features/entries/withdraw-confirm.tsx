import type { ReactNode } from 'react'

import { useServices } from '@/runtime/services-context'
import type { OverBalanceError } from '@/domain/errors'
import { ConfirmSheet } from '@/ui/primitives'
import { strings } from '@/ui/strings'

/** Props for {@link WithdrawConfirm}. */
export interface WithdrawConfirmProps {
  /** The question to ask, or null when there is none and the sheet is closed. */
  readonly overBalance: OverBalanceError | null
  /** Records the withdrawal as it is. */
  readonly onConfirm: () => void
  /** Goes back to the form, with nothing recorded. */
  readonly onCancel: () => void
}

/**
 * The warning that a withdrawal is more than the fund holds, and the explicit yes it needs
 * before it is recorded (FR-017).
 *
 * Through `ConfirmSheet`, the one confirmation the app has, and in figures — the balance,
 * and how far below zero the withdrawal leaves it — so a typed extra zero is easy to tell
 * from an emergency that really was bigger than the fund. A balance below zero is allowed,
 * so this asks rather than forbids.
 *
 * @param props - See {@link WithdrawConfirmProps}
 * @returns The sheet, or nothing while there is no question
 */
export function WithdrawConfirm({
  overBalance,
  onConfirm,
  onCancel,
}: WithdrawConfirmProps): ReactNode {
  const { format } = useServices()
  if (overBalance === null) {
    return null
  }
  return (
    <ConfirmSheet
      open
      title={strings.withdrawal.overBalanceTitle}
      body={strings.withdrawal.overBalanceBody(
        format.money(overBalance.balance),
        format.money(overBalance.belowZeroBy),
      )}
      confirmLabel={strings.withdrawal.overBalanceConfirm}
      onConfirm={onConfirm}
      onCancel={onCancel}
      testID="over-balance-sheet"
    />
  )
}
