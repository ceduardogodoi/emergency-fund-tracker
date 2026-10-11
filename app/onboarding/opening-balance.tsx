import { useRouter } from 'expo-router'
import type { ReactNode } from 'react'

import { useServices } from '@/runtime/services-context'
import { useOpeningBalance } from '@/features/entries/use-opening-balance'
import { Button, MoneyInput, Screen, Text } from '@/ui/primitives'
import { strings } from '@/ui/strings'

/**
 * Step three of setup: what was saved before the app was (FR-010).
 *
 * Optional, and the last thing asked. The goal is already stored when this opens, so
 * leaving here — by the second button, or by closing the app — leaves a fund that works and
 * starts at zero. Both ways out replace this route with Home rather than pushing it: there
 * is nothing behind this screen worth returning to, and coming back to it after saving
 * would offer a second opening balance the ledger refuses.
 *
 * @returns The rendered screen
 */
export default function OpeningBalanceScreen(): ReactNode {
  const router = useRouter()
  const { format } = useServices()
  const finish = (): void => {
    router.replace('/')
  }
  const opening = useOpeningBalance(finish)

  return (
    <Screen title={strings.onboarding.openingTitle}>
      <Text tone="secondary">{strings.onboarding.openingIntro}</Text>
      <MoneyInput
        label={strings.onboarding.openingLabel}
        value={opening.amount}
        onChangeValue={opening.changeAmount}
        format={format.money}
        help={strings.onboarding.openingHelp}
        error={opening.amountError}
        testID="opening-input"
      />
      <Button
        label={strings.action.save}
        onPress={opening.save}
        disabled={opening.isSaving}
        testID="save-opening"
      />
      {/* A slab, not a second accent: the screen asks for the amount, and this is the way
          past it. Not marked required above for the same reason. */}
      <Button
        label={strings.onboarding.openingSkip}
        variant="secondary"
        onPress={finish}
        testID="skip-opening"
      />
      {/* Storage failed, rather than the amount being refused. The amount stays on screen,
          so nothing the user typed is lost. */}
      {opening.hasFailed ? <Text tone="negative">{strings.state.errorBody}</Text> : null}
    </Screen>
  )
}
