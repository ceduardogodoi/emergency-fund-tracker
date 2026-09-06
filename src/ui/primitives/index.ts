/**
 * The UI primitives — the only components that draw anything directly.
 *
 * Every screen composes these. Nothing outside this directory may name a colour, a size,
 * or a spacing value; the lint rules in `eslint.config.mjs` reject the literal, and these
 * components are where the tokens are read.
 *
 * A pure barrel by design: `jest.config.mjs` excludes `src/**\/index.ts` from coverage, so
 * anything with logic in it would sit outside the floor.
 */
export { Button, type ButtonProps, type ButtonVariant } from './button'
export { Card, type CardProps } from './card'
export { Choice, type ChoiceProps } from './choice'
export { ConfirmSheet, type ConfirmSheetProps } from './confirm-sheet'
export { ErrorState, type ErrorStateProps } from './error-state'
export { Field, type FieldProps } from './field'
export { LoadingState } from './loading-state'
export { MoneyInput, type MoneyInputProps } from './money-input'
export { SCREEN_SCROLL_TEST_ID, Screen, type ScreenProps } from './screen'
export { StateView, type StateViewProps, type ViewState } from './state-view'
export { Text, type TextProps, type TextTone, type TextVariant } from './text'
