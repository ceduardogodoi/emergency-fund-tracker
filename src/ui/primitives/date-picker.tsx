import { DateTimePicker } from '@expo/ui/community/datetime-picker'
import type { ReactNode } from 'react'

import type { CalendarDate } from '@/domain/dates/calendar-date'
import { fromUtcDate, toUtcDate } from '@/ui/format'
import { color } from '@/ui/tokens'

/** The zone the calendar draws its days in — the one its dates are expressed in. */
const CALENDAR_ZONE = 'UTC'

/** Hours past UTC midnight at which the latest selectable day is bounded. See below. */
const BOUND_HOUR = 12

/** Props for {@link DatePicker}. */
export interface DatePickerProps {
  /** The day shown as chosen. */
  readonly value: CalendarDate
  /** The last day that may be chosen, inclusive. Today, for an entry (FR-009). */
  readonly latest: CalendarDate
  /**
   * The locale months and weekdays are named in, as a BCP 47 tag.
   *
   * Honoured on iOS only. The Android picker follows the device language, and `@expo/ui`
   * offers no way to change that.
   */
  readonly locale: string
  /** Called with the day the user chose, and only when it differs from `value`. */
  readonly onChange: (value: CalendarDate) => void
  /** Exposes the native view to tests. */
  readonly testID?: string | undefined
}

/**
 * A calendar, laid out inline, that speaks only in calendar dates.
 *
 * The native picker deals in `Date`, which is an instant, and a calendar day is not one.
 * Every translation between the two happens here and in `ui/format/utc-date.ts`, under the
 * UTC-midnight convention both platforms were measured returning, so no screen ever holds
 * a `Date` it could read with the wrong getters.
 *
 * Inline rather than as a dialog on both platforms. iOS offers no dialog, and one layout
 * everywhere is one thing to test and one thing the user learns.
 *
 * Three behaviours are the platforms', measured on 2026-09-26 and normalised here:
 *   - iOS draws the selection in the device zone unless told otherwise, highlighting the
 *     9th for UTC midnight on the 10th at UTC−3. `timeZoneName` pins it to UTC.
 *   - Android reads the upper bound through the device's local calendar, so UTC midnight
 *     on today would be yesterday at UTC−3 and today would be refused. Noon lands on the
 *     same calendar day in every zone from UTC−11 to UTC+11; beyond that the bound can let
 *     tomorrow through, and the entry rules refuse it on save instead.
 *   - Android reports its initial value as a selection when it mounts. That report is
 *     dropped, so opening the calendar is not an edit on one platform and not the other.
 *
 * @param props - See {@link DatePickerProps}
 * @returns The rendered calendar
 */
export function DatePicker({
  value,
  latest,
  locale,
  onChange,
  testID,
}: DatePickerProps): ReactNode {
  const bound = toUtcDate(latest)
  bound.setUTCHours(BOUND_HOUR)

  return (
    <DateTimePicker
      value={toUtcDate(value)}
      mode="date"
      display="inline"
      presentation="inline"
      maximumDate={bound}
      timeZoneName={CALENDAR_ZONE}
      locale={foundationLocale(locale)}
      accentColor={color.text.accent}
      onValueChange={(_event, chosen) => {
        const day = fromUtcDate(chosen)
        if (day !== value) {
          onChange(day)
        }
      }}
      // Spread rather than passed: `@expo/ui` declares `testID?: string` without admitting
      // `undefined`, which `exactOptionalPropertyTypes` holds it to.
      {...(testID === undefined ? {} : { testID })}
    />
  )
}

/**
 * The locale as SwiftUI reads it: a Foundation identifier, `pt_BR` rather than `pt-BR`.
 *
 * Measured, not assumed. Handed the BCP 47 tag the rest of the app uses, the simulator
 * named the months and weekdays in English; handed the underscore form, in Portuguese.
 *
 * @param tag A BCP 47 tag, like `pt-BR`.
 * @returns The same locale with its subtags joined by underscores.
 */
function foundationLocale(tag: string): string {
  return tag.replace(/-/g, '_')
}
