import type { ReactNode } from 'react'
import { AccessibilityInfo, StyleSheet, View, type ViewStyle } from 'react-native'

import { useServices } from '@/runtime/services-context'
import {
  addMonths,
  firstDayOfMonth,
  lastDayOfMonth,
  monthKey,
  nextMonth,
  type CalendarDate,
} from '@/domain/dates/calendar-date'
import { Button, Text } from '@/ui/primitives'
import { strings } from '@/ui/strings'
import { spacing } from '@/ui/tokens'

/** Where a new date starts: a year on, a horizon most people can say something about. */
const STARTING_MONTHS_AHEAD = 12

/** Months in a year, for the buttons that move by one. */
const MONTHS_IN_YEAR = 12

/** Props for {@link DesiredDateField}. */
export interface DesiredDateFieldProps {
  /** The chosen date, or null for none. */
  readonly value: CalendarDate | null
  /** Called with the new date, or null when it is removed. */
  readonly onChange: (value: CalendarDate | null) => void
  /** The refusal to show under the field, when the date was refused. */
  readonly error?: string | undefined
  /** What the date asks, shown under it — the goal screen's readout. */
  readonly children?: ReactNode
}

/**
 * The desired completion date (FR-031), chosen a month at a time.
 *
 * A month rather than a day. The required contribution counts whole months and a target is
 * reached "by the end of" one, so the day would be a choice that changes nothing — and a
 * calendar is a poor way to reach a date two years out, paging through every month between.
 * What is stored is the month's last day, the same day a projection resolves to.
 *
 * The earliest month offered is the next one. A date later this month asks for everything
 * at once, which is not a plan; a date that has passed is refused on save. A button whose
 * move would land earlier than next month is disabled rather than clamped, so a press never
 * lands somewhere other than where it says.
 *
 * Each move is announced, because the month is the only thing that changes and a
 * screen-reader user who pressed "Próximo mês" has no other way to learn where it landed.
 *
 * @param props - See {@link DesiredDateFieldProps}
 * @returns The rendered field
 */
export function DesiredDateField({
  value,
  onChange,
  error,
  children,
}: DesiredDateFieldProps): ReactNode {
  const { clock, format } = useServices()
  const earliest = nextMonth(monthKey(clock.today()))

  const choose = (date: CalendarDate | null): void => {
    onChange(date)
    if (date !== null) {
      AccessibilityInfo.announceForAccessibility(
        strings.forecast.desiredTarget(format.month(monthKey(date))),
      )
    }
  }

  return (
    <View style={styles.field} testID="desired-date-field">
      <Text variant="label">{strings.desiredDate.label}</Text>
      <Text tone="secondary">{strings.desiredDate.help}</Text>
      {value === null ? (
        <>
          <Text>{strings.desiredDate.none}</Text>
          <Button
            label={strings.desiredDate.add}
            variant="secondary"
            onPress={() => {
              choose(shifted(lastDayOfMonth(monthKey(clock.today())), STARTING_MONTHS_AHEAD))
            }}
            testID="desired-date-add"
          />
        </>
      ) : (
        <Stepper value={value} earliest={earliest} onChoose={choose} />
      )}
      {error === undefined ? null : <Text tone="negative">{error}</Text>}
      {children}
    </View>
  )
}

/** Props for {@link Stepper}. */
interface StepperProps {
  readonly value: CalendarDate
  /** The earliest month a move may land in, `YYYY-MM`. */
  readonly earliest: string
  readonly onChoose: (value: CalendarDate | null) => void
}

/** The month chosen, the four moves, and the way to remove it. */
function Stepper({ value, earliest, onChoose }: StepperProps): ReactNode {
  const { format } = useServices()
  const move = (label: string, months: number, testID: string): ReactNode => {
    const target = shifted(value, months)
    return (
      <View style={styles.move}>
        <Button
          label={label}
          variant="secondary"
          disabled={monthKey(target) < earliest}
          onPress={() => {
            onChoose(target)
          }}
          testID={testID}
        />
      </View>
    )
  }

  return (
    <>
      <Text variant="heading">{strings.forecast.desiredTarget(format.month(monthKey(value)))}</Text>
      <View style={styles.moves}>
        {move(strings.desiredDate.previousMonth, -1, 'desired-date-previous-month')}
        {move(strings.desiredDate.nextMonth, 1, 'desired-date-next-month')}
      </View>
      <View style={styles.moves}>
        {move(strings.desiredDate.previousYear, -MONTHS_IN_YEAR, 'desired-date-previous-year')}
        {move(strings.desiredDate.nextYear, MONTHS_IN_YEAR, 'desired-date-next-year')}
      </View>
      <Button
        label={strings.desiredDate.remove}
        variant="secondary"
        onPress={() => {
          onChoose(null)
        }}
        testID="desired-date-remove"
      />
    </>
  )
}

/** The last day of the month `months` away from the date's month. */
function shifted(date: CalendarDate, months: number): CalendarDate {
  return lastDayOfMonth(monthKey(addMonths(firstDayOfMonth(monthKey(date)), months)))
}

const styles = StyleSheet.create({
  field: { gap: spacing.sm } satisfies ViewStyle,
  // Two moves to a row, earlier on the left, so the pair reads as a direction.
  moves: { flexDirection: 'row', gap: spacing.sm } satisfies ViewStyle,
  move: { flex: 1 } satisfies ViewStyle,
})
