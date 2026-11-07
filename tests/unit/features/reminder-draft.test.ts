import { DEFAULT_REMINDER_SETTING } from '@/domain/reminders/schedule'
import type { ReminderSetting } from '@/domain/reminders/types'
import {
  DEFAULT_DAY_OF_WEEK,
  draftFromSetting,
  settingFromDraft,
} from '@/features/reminders/reminder-draft'

/**
 * Between the stored setting and the form. The form holds both days so a change of
 * frequency can be undone without losing the day chosen; the setting keeps only the
 * frequency's own, as the schema requires.
 */
const WEEKLY: ReminderSetting = {
  enabled: true,
  frequency: 'weekly',
  dayOfMonth: null,
  dayOfWeek: 4,
  timeOfDay: '07:45',
}

describe('draftFromSetting', () => {
  it('opens on the stored schedule', () => {
    expect(draftFromSetting(WEEKLY)).toEqual({
      enabled: true,
      frequency: 'weekly',
      dayOfMonth: 5,
      dayOfWeek: 4,
      time: { hour: 7, minute: 45 },
    })
  })

  // Monday, for a weekly schedule nobody has chosen a day for. Not Sunday, the first of the
  // week as it is counted, which would fall on the one day few people do their accounts.
  it('fills a monthly setting with Monday for the weekly day', () => {
    expect(DEFAULT_DAY_OF_WEEK).toBe(1)
    expect(draftFromSetting(DEFAULT_REMINDER_SETTING).dayOfWeek).toBe(1)
  })

  // Only an import or a bug could store this; the form still opens.
  it('falls back to the default time for a stored time that is not one', () => {
    expect(draftFromSetting({ ...WEEKLY, timeOfDay: '24:00' }).time).toEqual({
      hour: 9,
      minute: 0,
    })
  })
})

describe('settingFromDraft', () => {
  it('keeps only the weekly day for a weekly draft', () => {
    expect(settingFromDraft(draftFromSetting(WEEKLY))).toEqual(WEEKLY)
  })

  it('keeps only the monthly day for a monthly draft', () => {
    const draft = { ...draftFromSetting(WEEKLY), frequency: 'monthly' as const, dayOfMonth: 17 }

    expect(settingFromDraft(draft)).toEqual({
      enabled: true,
      frequency: 'monthly',
      dayOfMonth: 17,
      dayOfWeek: null,
      timeOfDay: '07:45',
    })
  })

  it('writes the time as stored, two digits each', () => {
    const draft = { ...draftFromSetting(WEEKLY), time: { hour: 6, minute: 5 } }

    expect(settingFromDraft(draft).timeOfDay).toBe('06:05')
  })
})
