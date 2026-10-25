import type { ReactNode } from 'react'
import { StyleSheet, View, type ViewStyle } from 'react-native'

import { useServices } from '@/runtime/services-context'
import type { MonthKey } from '@/domain/dates/calendar-date'
import type { Period } from '@/domain/statistics/period'
import type { Formatters } from '@/ui/format'
import { Choice, Text } from '@/ui/primitives'
import { strings } from '@/ui/strings'
import { spacing } from '@/ui/tokens'
import type { PeriodOption } from './use-statistics'

/** Props for {@link PeriodFilter}. */
export interface PeriodFilterProps {
  /** Every period offered, with what each covers. */
  readonly options: readonly PeriodOption[]
  /** The period chosen. */
  readonly selected: Period
  /** Called with the period the user chooses. */
  readonly onSelect: (period: Period) => void
}

/**
 * The period every figure on the screen is filtered to (FR-023).
 *
 * Each option says the months it covers, not only its name. "Last 3 months" means the
 * three complete months before this one, and a reader who took it to include the month in
 * progress would look for this week's contribution and not find it; the months written
 * out say which it is.
 *
 * @param props - See {@link PeriodFilterProps}
 * @returns The rendered filter
 */
export function PeriodFilter({ options, selected, onSelect }: PeriodFilterProps): ReactNode {
  const { format } = useServices()
  return (
    <View style={styles.filter} accessibilityRole="radiogroup">
      <Text variant="label" tone="secondary">
        {strings.statistics.periodLabel}
      </Text>
      {options.map(({ period, months }) => (
        <Choice
          key={periodKey(period)}
          label={periodName(period)}
          description={coverage(months, format)}
          selected={periodKey(period) === periodKey(selected)}
          onSelect={() => {
            onSelect(period)
          }}
          testID={`period-${periodKey(period)}`}
        />
      ))}
    </View>
  )
}

/**
 * What a period is called.
 *
 * @param period The period.
 * @returns Its name, as the filter and the label above the figures both say it.
 */
export function periodName(period: Period): string {
  return period.kind === 'all-time'
    ? strings.statistics.allTime
    : strings.statistics.recent(period.months)
}

/**
 * The months a period covers, in words.
 *
 * @param months The period's months, ascending.
 * @param format The session's formatters.
 * @returns "De julho de 2026 a setembro de 2026", or the line for a period with no month.
 */
export function coverage(months: readonly MonthKey[], format: Formatters): string {
  const first = months.at(0)
  const last = months.at(-1)
  if (first === undefined || last === undefined) {
    return strings.statistics.periodNoMonths
  }
  return strings.statistics.covers(format.month(first), format.month(last))
}

/** One string per period, to compare two and to key a list. */
function periodKey(period: Period): string {
  return period.kind === 'all-time' ? 'all-time' : `recent-${period.months}`
}

const styles = StyleSheet.create({
  filter: { gap: spacing.sm } satisfies ViewStyle,
})
