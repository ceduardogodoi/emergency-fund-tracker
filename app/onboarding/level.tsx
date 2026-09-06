import { useLocalSearchParams, useRouter } from 'expo-router'
import type { ReactNode } from 'react'
import { StyleSheet, View, type ViewStyle } from 'react-native'

import { LEVELS, MAXIMUM_COVERAGE_MONTHS, MINIMUM_COVERAGE_MONTHS } from '@/domain/goal/levels'
import type { LevelKey } from '@/domain/goal/types'
import { validateMonthlyExpenses } from '@/domain/goal/validation'
import type { Money } from '@/domain/money/money'
import { isErr } from '@/domain/result'
import { TargetPreview } from '@/features/goal/target-preview'
import { useGoalDraft } from '@/features/goal/use-goal-draft'
import { Button, Choice, Field, Screen, Text } from '@/ui/primitives'
import { strings } from '@/ui/strings'
import { spacing } from '@/ui/tokens'

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
  const draft = useGoalDraft(monthlyExpenses, () => {
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

/** Props for {@link LevelOptions}. */
interface LevelOptionsProps {
  readonly selected: LevelKey
  readonly onSelect: (key: LevelKey) => void
  readonly customMonths: string
  readonly onCustomMonthsChange: (value: string) => void
  readonly error: string | undefined
}

/**
 * The levels, and the duration field the custom one reveals.
 *
 * Rendered from `LEVELS` rather than from a list of its own, so a level added to the
 * domain appears here without an edit — and so the durations shown are the ones the target
 * is actually calculated from.
 */
function LevelOptions({
  selected,
  onSelect,
  customMonths,
  onCustomMonthsChange,
  error,
}: LevelOptionsProps): ReactNode {
  return (
    <View accessibilityRole="radiogroup" style={styles.options}>
      {LEVELS.map((level) => (
        <Choice
          key={level.key}
          label={strings.levels[level.key].name}
          description={strings.levels[level.key].explanation}
          detail={strings.coverageDuration(level.coverageMonths)}
          selected={selected === level.key}
          onSelect={() => {
            onSelect(level.key)
          }}
          testID={`level-${level.key}`}
        />
      ))}
      <Choice
        label={strings.levels.custom.name}
        description={strings.levels.custom.explanation}
        selected={selected === 'custom'}
        onSelect={() => {
          onSelect('custom')
        }}
        testID="level-custom"
      />
      {selected === 'custom' ? (
        <CustomDuration value={customMonths} onChange={onCustomMonthsChange} error={error} />
      ) : null}
    </View>
  )
}

/** Props for {@link CustomDuration}. */
interface CustomDurationProps {
  readonly value: string
  readonly onChange: (value: string) => void
  readonly error: string | undefined
}

/** The duration field, shown only once the user has asked to name their own. */
function CustomDuration({ value, onChange, error }: CustomDurationProps): ReactNode {
  return (
    <Field
      label={strings.onboarding.customMonthsLabel}
      value={value}
      onChangeText={onChange}
      keyboardType="number-pad"
      help={strings.coverageRangeHelp(MINIMUM_COVERAGE_MONTHS, MAXIMUM_COVERAGE_MONTHS)}
      error={error}
      required
      testID="coverage-input"
    />
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

const styles = StyleSheet.create({
  options: { gap: spacing.sm } satisfies ViewStyle,
})
