import type { ReactNode } from 'react'
import { StyleSheet, View, type ViewStyle } from 'react-native'

import { useServices } from '@/runtime/services-context'
import { monthKey, type CalendarDate } from '@/domain/dates/calendar-date'
import type { MonthBreakdown as MonthRow } from '@/domain/statistics/breakdown'
import { Card, Text } from '@/ui/primitives'
import { strings } from '@/ui/strings'
import { borderWidth, color, spacing } from '@/ui/tokens'

/** Props for {@link MonthBreakdown}. */
export interface MonthBreakdownProps {
  /** The period's months, oldest first, as the domain gives them. */
  readonly months: readonly MonthRow[]
  /** Today, so the month in progress says its balance is today's rather than its close. */
  readonly today: CalendarDate
}

/**
 * Month by month: what went in, what went out, and where the balance closed (FR-019,
 * FR-022).
 *
 * The one place balance growth is shown. This release has no charts (research D-011,
 * amended), so the closing balance on each row is the growth, read down the list. Months
 * with nothing in them are rows like any other: a month the user saved nothing in is
 * information.
 *
 * Most recent first, as the history is. Rendered in full rather than virtualised: a period
 * is at most a decade of months, and the list sits on a screen that scrolls.
 *
 * @param props - See {@link MonthBreakdownProps}
 * @returns The rendered list
 */
export function MonthBreakdown({ months, today }: MonthBreakdownProps): ReactNode {
  return (
    <Card testID="statistics-breakdown">
      <Text variant="heading" accessibilityRole="header">
        {strings.statistics.breakdownHeading}
      </Text>
      {months.toReversed().map((row) => (
        <MonthLine key={row.month} row={row} inProgress={row.month === monthKey(today)} />
      ))}
    </Card>
  )
}

/** Props for {@link MonthLine}. */
interface MonthLineProps {
  readonly row: MonthRow
  /** Whether the month is still running. */
  readonly inProgress: boolean
}

/**
 * One month, as one stop for a screen reader.
 *
 * `accessible` with the sentence as its label, so the month is announced once, in the
 * order it is laid out, rather than as six fragments a reader has to reassemble.
 */
function MonthLine({ row, inProgress }: MonthLineProps): ReactNode {
  const { format } = useServices()
  const month = format.month(row.month)
  const contributed = format.money(row.contributed)
  const withdrawn = format.money(row.withdrawn)
  const balance = format.money(row.closingBalance)

  return (
    <View
      accessible
      accessibilityLabel={strings.statistics.monthSummary(
        month,
        contributed,
        withdrawn,
        balance,
        inProgress,
      )}
      style={styles.row}
      testID="month-row"
    >
      <Text variant="label">{month}</Text>
      <Pair label={strings.statistics.contributed} value={contributed} />
      <Pair label={strings.statistics.withdrawn} value={withdrawn} />
      <Pair
        label={inProgress ? strings.statistics.balanceSoFar : strings.statistics.closingBalance}
        value={balance}
      />
    </View>
  )
}

/** Props for {@link Pair}. */
interface PairProps {
  readonly label: string
  readonly value: string
}

/**
 * A label and its amount on one line, wrapping so the amount drops under the label at the
 * largest text size rather than squeezing it (FR-050).
 */
function Pair({ label, value }: PairProps): ReactNode {
  return (
    <View style={styles.pair}>
      <Text tone="secondary">{label}</Text>
      <Text numeric>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  // A rule between months, which spacing alone would leave as one long column.
  row: {
    gap: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: borderWidth.control,
    borderTopColor: color.divider,
  } satisfies ViewStyle,
  pair: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    columnGap: spacing.sm,
  } satisfies ViewStyle,
})
