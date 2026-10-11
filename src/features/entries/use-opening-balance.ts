import { useState } from 'react'

import { useServices } from '@/runtime/services-context'
import { money, type Money } from '@/domain/money/money'
import { validationMessage } from '@/ui/strings'
import { useAddEntry } from './hooks'

/** The opening balance being entered, and everything a screen needs to render or record it. */
export interface OpeningBalanceState {
  readonly amount: Money
  /**
   * Why the amount was not recorded, in words — a figure the rules refuse, or a second
   * opening balance. Undefined when there is nothing to correct.
   */
  readonly amountError: string | undefined
  /** Whether the submission is in flight, for the save control's own pending state. */
  readonly isSaving: boolean
  /** Whether the last submission failed in storage, as opposed to being refused. */
  readonly hasFailed: boolean
  readonly changeAmount: (value: Money) => void
  /** Submits the amount. A refusal arrives as {@link OpeningBalanceState.amountError}. */
  readonly save: () => void
}

/**
 * The state behind recording what was saved before the app was (FR-010).
 *
 * An opening balance is a ledger entry like any other, dated the day of setup and carrying
 * no note. Unlike the contribution draft, nothing is checked here before it is sent:
 * `recordEntry` applies every rule on the way to storage, and one of them — that no opening
 * balance exists yet — only it can answer. With a single field there is nowhere else a
 * refusal could point, so the mutation's own error is the form's.
 *
 * @param onSaved Called once the write has landed — where the screen navigates.
 * @returns The amount, its message, and the operations that change or record it.
 */
export function useOpeningBalance(onSaved: () => void): OpeningBalanceState {
  const { clock } = useServices()
  const add = useAddEntry()
  const [amount, setAmount] = useState<Money>(money(0))

  // A refusal has something to say about the amount; a storage failure does not, and the
  // advice there is to try again.
  const refused = add.error?.kind === 'validation' ? add.error : null

  return {
    amount,
    amountError: refused === null ? undefined : validationMessage(refused),
    isSaving: add.isPending,
    hasFailed: add.isError && refused === null,
    changeAmount: (value) => {
      setAmount(value)
      // The mutation keeps its last error until told otherwise, and a message about an
      // amount the user has since changed is a message about nothing on the screen.
      add.reset()
    },
    save: () => {
      add.mutate(
        { type: 'opening', amount, date: clock.today(), note: null, withdrawalReason: null },
        { onSuccess: onSaved },
      )
    },
  }
}
