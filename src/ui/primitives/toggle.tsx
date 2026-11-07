import type { ReactNode } from 'react'
import { StyleSheet, Switch, View, type ViewStyle } from 'react-native'

import { Text } from '@/ui/primitives/text'
import { color, minimumTouchTarget, spacing } from '@/ui/tokens'

/** Props for {@link Toggle}. */
export interface ToggleProps {
  /** What the switch turns on, which is also its accessible name. */
  readonly label: string
  /** Whether it is on. */
  readonly value: boolean
  /** Called with the new value when the user flips it. */
  readonly onChange: (value: boolean) => void
  /** Exposes the switch itself to tests. */
  readonly testID?: string | undefined
}

/**
 * A setting that is on or off, with its label beside it.
 *
 * The platform's own switch, because it is the control users already know how to operate
 * and both screen readers announce it as one. Named with the visible label: without that
 * it would be read as "switch, off" and nothing more. On, it takes the single accent; off,
 * the control boundary, so its state never rests on colour alone — the thumb's position
 * carries it too.
 *
 * @param props - See {@link ToggleProps}
 * @returns The rendered row
 */
export function Toggle({ label, value, onChange, testID }: ToggleProps): ReactNode {
  return (
    <View style={styles.row}>
      <View style={styles.label}>
        <Text variant="label">{label}</Text>
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        trackColor={{ false: color.boundary.control, true: color.filled.accent.background }}
        thumbColor={color.background.card}
        ios_backgroundColor={color.boundary.control}
        testID={testID}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    minHeight: minimumTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  } satisfies ViewStyle,
  // Takes the room the switch leaves, so a long label wraps instead of pushing it off.
  label: { flex: 1 } satisfies ViewStyle,
})
