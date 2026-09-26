import { fireEvent, render, screen } from '@testing-library/react-native'
import { Platform } from 'react-native'

import { calendarDate } from '@/domain/dates/calendar-date'
import { DatePicker } from '@/ui/primitives'
import { color } from '@/ui/tokens'

/**
 * The calendar the contribute screen reveals under "Outra data".
 *
 * These drive the real `@expo/ui` wrapper down to its native host view, which jest-expo
 * renders as the iOS implementation: the host carries the selection and the range as ISO
 * strings and reports a tap as `{ nativeEvent: { date } }`. What the device does with them
 * was measured on both platforms (see `src/ui/format/utc-date.ts`); what is checked here
 * is that the primitive speaks only in calendar dates and translates them the measured way.
 *
 * The primitive branches by platform — its own SwiftUI composition on iOS, the community
 * wrapper on Android — so the shared behaviour runs on both. Jest resolves the wrapper to
 * its iOS implementation whatever `Platform.OS` says, so on the Android branch these still
 * read the same host view; what they establish is that the branch hands the wrapper what it
 * needs, not how Compose draws it. That half was measured on the emulator.
 */
const PICKER = 'picker'

/** The two platforms this app builds for — see `primitives.test.tsx` for why not wider. */
type ShippedPlatform = 'ios' | 'android'

const realPlatform = Platform.OS

afterEach(() => {
  Platform.OS = realPlatform
})

/** Renders the picker on the 10th, with today as the 26th. */
async function renderPicker(onChange: (value: string) => void = jest.fn()): Promise<void> {
  await render(
    <DatePicker
      value={calendarDate('2026-09-10')}
      latest={calendarDate('2026-09-26')}
      locale="pt-BR"
      onChange={onChange}
      testID={PICKER}
    />,
  )
}

/** Reports a tap on a day, the way the native view does. */
async function tapDay(isoInstant: string): Promise<void> {
  await fireEvent(screen.getByTestId(PICKER), 'dateChange', { nativeEvent: { date: isoInstant } })
}

describe.each<ShippedPlatform>(['ios', 'android'])('DatePicker on %s', (platform) => {
  beforeEach(() => {
    Platform.OS = platform
  })

  it('opens on the chosen day, at UTC midnight', async () => {
    await renderPicker()

    expect(screen.getByTestId(PICKER).props.selection).toBe('2026-09-10T00:00:00.000Z')
  })

  // A tap on the 15th arrives as UTC midnight. Read with local getters at UTC−3, where
  // the suite runs, that is the 14th.
  it('reports a tapped day as the calendar date the user saw', async () => {
    const onChange = jest.fn()
    await renderPicker(onChange)

    await tapDay('2026-09-15T00:00:00.000Z')

    expect(onChange).toHaveBeenCalledWith('2026-09-15')
  })

  // Android's Compose picker reports its initial value as a selection when it mounts; iOS
  // does not. Passing that on would make opening the calendar an edit on one platform and
  // not the other.
  it('stays quiet when told the day it already shows', async () => {
    const onChange = jest.fn()
    await renderPicker(onChange)

    await tapDay('2026-09-10T00:00:00.000Z')

    expect(onChange).not.toHaveBeenCalled()
  })

  // FR-009. The bound is noon rather than midnight because Android reads it through the
  // device's local calendar, where UTC midnight on the 26th is still the 25th at UTC−3 —
  // which would make today itself unselectable.
  it('offers nothing after the latest day, while keeping that day itself', async () => {
    await renderPicker()

    expect(screen.getByTestId(PICKER).props.range).toEqual({ end: '2026-09-26T12:00:00.000Z' })
  })

  // Without it the SwiftUI calendar draws UTC midnight in the device zone, and at UTC−3
  // highlights the 9th for a value of the 10th. Measured on the simulator.
  it('draws its days in UTC, the zone its dates are expressed in', async () => {
    await renderPicker()

    expect(screen.getByTestId(PICKER).props.modifiers).toContainEqual(
      expect.objectContaining({ key: 'timeZone', value: 'UTC' }),
    )
  })

  // SwiftUI reads the locale as a Foundation identifier, underscore and all. Handed the BCP
  // 47 `pt-BR` the app uses everywhere else, the simulator drew "September 2026" and "SUN
  // MON"; handed `pt_BR` it drew "setembro de 2026". Measured on 2026-09-26.
  it('names its months in the app locale, in the form iOS reads', async () => {
    await renderPicker()

    expect(screen.getByTestId(PICKER).props.modifiers).toContainEqual(
      expect.objectContaining({ key: 'locale', value: 'pt_BR' }),
    )
  })
})

/**
 * The selected day in the app's accent rather than the system's.
 *
 * The platforms need it said in different places, which is why the primitive branches at
 * all. The community wrapper's `accentColor` reaches the Compose picker as its colour, and
 * reaches SwiftUI as a `.tint` shape style that the graphical calendar ignores — measured
 * on the simulator as system blue. The `Host`'s `seedColor` sets `.tint(Color)`, which it
 * honours, and the wrapper does not forward it.
 */
describe('DatePicker colour', () => {
  it('seeds the SwiftUI host with the accent on iOS', async () => {
    Platform.OS = 'ios'
    await renderPicker()

    expect(screen.getByTestId(PICKER).parent?.props.seedColor).toBe(color.text.accent)
  })

  it('hands the accent to the community picker on Android', async () => {
    Platform.OS = 'android'
    await renderPicker()

    expect(screen.getByTestId(PICKER).props.modifiers).toContainEqual({
      $type: 'tint',
      tint: { type: 'color', color: color.text.accent },
    })
  })

  // The inline calendar, not the compact button that opens one: "Outra data" has already
  // been pressed, and a second press to see the days would be one tap too many.
  it('lays the calendar out in full on iOS', async () => {
    Platform.OS = 'ios'
    await renderPicker()

    expect(screen.getByTestId(PICKER).props.modifiers).toContainEqual({
      $type: 'datePickerStyle',
      style: 'graphical',
    })
  })
})
