import { addDays, type CalendarDate } from '@/domain/dates/calendar-date'

/**
 * How the day of a new entry was chosen.
 *
 * A choice rather than a date, because "Hoje" and "Ontem" are relative: they are resolved
 * against today when the entry is built, and a picked day is kept aside so that returning
 * to the calendar finds it where it was left.
 */
export type DateChoice = 'today' | 'yesterday' | 'other'

/** The part of a new entry's draft the date group reads and changes. */
export interface DateDraft {
  readonly dateChoice: DateChoice
  /** Today, as the clock reports it. The calendar's last selectable day. */
  readonly today: CalendarDate
  /** The day "Ontem" stands for. */
  readonly yesterday: CalendarDate
  /** The day last picked from the calendar. */
  readonly pickedDate: CalendarDate
  /** The message under the date, when that is what was refused. */
  readonly dateError: string | undefined
  readonly chooseDate: (choice: DateChoice) => void
  readonly pickDate: (value: CalendarDate) => void
}

/**
 * The day a choice stands for.
 *
 * @param choice How the day was chosen.
 * @param pickedDate The day last picked from the calendar, read only for `other`.
 * @param today From the `Clock` port, read at the moment the entry is built.
 * @returns The entry's date.
 */
export function resolveDate(
  choice: DateChoice,
  pickedDate: CalendarDate,
  today: CalendarDate,
): CalendarDate {
  switch (choice) {
    case 'today':
      return today
    case 'yesterday':
      return addDays(today, -1)
    case 'other':
      return pickedDate
  }
}
