import type { ReactNode } from 'react'
import {
  StyleSheet,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextStyle,
  type ViewStyle,
} from 'react-native'

import { Text } from '@/ui/primitives/text'
import { strings } from '@/ui/strings'
import { color, minimumTouchTarget, radius, spacing, typography } from '@/ui/tokens'

/** Props for {@link Field}. */
export interface FieldProps {
  /** The field's visible label, which is also the base of its accessible name. */
  readonly label: string
  /** The current text. The field is controlled; it holds no state of its own. */
  readonly value: string
  /** Called with the full text after every edit. */
  readonly onChangeText: (value: string) => void
  /** Guidance shown under the input while it is valid. */
  readonly help?: string | undefined
  /**
   * The validation message, shown in place of {@link FieldProps.help}.
   *
   * Its presence is what marks the field invalid — there is no separate `invalid` flag,
   * because a field that is invalid without saying why is the state the ui-contract's
   * inline-error rule exists to prevent.
   */
  readonly error?: string | undefined
  /** Announces the field as required. */
  readonly required?: boolean | undefined
  /** Which keyboard to raise. Defaults to the standard one. */
  readonly keyboardType?: KeyboardTypeOptions | undefined
  /** Exposes the input to tests. */
  readonly testID?: string | undefined
}

/*
 * The optionals above are written `?: T | undefined` rather than `?: T`. `tsconfig.json`
 * sets `exactOptionalPropertyTypes`, which otherwise makes passing an explicit `undefined`
 * an error — and a wrapper like `MoneyInput` forwards props it may not have received. The
 * alternative is a conditional spread per prop at every call site, which buys nothing here:
 * absent and `undefined` mean the same thing to this component.
 */

/**
 * A labelled text input, with the wiring between the label, the input, and its messages.
 *
 * React Native has no `aria-describedby`: a screen reader reads the input's own name and
 * hint and nothing else in the group. So the label and the help-or-error text are given to
 * the input as `accessibilityLabel` and `accessibilityHint` rather than merely rendered
 * beside it — otherwise the guidance and the validation message would be visible to sighted
 * users and silent to everyone else.
 *
 * @param props - See {@link FieldProps}
 * @returns The rendered field
 */
export function Field({
  label,
  value,
  onChangeText,
  help,
  error,
  required = false,
  keyboardType,
  testID,
}: FieldProps): ReactNode {
  const invalid = error !== undefined
  const message = error ?? help
  return (
    <View style={styles.field}>
      <Text variant="label">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        accessibilityLabel={required ? strings.accessibility.requiredFieldName(label) : label}
        accessibilityHint={message}
        style={[styles.input, invalid ? styles.invalid : undefined]}
        placeholderTextColor={color.text.secondary}
        testID={testID}
      />
      {message === undefined ? null : (
        // Announced when it appears, so a user who has already moved past the field hears
        // the problem rather than discovering it on submit. Help text is not announced
        // again this way — it was already read as the input's hint.
        <View accessibilityLiveRegion={invalid ? 'polite' : 'none'}>
          <Text variant="caption" tone={invalid ? 'negative' : 'secondary'}>
            {message}
          </Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs } satisfies ViewStyle,
  input: {
    minHeight: minimumTouchTarget,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: color.boundary.control,
    borderRadius: radius.sm,
    backgroundColor: color.background.page,
    color: color.text.primary,
    fontSize: typography.body.fontSize,
  } satisfies TextStyle,
  // Colour is never the only signal (FR-014's rule, applied here too) — the border is what
  // a sighted user notices first, and the message below says the same thing in words.
  invalid: { borderColor: color.text.negative } satisfies TextStyle,
})
