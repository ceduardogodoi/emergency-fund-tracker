import { screen } from '@testing-library/react-native'
import type { ReactElement } from 'react'
import type { ViewProps } from 'react-native'

import { color } from '@/ui/tokens'

/**
 * Reading a rendered `CoverageMeter` back: how many units it drew, and how many are filled.
 *
 * Shared because the meter is asserted on twice — as a primitive, and on Home, where what
 * it is handed is the point. The meter is hidden from assistive technology, so both queries
 * opt in to hidden elements.
 */

/**
 * The units of the meter with this test id, which are its children: counting them is
 * asking "how many months".
 *
 * @param testID The meter's test id.
 * @returns Every unit drawn, filled or not.
 */
export function meterUnits(testID: string): ReactElement<ViewProps>[] {
  return screen.getByTestId(testID, { includeHiddenElements: true }).props.children
}

/**
 * The units of the meter with this test id that are filled.
 *
 * @param testID The meter's test id.
 * @returns The filled units.
 */
export function filledUnits(testID: string): ReactElement<ViewProps>[] {
  return meterUnits(testID).filter(isFilled)
}

/**
 * Whether a rendered unit carries the accent fill, which is what "covered" looks like.
 *
 * The units are the elements the meter rendered, so they are `ReactElement`s and their
 * props are `ViewProps` — not the `TestInstance` a query would have returned. `style` is
 * narrowed rather than assumed: `StyleProp` admits an object, a falsy value, or a nested
 * array, and only this component's own use of it makes an array the right expectation.
 */
function isFilled(unit: ReactElement<ViewProps>): boolean {
  const style = unit.props.style
  if (!Array.isArray(style)) {
    return false
  }
  return style.some(
    (layer) =>
      typeof layer === 'object' &&
      layer !== null &&
      'backgroundColor' in layer &&
      layer.backgroundColor === color.filled.accent.background,
  )
}
