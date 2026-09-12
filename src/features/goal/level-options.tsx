import type { ReactNode } from 'react'
import { StyleSheet, View, type ViewStyle } from 'react-native'

import { LEVELS, MAXIMUM_COVERAGE_MONTHS, MINIMUM_COVERAGE_MONTHS } from '@/domain/goal/levels'
import type { LevelKey } from '@/domain/goal/types'
import { validateCoverageMonths } from '@/domain/goal/validation'
import { isErr } from '@/domain/result'
import { Choice, CoverageMeter, Field } from '@/ui/primitives'
import { strings } from '@/ui/strings'
import { spacing } from '@/ui/tokens'

/** Props for {@link LevelOptions}. */
export interface LevelOptionsProps {
  /** The level currently chosen. */
  readonly selected: LevelKey
  /** Called with the level the user picked. */
  readonly onSelect: (key: LevelKey) => void
  /** The custom duration as typed, which is text until it is a number. */
  readonly customMonths: string
  /** Called with the text of the custom duration field. */
  readonly onCustomMonthsChange: (value: string) => void
  /** The message under the duration field, when that is what was refused. */
  readonly error?: string | undefined
}

/**
 * How many months of expenses the fund should cover (FR-002), as a group of options.
 *
 * A feature component rather than part of the onboarding screen, because the choice is made
 * twice: once during setup and once whenever the goal is revised (FR-006). Two copies would
 * be two lists that could offer different levels, and the one that drifted would be the one
 * nobody was looking at.
 *
 * Rendered from `LEVELS` rather than from a list of its own, so a level added to the domain
 * appears here without an edit — and so the durations shown are the ones the target is
 * actually calculated from.
 *
 * @param props - See {@link LevelOptionsProps}
 * @returns The rendered group
 */
export function LevelOptions({
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
        >
          <CoverageMeter covered={level.coverageMonths} total={level.coverageMonths} />
        </Choice>
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

/**
 * The duration field, shown only once the user has asked to name their own.
 *
 * The meter sits with the field rather than inside the option above it. On the option it
 * would have to appear when the option is chosen — and an option that changes height on
 * selection pushes everything below it out from under the finger already reaching for the
 * field, which is the same reason `Choice` keeps its border width constant.
 */
function CustomDuration({ value, onChange, error }: CustomDurationProps): ReactNode {
  const typedMonths = typedCoverage(value)
  return (
    <View style={styles.custom}>
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
      {typedMonths === null ? null : <CoverageMeter covered={typedMonths} total={typedMonths} />}
    </View>
  )
}

/**
 * The duration currently in the custom field, when it is one the app would accept.
 *
 * Null keeps the meter off a value that is not a duration at all — an empty field, or a
 * count outside the range FR-002 permits. Drawing thirty squares for a duration the app is
 * about to refuse would illustrate a choice the user cannot make.
 */
function typedCoverage(value: string): number | null {
  const validated = validateCoverageMonths(Number.parseInt(value, 10))
  return isErr(validated) ? null : validated.value
}

const styles = StyleSheet.create({
  options: { gap: spacing.sm } satisfies ViewStyle,
  custom: { gap: spacing.xs } satisfies ViewStyle,
})
