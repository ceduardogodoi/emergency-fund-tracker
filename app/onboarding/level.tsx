import { useLocalSearchParams, useRouter } from 'expo-router'
import type { ReactNode } from 'react'

import { validateMonthlyExpenses } from '@/domain/goal/validation'
import type { Money } from '@/domain/money/money'
import { isErr } from '@/domain/result'
import { LevelOptions } from '@/features/goal/level-options'
import { TargetPreview } from '@/features/goal/target-preview'
import { firstGoalDraft, useGoalDraft } from '@/features/goal/use-goal-draft'
import { Button, Screen, Text } from '@/ui/primitives'
import { strings } from '@/ui/strings'

/**
 * Step two of setup: how many months of expenses the fund should cover (FR-002).
 *
 * This is where the whole flow is written, in one transaction — the expenses figure it was
 * handed and the goal derived from it. Splitting the two writes across the two screens
 * would let a user abandon setup halfway and return to a fund that knows what they spend
 * and not what they are saving for.
 *
 * @returns The rendered screen
 */
export default function LevelScreen(): ReactNode {
  const { expenses } = useLocalSearchParams<{ expenses?: string }>()
  const monthlyExpenses = parseExpenses(expenses)

  // The form is a separate component so its hooks are never conditional: reached without
  // the figure, this screen has nothing to render a form about.
  return monthlyExpenses === null ? (
    <MissingExpenses />
  ) : (
    <LevelForm monthlyExpenses={monthlyExpenses} />
  )
}

/** Props for {@link LevelForm}. */
interface LevelFormProps {
  readonly monthlyExpenses: Money
}

/** The choice itself, once there is a figure to multiply. */
function LevelForm({ monthlyExpenses }: LevelFormProps): ReactNode {
  const router = useRouter()
  const draft = useGoalDraft(firstGoalDraft(monthlyExpenses), () => {
    router.replace('/')
  })

  return (
    <Screen title={strings.onboarding.levelTitle}>
      <Text tone="secondary">{strings.onboarding.levelIntro}</Text>
      <LevelOptions
        selected={draft.levelKey}
        onSelect={draft.selectLevel}
        customMonths={draft.customMonths}
        onCustomMonthsChange={draft.changeCustomMonths}
        error={draft.coverageError}
      />
      {draft.target === null ? null : (
        <TargetPreview
          monthlyExpenses={monthlyExpenses}
          coverageMonths={draft.coverageMonths}
          target={draft.target}
          override={draft.override}
          onOverrideChange={draft.changeOverride}
          error={draft.targetError}
        />
      )}
      <Button
        label={strings.action.save}
        onPress={draft.save}
        disabled={draft.isSaving}
        testID="save-goal"
      />
      {/* Storage failed, rather than a figure being refused. The copy says what to do and
          the draft stays on screen, so nothing the user chose is lost. */}
      {draft.hasFailed ? <Text tone="negative">{strings.state.errorBody}</Text> : null}
    </Screen>
  )
}

/** What the screen shows when it was reached without the figure step one produces. */
function MissingExpenses(): ReactNode {
  const router = useRouter()
  return (
    <Screen title={strings.onboarding.levelTitle}>
      <Text tone="secondary">{strings.onboarding.missingExpenses}</Text>
      <Button
        label={strings.home.emptyAction}
        onPress={() => {
          router.replace('/onboarding/expenses')
        }}
      />
    </Screen>
  )
}

/**
 * Reads the expenses figure out of the route.
 *
 * Route parameters are strings from an untrusted source — a deep link, or a link the user
 * kept — so the figure is validated by the same rule the field applied, not merely parsed.
 * Anything else is treated as absent: a target derived from a number nobody typed is worse
 * than asking for the number again.
 */
function parseExpenses(value: string | undefined): Money | null {
  if (value === undefined || !DIGITS.test(value)) {
    return null
  }
  const validated = validateMonthlyExpenses(Number.parseInt(value, 10))
  return isErr(validated) ? null : validated.value
}

/** Only digits: a sign, a separator, or an exponent is not a figure this screen produced. */
const DIGITS = /^\d+$/
