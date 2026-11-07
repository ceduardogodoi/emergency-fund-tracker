import { useRouter } from 'expo-router'
import type { ReactNode } from 'react'

import { useServices } from '@/runtime/services-context'
import { EntryDate } from '@/features/entries/entry-date'
import { ReasonPicker } from '@/features/entries/reason-picker'
import { useWithdrawalDraft } from '@/features/entries/use-withdrawal-draft'
import { WithdrawConfirm } from '@/features/entries/withdraw-confirm'
import { leaveScreen } from '@/features/navigation/leave-screen'
import { Button, MoneyInput, Screen, Text } from '@/ui/primitives'
import { strings } from '@/ui/strings'

/**
 * Recording a withdrawal (FR-016, FR-017): how much, why, and when.
 *
 * Laid out as the contribute screen is, with the reason where a contribution has its note:
 * it is required here, and it is the thing a user reading the history later will want to
 * know. One larger than the balance is asked about before it is recorded.
 *
 * @returns The rendered screen
 */
export default function WithdrawScreen(): ReactNode {
  const router = useRouter()
  const { format } = useServices()
  const draft = useWithdrawalDraft(() => {
    leaveScreen(router)
  })

  return (
    <Screen title={strings.withdrawal.title}>
      <MoneyInput
        label={strings.entries.amountLabel}
        value={draft.amount}
        onChangeValue={draft.changeAmount}
        format={format.money}
        help={strings.withdrawal.amountHelp}
        error={draft.amountError}
        required
        testID="amount-input"
      />
      <ReasonPicker reason={draft.reason} onChange={draft.changeReason} error={draft.reasonError} />
      <EntryDate draft={draft} otherExplanation={strings.withdrawal.otherDateExplanation} />
      <Button
        label={strings.withdrawal.saveAction}
        onPress={draft.save}
        disabled={draft.isSaving}
        testID="save-entry"
      />
      {/* Storage failed, rather than a value being refused. The draft stays on screen, so
          nothing the user typed is lost. */}
      {draft.hasFailed ? <Text tone="negative">{strings.state.errorBody}</Text> : null}
      <WithdrawConfirm
        overBalance={draft.overBalance}
        onConfirm={draft.confirmOverBalance}
        onCancel={draft.cancelOverBalance}
      />
    </Screen>
  )
}
