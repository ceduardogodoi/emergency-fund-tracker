import { DateTimePicker } from '@expo/ui/community/datetime-picker'
import { DatePicker as SwiftDatePicker, Host } from '@expo/ui/swift-ui'
import { datePickerStyle, environment } from '@expo/ui/swift-ui/modifiers'
import type { ReactNode } from 'react'
import { Platform } from 'react-native'

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
 * Four behaviours are the platforms', measured on 2026-09-26 and normalised here:
 *   - iOS draws the selection in the device zone unless told otherwise, highlighting the
 *     9th for UTC midnight on the 10th at UTC−3. The calendar is pinned to UTC.
 *   - Android reads the upper bound through the device's local calendar, so UTC midnight
 *     on today would be yesterday at UTC−3 and today would be refused. Noon lands on the
 *     same calendar day in every zone from UTC−11 to UTC+11; beyond that the bound can let
 *     tomorrow through, and the entry rules refuse it on save instead.
 *   - Android reports its initial value as a selection when it mounts. That report is
 *     dropped, so opening the calendar is not an edit on one platform and not the other.
 *   - iOS ignores the community wrapper's `accentColor`, which reaches SwiftUI as a `.tint`
 *     shape style the graphical calendar does not read, and draws the selection in system
 *     blue. The `Host`'s `seedColor` sets `.tint(Color)`, which it does read — and the
 *     wrapper does not forward it. So iOS is composed here from the SwiftUI pieces the
 *     wrapper itself uses, and Android keeps the wrapper, whose colour Compose honours.
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

  const calendar: NativeCalendarProps = {
    selection: toUtcDate(value),
    bound,
    locale: foundationLocale(locale),
    onDate: (chosen) => {
      const day = fromUtcDate(chosen)
      if (day !== value) {
        onChange(day)
      }
    },
    // Spread rather than passed: `@expo/ui` declares `testID?: string` without admitting
    // `undefined`, which `exactOptionalPropertyTypes` holds it to.
    testProps: testID === undefined ? {} : { testID },
  }
  return Platform.OS === 'ios' ? <IosCalendar {...calendar} /> : <AndroidCalendar {...calendar} />
}

/** What either platform's calendar is given, already translated out of calendar dates. */
interface NativeCalendarProps {
  /** The chosen day, at UTC midnight. */
  readonly selection: Date
  /** The last selectable day, at noon UTC — see {@link DatePicker}. */
  readonly bound: Date
  /** A Foundation locale identifier. Read on iOS; Android follows the device. */
  readonly locale: string
  /** Called with whatever instant the native view reports. */
  readonly onDate: (chosen: Date) => void
  /** The test id when there is one, already shaped for spreading — see {@link DatePicker}. */
  readonly testProps: { readonly testID?: string }
}

/** The SwiftUI calendar, seeded with the accent so the graphical style draws in it. */
function IosCalendar({
  selection,
  bound,
  locale,
  onDate,
  testProps,
}: NativeCalendarProps): ReactNode {
  return (
    <Host matchContents={{ vertical: true }} ignoreSafeArea="all" seedColor={color.text.accent}>
      <SwiftDatePicker
        selection={selection}
        displayedComponents={['date']}
        range={{ end: bound }}
        onDateChange={onDate}
        modifiers={[
          datePickerStyle('graphical'),
          environment('locale', locale),
          environment('timeZone', CALENDAR_ZONE),
        ]}
        {...testProps}
      />
    </Host>
  )
}

/** The Compose calendar, through the community wrapper, laid out inline. */
function AndroidCalendar({
  selection,
  bound,
  locale,
  onDate,
  testProps,
}: NativeCalendarProps): ReactNode {
  return (
    <DateTimePicker
      value={selection}
      mode="date"
      display="inline"
      presentation="inline"
      maximumDate={bound}
      // Both iOS-only in the wrapper, and passed anyway: they say what the calendar should
      // do, and cost nothing where they are ignored.
      timeZoneName={CALENDAR_ZONE}
      locale={locale}
      accentColor={color.text.accent}
      onValueChange={(_event, chosen) => {
        onDate(chosen)
      }}
      {...testProps}
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
