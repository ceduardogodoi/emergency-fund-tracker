import { render, screen, userEvent } from '@testing-library/react-native'

import { ConfirmSheet } from '@/ui/primitives'
import { strings } from '@/ui/strings'
import { color } from '@/ui/tokens'

/** The copy every destructive action has to supply. Reused so each test reads shorter. */
const COPY = {
  title: 'Excluir lançamento',
  body: 'O lançamento sai do histórico e o saldo é recalculado. Não é possível desfazer.',
  confirmLabel: strings.action.delete,
} as const

describe('ConfirmSheet', () => {
  it('renders nothing until it is opened', async () => {
    await render(<ConfirmSheet {...COPY} open={false} onConfirm={jest.fn()} onCancel={jest.fn()} />)
    expect(screen.queryByText(COPY.title)).toBeNull()
  })

  // ui-contract: the sheet states what will happen and what is lost.
  it('states what happens and what is lost', async () => {
    await render(<ConfirmSheet {...COPY} open onConfirm={jest.fn()} onCancel={jest.fn()} />)
    expect(screen.getByText(COPY.title)).toBeTruthy()
    expect(screen.getByText(COPY.body)).toBeTruthy()
  })

  // ui-contract: labelled with the verb rather than "OK", so the button says what it does.
  it('labels its action with the verb the caller gave it', async () => {
    await render(<ConfirmSheet {...COPY} open onConfirm={jest.fn()} onCancel={jest.fn()} />)
    expect(screen.getByRole('button', { name: strings.action.delete })).toBeTruthy()
    expect(screen.queryByRole('button', { name: strings.action.confirm })).toBeNull()
  })

  it('confirms', async () => {
    const onConfirm = jest.fn()
    await render(<ConfirmSheet {...COPY} open onConfirm={onConfirm} onCancel={jest.fn()} />)
    await userEvent.press(screen.getByRole('button', { name: strings.action.delete }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('cancels', async () => {
    const onCancel = jest.fn()
    await render(<ConfirmSheet {...COPY} open onConfirm={jest.fn()} onCancel={onCancel} />)
    await userEvent.press(screen.getByRole('button', { name: strings.action.cancel }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('takes focus as a dialog named by its own title', async () => {
    await render(<ConfirmSheet {...COPY} open onConfirm={jest.fn()} onCancel={jest.fn()} />)
    const sheet = screen.getByLabelText(COPY.title)
    expect(sheet).toHaveProp('accessibilityViewIsModal', true)
    expect(sheet).toHaveProp('accessibilityRole', 'alert')
  })

  it('draws the action destructively, so the button reads as the loss it is', async () => {
    await render(<ConfirmSheet {...COPY} open onConfirm={jest.fn()} onCancel={jest.fn()} />)
    expect(screen.getByRole('button', { name: strings.action.delete })).toHaveStyle({
      backgroundColor: color.filled.negative.background,
    })
  })
})
