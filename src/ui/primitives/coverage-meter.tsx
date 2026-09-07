import type { ReactNode } from 'react'
import { StyleSheet, View, type ViewStyle } from 'react-native'

import { borderWidth, color, coverageUnit, radius, spacing } from '@/ui/tokens'

/** Props for {@link CoverageMeter}. */
export interface CoverageMeterProps {
  /** How many units are filled. Values above `total` simply fill every unit. */
  readonly covered: number
  /** How many units are drawn. Whole months, as validated by the domain. */
  readonly total: number
  /** Exposes the element to tests. */
  readonly testID?: string | undefined
}

/**
 * Months of coverage, drawn as countable units.
 *
 * The app's real unit is not currency but time — "how long could I live on this" — and a
 * figure in reais answers that only after arithmetic the user has to do themselves. A
 * fixed grid of squares is countable at a glance and makes two durations comparable
 * without reading either number, which a percentage bar cannot do: a bar renders three
 * months and twenty-four months as the same full sweep.
 *
 * Decorative, and hidden from assistive technology on purpose. It depicts a count that is
 * always stated in words beside it, so exposing it would make a screen reader announce the
 * same fact twice — once as prose and once as a run of empty views. This is the same
 * division `ChartFrame` makes: the picture is for the eye, the sentence is the content.
 *
 * Caps at whatever `total` it is handed. FR-002 bounds coverage at 24 months and
 * `validateCoverageMonths` enforces it before any figure reaches a screen, so the guard
 * against an absurd count lives at the edge where there is a message to give the user,
 * rather than here where there would only be a silently truncated row.
 *
 * @param props - See {@link CoverageMeterProps}
 * @returns The rendered meter
 */
export function CoverageMeter({ covered, total, testID }: CoverageMeterProps): ReactNode {
  return (
    <View
      style={styles.meter}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={testID}
    >
      {Array.from({ length: total }, (_unit, index) => (
        <View
          key={index}
          style={[styles.unit, index < covered ? styles.covered : styles.uncovered]}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  // Wraps rather than shrinking: twenty-four units do not fit across a narrow screen, and
  // units that changed size with the count would stop being comparable between options.
  meter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  } satisfies ViewStyle,
  unit: {
    width: coverageUnit,
    height: coverageUnit,
    borderRadius: radius.none,
  } satisfies ViewStyle,
  covered: {
    backgroundColor: color.filled.accent.background,
  } satisfies ViewStyle,
  // Outlined rather than filled pale: an empty unit has to stay countable against the
  // page, and a fill close enough to the ground to read as "empty" is too close to it to
  // be seen at all.
  uncovered: {
    backgroundColor: color.background.sunken,
    borderWidth: borderWidth.control,
    borderColor: color.boundary.control,
  } satisfies ViewStyle,
})
