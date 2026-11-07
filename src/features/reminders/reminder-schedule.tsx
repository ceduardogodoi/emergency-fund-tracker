import type { ReactNode } from 'react'
import { StyleSheet, View, type ViewStyle } from 'react-native'

import { MAXIMUM_DAY_OF_MONTH, MINUTE_STEP } from '@/domain/reminders/schedule'
import type { ReminderFrequency } from '@/domain/reminders/types'
import { Chip, Choice, Stepper, Text } from '@/ui/primitives'
import { strings } from '@/ui/strings'
import { spacing } from '@/ui/tokens'
import type { ReminderDraftState } from './use-reminder-draft'

/** The frequencies, in the order offered: monthly first, since it is the default. */
const FREQUENCIES: readonly ReminderFrequency[] = ['monthly', 'weekly']

/** Every day a monthly reminder may fall on, 1 to 28. */
const DAYS_OF_MONTH = Array.from({ length: MAXIMUM_DAY_OF_MONTH }, (_unused, index) => index + 1)

/** Props for {@link ReminderSchedule}. */
export interface ReminderScheduleProps {
  readonly state: ReminderDraftState
}

/**
 * When the reminder comes: how often, on which day, and at what time — then the whole of
 * it in one sentence, so the choice reads back as the user will meet it.
 *
 * @param props - See {@link ReminderScheduleProps}
 * @returns The rendered controls
 */
export function ReminderSchedule({ state }: ReminderScheduleProps): ReactNode {
  return (
    <>
      <Frequency state={state} />
      {state.draft.frequency === 'monthly' ? (
        <DaysOfMonth state={state} />
      ) : (
        <DaysOfWeek state={state} />
      )}
      <TimeOfDayControls state={state} />
      <Text tone="secondary" testID="reminder-summary">
        {summary(state)}
      </Text>
    </>
  )
}

/** The schedule in one sentence, as the user will meet it. */
function summary({ draft, timeOfDay }: ReminderDraftState): string {
  if (draft.frequency === 'monthly') {
    return strings.reminders.summaryMonthly(draft.dayOfMonth, timeOfDay)
  }
  // The draft only ever holds 0 to 6; the index type admits more than the array holds.
  const weekday = strings.reminders.weekdays[draft.dayOfWeek]
  return weekday === undefined ? '' : strings.reminders.summaryWeekly(weekday.every, timeOfDay)
}

/** Monthly or weekly. */
function Frequency({ state }: ReminderScheduleProps): ReactNode {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={strings.reminders.frequencyLabel}
      style={styles.group}
    >
      <Text variant="label">{strings.reminders.frequencyLabel}</Text>
      {FREQUENCIES.map((frequency) => (
        <Choice
          key={frequency}
          label={strings.reminders[frequency].label}
          description={strings.reminders[frequency].description}
          selected={state.draft.frequency === frequency}
          onSelect={() => {
            state.selectFrequency(frequency)
          }}
          testID={`frequency-${frequency}`}
        />
      ))}
    </View>
  )
}

/** The hour and the minutes, each on a stepper. */
function TimeOfDayControls({ state }: ReminderScheduleProps): ReactNode {
  const { time } = state.draft
  return (
    <View style={styles.group}>
      <Text variant="label">{strings.reminders.timeLabel}</Text>
      <View style={styles.time}>
        <Stepper
          label={strings.reminders.hourLabel}
          value={twoDigits(time.hour)}
          increaseLabel={strings.reminders.hourIncrease}
          decreaseLabel={strings.reminders.hourDecrease}
          onIncrease={() => {
            state.stepHour(1)
          }}
          onDecrease={() => {
            state.stepHour(-1)
          }}
          testID="hour"
        />
        <Stepper
          label={strings.reminders.minuteLabel}
          value={twoDigits(time.minute)}
          increaseLabel={strings.reminders.minuteIncrease(MINUTE_STEP)}
          decreaseLabel={strings.reminders.minuteDecrease(MINUTE_STEP)}
          onIncrease={() => {
            state.stepMinute(1)
          }}
          onDecrease={() => {
            state.stepMinute(-1)
          }}
          testID="minute"
        />
      </View>
    </View>
  )
}

/** The days 1 to 28, as a grid of chips, with why it stops there. */
function DaysOfMonth({ state }: ReminderScheduleProps): ReactNode {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={strings.reminders.dayOfMonthLabel}
      style={styles.group}
    >
      <Text variant="label">{strings.reminders.dayOfMonthLabel}</Text>
      <View style={styles.grid}>
        {DAYS_OF_MONTH.map((day) => (
          <Chip
            key={day}
            label={String(day)}
            accessibilityLabel={strings.reminders.dayOfMonthName(day)}
            selected={state.draft.dayOfMonth === day}
            onSelect={() => {
              state.selectDayOfMonth(day)
            }}
            testID={`day-of-month-${day}`}
          />
        ))}
      </View>
      <Text variant="caption" tone="secondary">
        {strings.reminders.dayOfMonthHelp(MAXIMUM_DAY_OF_MONTH)}
      </Text>
    </View>
  )
}

/** The seven days of the week, from Sunday, abbreviated on screen and named in full aloud. */
function DaysOfWeek({ state }: ReminderScheduleProps): ReactNode {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={strings.reminders.dayOfWeekLabel}
      style={styles.group}
    >
      <Text variant="label">{strings.reminders.dayOfWeekLabel}</Text>
      <View style={styles.grid}>
        {strings.reminders.weekdays.map((weekday, day) => (
          <Chip
            key={weekday.name}
            label={weekday.short}
            accessibilityLabel={weekday.name}
            selected={state.draft.dayOfWeek === day}
            onSelect={() => {
              state.selectDayOfWeek(day)
            }}
            testID={`day-of-week-${day}`}
          />
        ))}
      </View>
    </View>
  )
}

/** A stepper's value, as the time is written: two digits. */
function twoDigits(value: number): string {
  return String(value).padStart(2, '0')
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm } satisfies ViewStyle,
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs } satisfies ViewStyle,
  time: { flexDirection: 'row', gap: spacing.lg } satisfies ViewStyle,
})
