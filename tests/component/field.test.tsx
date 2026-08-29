import { fireEvent, render, screen } from '@testing-library/react-native'

import { currencyCode } from '@/domain/money/currency'
import { money } from '@/domain/money/money'
import { Field, MoneyInput } from '@/ui/primitives'
import { createFormatters } from '@/ui/format'
import { strings } from '@/ui/strings'
import { minimumTouchTarget } from '@/ui/tokens'

/**
 * React Native Testing Library v14 aligned with React 19 by making `render` asynchronous.
 * Every component test must `await render(...)` before querying.
 *
 * Text is entered with `fireEvent.changeText` rather than `userEvent.type` throughout.
 * `type` fires one change per keystroke, which for a controlled input means asserting on
 * the last of several calls; `changeText` states the input the field actually received.
 */
const format = createFormatters({ currency: currencyCode('BRL'), locale: 'pt-BR' }).money

describe('Field', () => {
  it('names its input with its label, so the two are one control to a screen reader', async () => {
    await render(<Field label="Apelido" value="" onChangeText={jest.fn()} />)
    expect(screen.getByLabelText('Apelido')).toBeTruthy()
  })

  it('shows the label on screen as well as announcing it', async () => {
    await render(<Field label="Apelido" value="" onChangeText={jest.fn()} />)
    expect(screen.getByText('Apelido')).toBeTruthy()
  })

  it('reports what was typed', async () => {
    const onChangeText = jest.fn()
    await render(<Field label="Apelido" value="" onChangeText={onChangeText} />)
    fireEvent.changeText(screen.getByLabelText('Apelido'), 'Reserva')
    expect(onChangeText).toHaveBeenCalledWith('Reserva')
  })

  it('announces a requirement rather than leaving it to a visual marker', async () => {
    await render(<Field label="Apelido" value="" onChangeText={jest.fn()} required />)
    expect(screen.getByLabelText(strings.accessibility.requiredFieldName('Apelido'))).toBeTruthy()
  })

  it('shows help text and gives it to the screen reader as the input hint', async () => {
    await render(
      <Field
        label="Apelido"
        value=""
        onChangeText={jest.fn()}
        help="Como você chama esta reserva"
      />,
    )
    expect(screen.getByText('Como você chama esta reserva')).toBeTruthy()
    expect(screen.getByLabelText('Apelido')).toHaveProp(
      'accessibilityHint',
      'Como você chama esta reserva',
    )
  })

  // FR-049, and the ui-contract copy rule: a validation error appears inline, in words.
  it('replaces the hint with the error, so the problem is heard and not only seen', async () => {
    await render(
      <Field
        label="Apelido"
        value=""
        onChangeText={jest.fn()}
        help="Como você chama esta reserva"
        error="Informe um apelido"
      />,
    )
    expect(screen.getByText('Informe um apelido')).toBeTruthy()
    expect(screen.getByLabelText('Apelido')).toHaveProp('accessibilityHint', 'Informe um apelido')
  })

  it('meets the minimum touch target', async () => {
    await render(<Field label="Apelido" value="" onChangeText={jest.fn()} />)
    expect(screen.getByLabelText('Apelido')).toHaveStyle({ minHeight: minimumTouchTarget })
  })
})

describe('MoneyInput', () => {
  it('shows the amount through the injected formatter rather than formatting it itself', async () => {
    await render(
      <MoneyInput label="Valor" value={money(123_456)} onChangeValue={jest.fn()} format={format} />,
    )
    expect(screen.getByLabelText('Valor')).toHaveProp('value', format(money(123_456)))
  })

  it('emits minor units, so 1234 typed digits are 12,34 and never the float 1234', async () => {
    const onChangeValue = jest.fn()
    await render(
      <MoneyInput label="Valor" value={money(0)} onChangeValue={onChangeValue} format={format} />,
    )
    fireEvent.changeText(screen.getByLabelText('Valor'), '1234')
    expect(onChangeValue).toHaveBeenCalledWith(money(1_234))
  })

  it('reads only the digits, so a pasted formatted amount is not misread by a factor of 100', async () => {
    const onChangeValue = jest.fn()
    await render(
      <MoneyInput label="Valor" value={money(0)} onChangeValue={onChangeValue} format={format} />,
    )
    fireEvent.changeText(screen.getByLabelText('Valor'), 'R$ 1.234,56')
    expect(onChangeValue).toHaveBeenCalledWith(money(123_456))
  })

  it('treats a cleared field as zero rather than as a missing value', async () => {
    const onChangeValue = jest.fn()
    await render(
      <MoneyInput label="Valor" value={money(500)} onChangeValue={onChangeValue} format={format} />,
    )
    fireEvent.changeText(screen.getByLabelText('Valor'), '')
    expect(onChangeValue).toHaveBeenCalledWith(money(0))
  })

  it('ignores input beyond exact integer precision instead of emitting an unsafe amount', async () => {
    const onChangeValue = jest.fn()
    await render(
      <MoneyInput label="Valor" value={money(0)} onChangeValue={onChangeValue} format={format} />,
    )
    fireEvent.changeText(screen.getByLabelText('Valor'), '9'.repeat(20))
    expect(onChangeValue).not.toHaveBeenCalled()
  })

  it('opens the numeric keypad, because no letter is ever a valid amount', async () => {
    await render(
      <MoneyInput label="Valor" value={money(0)} onChangeValue={jest.fn()} format={format} />,
    )
    expect(screen.getByLabelText('Valor')).toHaveProp('keyboardType', 'number-pad')
  })

  it('carries the error and required wiring it inherits from Field', async () => {
    await render(
      <MoneyInput
        label="Valor"
        value={money(0)}
        onChangeValue={jest.fn()}
        format={format}
        required
        error="Informe um valor maior que zero"
      />,
    )
    const input = screen.getByLabelText(strings.accessibility.requiredFieldName('Valor'))
    expect(input).toHaveProp('accessibilityHint', 'Informe um valor maior que zero')
  })
})
