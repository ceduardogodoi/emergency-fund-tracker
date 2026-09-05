import { useRouter } from 'expo-router'
import { useState, type ReactNode } from 'react'

import { useServices } from '@/app/services-context'
import { validateMonthlyExpenses } from '@/domain/goal/validation'
import { money, type Money } from '@/domain/money/money'
import { isErr } from '@/domain/result'
import { Button, MoneyInput, Screen } from '@/ui/primitives'
import { strings, validationMessage } from '@/ui/strings'

/**
 * Step one of setup: the figure everything else is derived from (FR-001).
 *
 * Nothing is written here. The profile and the goal are saved together at the end of the
 * flow, in one transaction, because a profile stored on its own would describe expenses no
 * target derives from — and a user who closes the app on the next screen would come back
 * to a fund that knows what they spend and not what they are saving for.
 *
 * So the amount travels to step two in the route rather than in storage. That also makes
 * the back gesture behave: returning here shows the field again, not a figure already
 * committed somewhere.
 *
 * @returns The rendered screen
 */
export default function ExpensesScreen(): ReactNode {
  const router = useRouter()
  const { format } = useServices()
  const [amount, setAmount] = useState<Money>(money(0))
  const [error, setError] = useState<string | undefined>(undefined)

  const handleChange = (value: Money): void => {
    setAmount(value)
    // Cleared on edit rather than re-validated on every keystroke: a message that appears
    // while someone is still typing the first digit is telling them they are wrong before
    // they have finished being right.
    setError(undefined)
  }

  const handleContinue = (): void => {
    const validated = validateMonthlyExpenses(amount)
    if (isErr(validated)) {
      setError(validationMessage(validated.error))
      return
    }
    router.push({
      pathname: '/onboarding/level',
      params: { expenses: String(validated.value) },
    })
  }

  return (
    <Screen title={strings.onboarding.expensesTitle}>
      <MoneyInput
        label={strings.onboarding.expensesLabel}
        value={amount}
        onChangeValue={handleChange}
        format={format.money}
        help={strings.onboarding.expensesHelp}
        error={error}
        required
        testID="expenses-input"
      />
      <Button label={strings.action.continue} onPress={handleContinue} />
    </Screen>
  )
}
