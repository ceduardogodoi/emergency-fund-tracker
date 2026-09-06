import type { ReactNode } from 'react'

import { useServices } from '@/runtime/services-context'
import type { Money } from '@/domain/money/money'
import { Button, Card, MoneyInput, Text } from '@/ui/primitives'
import { strings } from '@/ui/strings'

/** Props for {@link TargetPreview}. */
export interface TargetPreviewProps {
  /** The figure the target is derived from. */
  readonly monthlyExpenses: Money
  /** The duration it is multiplied by. */
  readonly coverageMonths: number
  /** The target as it stands — the calculated figure, or the one the user typed. */
  readonly target: Money
  /**
   * The user's own figure, or null while the calculated one is in force.
   *
   * Null is not "no target": it is the statement that the target is derived. Keeping the
   * two apart is what lets the app record which of them the active target is (FR-005) —
   * a number the user typed is not a number the app worked out.
   */
  readonly override: Money | null
  /** Called with a typed figure, or null to go back to the calculated one. */
  readonly onOverrideChange: (value: Money | null) => void
  /** A message about the target itself, shown under the input. */
  readonly error?: string | undefined
}

/**
 * The target, with the arithmetic that produced it (FR-004) and a way to disagree (FR-005).
 *
 * The derivation is shown rather than described. A user who thinks the figure is wrong can
 * only tell which half to change — the expenses or the duration — if both are in front of
 * them, and a target presented as a bare number invites the override even when the inputs
 * were what was actually off.
 *
 * @param props - See {@link TargetPreviewProps}
 * @returns The rendered preview
 */
export function TargetPreview({
  monthlyExpenses,
  coverageMonths,
  target,
  override,
  onOverrideChange,
  error,
}: TargetPreviewProps): ReactNode {
  const { format } = useServices()

  return (
    <Card testID="target-preview">
      <Text variant="label" tone="secondary">
        {strings.goal.targetLabel}
      </Text>
      <Text variant="display" numeric testID="target-amount">
        {format.money(target)}
      </Text>
      {override === null ? (
        <DerivedTarget
          monthlyExpenses={monthlyExpenses}
          coverageMonths={coverageMonths}
          target={target}
          onOverride={onOverrideChange}
        />
      ) : (
        <TypedTarget value={override} onChange={onOverrideChange} error={error} />
      )}
    </Card>
  )
}

/** Props for {@link DerivedTarget}. */
interface DerivedTargetProps {
  readonly monthlyExpenses: Money
  readonly coverageMonths: number
  readonly target: Money
  readonly onOverride: (value: Money) => void
}

/**
 * The calculated target, shown as the multiplication that produced it.
 *
 * Switching to a manual figure seeds the input with this one, so the user edits a number
 * rather than facing an empty field: they are adjusting a suggestion, and the screen
 * should say so.
 */
function DerivedTarget({
  monthlyExpenses,
  coverageMonths,
  target,
  onOverride,
}: DerivedTargetProps): ReactNode {
  const { format } = useServices()
  return (
    <>
      <Text variant="caption" tone="secondary" numeric>
        {strings.goal.derivation(
          format.money(monthlyExpenses),
          strings.coverageDuration(coverageMonths),
          format.money(target),
        )}
      </Text>
      <Button
        label={strings.goal.overrideAction}
        variant="secondary"
        onPress={() => {
          onOverride(target)
        }}
        testID="override-target"
      />
    </>
  )
}

/** Props for {@link TypedTarget}. */
interface TypedTargetProps {
  readonly value: Money
  readonly onChange: (value: Money | null) => void
  readonly error: string | undefined
}

/** The target the user is naming themselves, with the way back to the calculated one. */
function TypedTarget({ value, onChange, error }: TypedTargetProps): ReactNode {
  const { format } = useServices()
  return (
    <>
      <MoneyInput
        label={strings.goal.overrideLabel}
        value={value}
        onChangeValue={onChange}
        format={format.money}
        error={error}
        required
        testID="target-input"
      />
      <Button
        label={strings.goal.calculatedAction}
        variant="secondary"
        onPress={() => {
          onChange(null)
        }}
        testID="use-calculated"
      />
    </>
  )
}
