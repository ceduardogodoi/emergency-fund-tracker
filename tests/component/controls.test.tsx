import { fireEvent, render, screen } from '@testing-library/react-native'

import { Chip, Stepper, Toggle } from '@/ui/primitives'
import { color, minimumTouchTarget } from '@/ui/tokens'

/**
 * The three small controls the reminders screen is built from (T133): a labelled switch,
 * a chip in a group where one is chosen, and a stepper. What is pinned is what a screen
 * reader is told, since each of them shows less on screen than it has to announce.
 */
describe('Toggle', () => {
  it('shows its label and its value, and reports a change', async () => {
    const onChange = jest.fn()
    await render(<Toggle label="Lembrar-me" value={false} onChange={onChange} testID="toggle" />)

    expect(screen.getByText('Lembrar-me')).toBeOnTheScreen()
    const toggle = screen.getByTestId('toggle')
    expect(toggle.props.value).toBe(false)

    await fireEvent(toggle, 'valueChange', true)
    expect(onChange).toHaveBeenCalledWith(true)
  })

  // The visible label sits beside the switch; without its own name the switch would be
  // announced as "switch, off" and nothing more.
  it('names the switch with its label', async () => {
    await render(<Toggle label="Lembrar-me" value onChange={jest.fn()} />)

    expect(screen.getByRole('switch', { name: 'Lembrar-me' })).toBeOnTheScreen()
  })
})

describe('Chip', () => {
  it('announces itself as a radio with its state, under its accessible name', async () => {
    await render(
      <Chip label="17" accessibilityLabel="Dia 17" selected onSelect={jest.fn()} testID="chip" />,
    )

    const chip = screen.getByRole('radio', { name: 'Dia 17' })
    expect(chip.props.accessibilityState).toMatchObject({ selected: true })
    expect(screen.getByText('17')).toBeOnTheScreen()
  })

  it('reports a press', async () => {
    const onSelect = jest.fn()
    await render(<Chip label="Qui" selected={false} onSelect={onSelect} testID="chip" />)

    await fireEvent.press(screen.getByTestId('chip'))
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  // Selection is shown by fill and border together, never by colour alone (FR-049).
  it('shows selection by its border as well as its fill', async () => {
    await render(
      <>
        <Chip label="1" selected onSelect={jest.fn()} testID="on" />
        <Chip label="2" selected={false} onSelect={jest.fn()} testID="off" />
      </>,
    )

    expect(screen.getByTestId('on')).toHaveStyle({ borderColor: color.boundary.focus })
    expect(screen.getByTestId('off')).toHaveStyle({ borderColor: color.boundary.control })
  })

  it('is at least the minimum touch target in both directions', async () => {
    await render(<Chip label="1" selected={false} onSelect={jest.fn()} testID="chip" />)

    expect(screen.getByTestId('chip')).toHaveStyle({
      minWidth: minimumTouchTarget,
      minHeight: minimumTouchTarget,
    })
  })
})

describe('Stepper', () => {
  function renderStepper(onIncrease = jest.fn(), onDecrease = jest.fn()): Promise<unknown> {
    return render(
      <Stepper
        label="Hora"
        value="09"
        increaseLabel="Uma hora a mais"
        decreaseLabel="Uma hora a menos"
        onIncrease={onIncrease}
        onDecrease={onDecrease}
        testID="hour"
      />,
    )
  }

  it('shows its label and value', async () => {
    await renderStepper()

    expect(screen.getByText('Hora')).toBeOnTheScreen()
    expect(screen.getByTestId('hour-value')).toHaveTextContent('09')
  })

  it('steps with its buttons', async () => {
    const onIncrease = jest.fn()
    const onDecrease = jest.fn()
    await renderStepper(onIncrease, onDecrease)

    await fireEvent.press(screen.getByTestId('hour-increase'))
    await fireEvent.press(screen.getByTestId('hour-decrease'))
    await fireEvent.press(screen.getByTestId('hour-decrease'))

    expect(onIncrease).toHaveBeenCalledTimes(1)
    expect(onDecrease).toHaveBeenCalledTimes(2)
  })

  // A screen reader meets one adjustable control, announced with its value, and changes it
  // with a swipe — rather than finding two buttons named only "plus" and "minus".
  it('is one adjustable control to a screen reader, announcing its value', async () => {
    const onIncrease = jest.fn()
    const onDecrease = jest.fn()
    await renderStepper(onIncrease, onDecrease)

    const stepper = screen.getByTestId('hour-stepper')
    expect(stepper.props.accessibilityRole).toBe('adjustable')
    expect(stepper.props.accessibilityLabel).toBe('Hora')
    expect(stepper.props.accessibilityValue).toEqual({ text: '09' })

    await fireEvent(stepper, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } })
    await fireEvent(stepper, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } })
    expect(onIncrease).toHaveBeenCalledTimes(1)
    expect(onDecrease).toHaveBeenCalledTimes(1)
  })

  it('names its buttons for what they do', async () => {
    await renderStepper()

    expect(screen.getByTestId('hour-increase').props.accessibilityLabel).toBe('Uma hora a mais')
    expect(screen.getByTestId('hour-decrease').props.accessibilityLabel).toBe('Uma hora a menos')
  })
})
