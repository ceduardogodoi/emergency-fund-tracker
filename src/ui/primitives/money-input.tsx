import type { ReactNode } from 'react'

import { money, type Money } from '@/domain/money/money'
import { Field } from '@/ui/primitives/field'

/** Everything that is not a digit, stripped before the text is read as an amount. */
const NON_DIGITS = /\D/g

/** Props for {@link MoneyInput}. */
export interface MoneyInputProps {
  /** The field's visible label. */
  readonly label: string
  /** The current amount, in minor units. */
  readonly value: Money
  /** Called with the amount the typed digits denote, in minor units. */
  readonly onChangeValue: (value: Money) => void
  /**
   * Renders the amount for display.
   *
   * Injected rather than built here: the currency's exponent and the locale's separators
   * live in the one formatter (`src/ui/format`), and the ui-contract's copy rule holds that
   * no component formats money itself. A primitive that knew the currency would be the
   * second place that knowledge lives.
   */
  readonly format: (amount: Money) => string
  /** Guidance shown under the input while it is valid. */
  readonly help?: string | undefined
  /** The validation message, shown in place of {@link MoneyInputProps.help}. */
  readonly error?: string | undefined
  /** Announces the field as required. */
  readonly required?: boolean | undefined
  /** Exposes the input to tests. */
  readonly testID?: string | undefined
}

/**
 * Currency entry that emits `Money` in minor units — never a float, never a raw string.
 *
 * The digits typed are the minor units, read left to right: `1234` is 12,34 and the
 * separator is placed by the formatter rather than by the user. This is what makes the
 * input unambiguous. Parsing a written amount instead would have to decide whether the `.`
 * in `1.234` separates thousands or decimals — a guess that is wrong by a factor of 100
 * in the direction that overstates a balance, and one no amount of validation can recover
 * because both readings are legitimate.
 *
 * Text beyond exact integer precision is dropped rather than clamped: silently substituting
 * a different number is the failure mode `money` throws to prevent, and a stalled field
 * tells the user their input was not accepted.
 *
 * @param props - See {@link MoneyInputProps}
 * @returns The rendered money input
 */
export function MoneyInput({
  label,
  value,
  onChangeValue,
  format,
  help,
  error,
  required,
  testID,
}: MoneyInputProps): ReactNode {
  const handleChangeText = (text: string): void => {
    const digits = text.replace(NON_DIGITS, '')
    // An empty field is zero, not absence: the caller holds a `Money`, so there is no
    // value it could be given that means "nothing typed".
    const minorUnits = digits === '' ? 0 : Number.parseInt(digits, 10)
    if (!Number.isSafeInteger(minorUnits)) {
      return
    }
    onChangeValue(money(minorUnits))
  }

  return (
    <Field
      label={label}
      value={format(value)}
      onChangeText={handleChangeText}
      keyboardType="number-pad"
      help={help}
      error={error}
      required={required}
      prominent
      testID={testID}
    />
  )
}
