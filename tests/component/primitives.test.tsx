import { render, screen, userEvent, within } from '@testing-library/react-native'
import { View } from 'react-native'

import { SCREEN_SCROLL_TEST_ID, Button, Card, Screen, Text } from '@/ui/primitives'
import { color, minimumTouchTarget, typography } from '@/ui/tokens'

/**
 * React Native Testing Library v14 aligned with React 19 by making `render` asynchronous.
 * Every component test must `await render(...)` before querying — without the await,
 * `screen` is never populated and the failure reads "`render` function has not been
 * called", which points nowhere near the actual mistake.
 */
describe('Text', () => {
  it('renders its content', async () => {
    await render(<Text>Saldo</Text>)
    expect(screen.getByText('Saldo')).toBeTruthy()
  })

  it('applies the type style its variant names, rather than a size of its own', async () => {
    await render(<Text variant="display">1234</Text>)
    expect(screen.getByText('1234')).toHaveStyle({
      fontSize: typography.display.fontSize,
      lineHeight: typography.display.lineHeight,
    })
  })

  it('defaults to body copy in the primary tone, so a bare Text is already legible', async () => {
    await render(<Text>Corpo</Text>)
    expect(screen.getByText('Corpo')).toHaveStyle({
      fontSize: typography.body.fontSize,
      color: color.text.primary,
    })
  })

  it('lines up digits when asked, which is what makes a column of amounts scannable', async () => {
    await render(<Text numeric>1234</Text>)
    expect(screen.getByText('1234')).toHaveStyle({ fontVariant: ['tabular-nums'] })
  })
})

describe('Button', () => {
  it('announces itself as a button carrying its label', async () => {
    await render(<Button label="Salvar" onPress={jest.fn()} />)
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeTruthy()
  })

  it('calls onPress when pressed', async () => {
    const onPress = jest.fn()
    await render(<Button label="Salvar" onPress={onPress} />)
    await userEvent.press(screen.getByRole('button', { name: 'Salvar' }))
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('does not call onPress while disabled, and says so to a screen reader', async () => {
    const onPress = jest.fn()
    await render(<Button label="Salvar" onPress={onPress} disabled />)
    const button = screen.getByRole('button', { name: 'Salvar' })
    await userEvent.press(button)
    expect(onPress).not.toHaveBeenCalled()
    expect(button).toBeDisabled()
  })

  it('meets the minimum touch target on every variant', async () => {
    await render(
      <>
        <Button label="Um" variant="primary" onPress={jest.fn()} />
        <Button label="Dois" variant="secondary" onPress={jest.fn()} />
        <Button label="Três" variant="destructive" onPress={jest.fn()} />
      </>,
    )
    for (const name of ['Um', 'Dois', 'Três']) {
      expect(screen.getByRole('button', { name })).toHaveStyle({
        minHeight: minimumTouchTarget,
      })
    }
  })

  it('pairs each variant with the foreground audited against its fill', async () => {
    await render(<Button label="Excluir" variant="destructive" onPress={jest.fn()} />)
    expect(screen.getByRole('button', { name: 'Excluir' })).toHaveStyle({
      backgroundColor: color.filled.negative.background,
    })
    expect(screen.getByText('Excluir')).toHaveStyle({ color: color.filled.negative.text })
  })

  // FR-049: an icon-only or otherwise unlabelled control is unusable by screen reader.
  // The label prop is required by the type, and this asserts it reaches the tree.
  it('never renders without an accessible name', async () => {
    await render(<Button label="Confirmar" onPress={jest.fn()} />)
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeTruthy()
  })
})

describe('Card', () => {
  it('renders its children on the card surface', async () => {
    await render(
      <Card testID="card">
        <Text>Conteúdo</Text>
      </Card>,
    )
    expect(screen.getByText('Conteúdo')).toBeTruthy()
    expect(screen.getByTestId('card')).toHaveStyle({ backgroundColor: color.background.card })
  })
})

describe('Screen', () => {
  it('renders its children inset from the edges of the display', async () => {
    await render(
      <Screen>
        <View testID="content" />
      </Screen>,
    )
    expect(screen.getByTestId('content')).toBeTruthy()
  })

  it('exposes a title to the screen reader as a heading', async () => {
    await render(
      <Screen title="Início">
        <View />
      </Screen>,
    )
    expect(screen.getByRole('header', { name: 'Início' })).toBeTruthy()
  })

  // Whether a screen fits is not something the screen can know: it depends on the device,
  // the reader's text size (FR-050), and how much they have entered. When it does not fit,
  // nothing is clipped or flagged — the last control is simply unreachable, and only for
  // some people. So every screen scrolls, and the default is what makes that true.
  it('puts its content inside a scrolling container', async () => {
    await render(
      <Screen title="Início">
        <View testID="content" />
      </Screen>,
    )
    const scroll = screen.getByTestId(SCREEN_SCROLL_TEST_ID)
    expect(within(scroll).getByTestId('content')).toBeTruthy()
    expect(within(scroll).getByRole('header', { name: 'Início' })).toBeTruthy()
  })

  // Asserted as a prop because there is no other way to reach it: the behaviour only
  // appears with a real keyboard on screen. Without it, the first tap on a control while
  // the keyboard is open only dismisses the keyboard — so saving takes two presses and
  // looks like the first was ignored.
  it('keeps a tap working while the keyboard is open', async () => {
    await render(
      <Screen>
        <View />
      </Screen>,
    )
    expect(screen.getByTestId(SCREEN_SCROLL_TEST_ID).props.keyboardShouldPersistTaps).toBe(
      'handled',
    )
  })

  // A virtualised list has to own its scrolling. Nested inside a scroll view it is given
  // unbounded height, renders every row, and stops virtualising at all.
  it('yields scrolling to content that brings its own', async () => {
    await render(
      <Screen scrolls={false}>
        <View testID="content" />
      </Screen>,
    )
    expect(screen.queryByTestId(SCREEN_SCROLL_TEST_ID)).toBeNull()
    expect(screen.getByTestId('content')).toBeTruthy()
  })
})
