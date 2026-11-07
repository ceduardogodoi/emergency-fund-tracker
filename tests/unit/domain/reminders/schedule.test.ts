import type { ValidationError } from '@/domain/errors'
import {
  DEFAULT_REMINDER_SETTING,
  MAXIMUM_DAY_OF_MONTH,
  formatTimeOfDay,
  parseTimeOfDay,
  stepHour,
  stepMinute,
  validateReminderSetting,
} from '@/domain/reminders/schedule'
import type { ReminderSetting } from '@/domain/reminders/types'
import { expectErr, expectOk } from '@tests/support/expect-result'

/**
 * The reminder schedule (FR-034): when a recurring reminder is due, and what makes one
 * well-formed.
 *
 * The screen offers only valid choices, so the rules here are for what reaches storage
 * another way — an import document, a later migration. The fixtures are deliberately not
 * the default schedule (monthly on the 5th at 09:00), so a rule that answered with the
 * default would be seen to (AP-002).
 */
const MONTHLY: ReminderSetting = {
  enabled: true,
  frequency: 'monthly',
  dayOfMonth: 17,
  dayOfWeek: null,
  timeOfDay: '20:30',
}

const WEEKLY: ReminderSetting = {
  enabled: true,
  frequency: 'weekly',
  dayOfMonth: null,
  dayOfWeek: 4,
  timeOfDay: '07:45',
}

/** The refusal, as the validation error it has to be. */
function refusal(setting: ReminderSetting): ValidationError {
  const error = expectErr(validateReminderSetting(setting))
  if (error.kind !== 'validation') {
    throw new Error(`Expected a validation error, got ${error.kind}`)
  }
  return error
}

describe('DEFAULT_REMINDER_SETTING', () => {
  // FR-034: off until the user turns it on. The schedule is what the form starts on,
  // decided with the user on 2026-11-07 — close to a typical payday.
  it('is off, monthly on the 5th at 09:00', () => {
    expect(DEFAULT_REMINDER_SETTING).toEqual({
      enabled: false,
      frequency: 'monthly',
      dayOfMonth: 5,
      dayOfWeek: null,
      timeOfDay: '09:00',
    })
  })

  it('is itself a valid schedule', () => {
    expect(expectOk(validateReminderSetting(DEFAULT_REMINDER_SETTING))).toEqual(
      DEFAULT_REMINDER_SETTING,
    )
  })
})

describe('validateReminderSetting', () => {
  it('accepts a monthly schedule and returns it unchanged', () => {
    expect(expectOk(validateReminderSetting(MONTHLY))).toEqual(MONTHLY)
  })

  it('accepts a weekly schedule and returns it unchanged', () => {
    expect(expectOk(validateReminderSetting(WEEKLY))).toEqual(WEEKLY)
  })

  // A disabled schedule is still a schedule: it is what the form opens on next time.
  it('validates a disabled schedule as strictly as an enabled one', () => {
    expect(refusal({ ...MONTHLY, enabled: false, dayOfMonth: 29 })).toEqual({
      kind: 'validation',
      field: 'dayOfMonth',
      messageKey: 'reminder.day-of-month-out-of-range',
    })
  })

  describe('the day of the month', () => {
    // Every month has a 28th, so a reminder on it can never skip February.
    it('is capped at 28', () => {
      expect(MAXIMUM_DAY_OF_MONTH).toBe(28)
      expect(expectOk(validateReminderSetting({ ...MONTHLY, dayOfMonth: 28 }))).toEqual({
        ...MONTHLY,
        dayOfMonth: 28,
      })
      expect(refusal({ ...MONTHLY, dayOfMonth: 29 }).messageKey).toBe(
        'reminder.day-of-month-out-of-range',
      )
    })

    it('starts at 1', () => {
      expect(expectOk(validateReminderSetting({ ...MONTHLY, dayOfMonth: 1 })).dayOfMonth).toBe(1)
      expect(refusal({ ...MONTHLY, dayOfMonth: 0 }).messageKey).toBe(
        'reminder.day-of-month-out-of-range',
      )
    })

    it('is a whole number', () => {
      expect(refusal({ ...MONTHLY, dayOfMonth: 5.5 }).field).toBe('dayOfMonth')
    })

    it('is required for a monthly schedule', () => {
      expect(refusal({ ...MONTHLY, dayOfMonth: null })).toEqual({
        kind: 'validation',
        field: 'dayOfMonth',
        messageKey: 'reminder.day-of-month-out-of-range',
      })
    })

    // Mirrors the schema's `reminder_monthly_has_day`: a weekly schedule carrying a day of
    // the month is two schedules at once, and which one fires is anybody's guess.
    it('is refused on a weekly schedule', () => {
      expect(refusal({ ...WEEKLY, dayOfMonth: 17 })).toEqual({
        kind: 'validation',
        field: 'dayOfMonth',
        messageKey: 'reminder.day-not-for-frequency',
      })
    })
  })

  describe('the day of the week', () => {
    it('runs from 0, Sunday, to 6, Saturday', () => {
      expect(expectOk(validateReminderSetting({ ...WEEKLY, dayOfWeek: 0 })).dayOfWeek).toBe(0)
      expect(expectOk(validateReminderSetting({ ...WEEKLY, dayOfWeek: 6 })).dayOfWeek).toBe(6)
      expect(refusal({ ...WEEKLY, dayOfWeek: 7 })).toEqual({
        kind: 'validation',
        field: 'dayOfWeek',
        messageKey: 'reminder.day-of-week-out-of-range',
      })
      expect(refusal({ ...WEEKLY, dayOfWeek: -1 }).messageKey).toBe(
        'reminder.day-of-week-out-of-range',
      )
    })

    it('is a whole number', () => {
      expect(refusal({ ...WEEKLY, dayOfWeek: 2.5 }).field).toBe('dayOfWeek')
    })

    it('is required for a weekly schedule', () => {
      expect(refusal({ ...WEEKLY, dayOfWeek: null }).messageKey).toBe(
        'reminder.day-of-week-out-of-range',
      )
    })

    it('is refused on a monthly schedule', () => {
      expect(refusal({ ...MONTHLY, dayOfWeek: 4 })).toEqual({
        kind: 'validation',
        field: 'dayOfWeek',
        messageKey: 'reminder.day-not-for-frequency',
      })
    })
  })

  describe('the time of day', () => {
    it.each(['00:00', '23:59', '07:45'])('accepts %s', (timeOfDay) => {
      expect(expectOk(validateReminderSetting({ ...MONTHLY, timeOfDay })).timeOfDay).toBe(timeOfDay)
    })

    // The schema's GLOB admits `29:00` and `24:00`; the domain is the stricter of the two.
    it.each(['24:00', '29:00', '12:60', '9:00', '09:00:00', '9am', ''])(
      'refuses %j',
      (timeOfDay) => {
        expect(refusal({ ...MONTHLY, timeOfDay })).toEqual({
          kind: 'validation',
          field: 'timeOfDay',
          messageKey: 'reminder.time-invalid',
        })
      },
    )
  })
})

describe('parseTimeOfDay', () => {
  it('reads hours and minutes', () => {
    expect(parseTimeOfDay('20:30')).toEqual({ hour: 20, minute: 30 })
    expect(parseTimeOfDay('07:05')).toEqual({ hour: 7, minute: 5 })
  })

  it('is null for anything that is not a time on a 24-hour clock', () => {
    expect(parseTimeOfDay('24:00')).toBeNull()
    expect(parseTimeOfDay('7:05')).toBeNull()
  })
})

describe('formatTimeOfDay', () => {
  it('pads both parts to two digits', () => {
    expect(formatTimeOfDay({ hour: 7, minute: 5 })).toBe('07:05')
    expect(formatTimeOfDay({ hour: 20, minute: 30 })).toBe('20:30')
  })
})

describe('stepHour', () => {
  it('moves an hour either way, leaving the minutes', () => {
    expect(stepHour({ hour: 20, minute: 30 }, 1)).toEqual({ hour: 21, minute: 30 })
    expect(stepHour({ hour: 20, minute: 30 }, -1)).toEqual({ hour: 19, minute: 30 })
  })

  // Round the clock, as a clock does: no hour is out of reach from any other.
  it('wraps past midnight in both directions', () => {
    expect(stepHour({ hour: 23, minute: 15 }, 1)).toEqual({ hour: 0, minute: 15 })
    expect(stepHour({ hour: 0, minute: 15 }, -1)).toEqual({ hour: 23, minute: 15 })
  })
})

describe('stepMinute', () => {
  it('moves a quarter of an hour either way, leaving the hour', () => {
    expect(stepMinute({ hour: 7, minute: 15 }, 1)).toEqual({ hour: 7, minute: 30 })
    expect(stepMinute({ hour: 7, minute: 15 }, -1)).toEqual({ hour: 7, minute: 0 })
  })

  // The minutes go round on their own. Carrying into the hour would make 07:45 + 15 a
  // change to both steppers at once, which is not what the user pressed.
  it('wraps within the hour', () => {
    expect(stepMinute({ hour: 7, minute: 45 }, 1)).toEqual({ hour: 7, minute: 0 })
    expect(stepMinute({ hour: 7, minute: 0 }, -1)).toEqual({ hour: 7, minute: 45 })
  })

  // A stored time off the quarter — from an import, say — moves to the nearest quarter in
  // the direction pressed, rather than staying off it forever.
  it('lands on a quarter from a time between them', () => {
    expect(stepMinute({ hour: 7, minute: 7 }, 1)).toEqual({ hour: 7, minute: 15 })
    expect(stepMinute({ hour: 7, minute: 7 }, -1)).toEqual({ hour: 7, minute: 0 })
    expect(stepMinute({ hour: 7, minute: 52 }, 1)).toEqual({ hour: 7, minute: 0 })
    expect(stepMinute({ hour: 7, minute: 52 }, -1)).toEqual({ hour: 7, minute: 45 })
  })
})
