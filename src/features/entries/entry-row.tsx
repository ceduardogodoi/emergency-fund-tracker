import type { ReactNode } from 'react'
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native'

import { useServices } from '@/runtime/services-context'
import type { EntryType, LedgerEntry } from '@/domain/ledger/types'
import { Text, type TextTone } from '@/ui/primitives'
import { strings } from '@/ui/strings'
import { borderWidth, color, opacity, radius, spacing } from '@/ui/tokens'

/** Props for {@link EntryRow}. */
export interface EntryRowProps {
  /** The entry the row describes. */
  readonly entry: LedgerEntry
  /** Called when the row is pressed — the way to correcting or deleting the entry. */
  readonly onPress: () => void
}

/**
 * The colour each kind of entry is written in.
 *
 * The fourth signal, and the only one a reader may not have: the word, the mark, and the
 * sign in `strings.entries.kinds` say the same thing without it (FR-014, FR-049).
 */
const TONES = {
  opening: 'primary',
  contribution: 'positive',
  withdrawal: 'negative',
} as const satisfies Record<EntryType, TextTone>

/**
 * One entry in the history: what kind it is, how much, when, and what was said about it.
 *
 * Read as a single element by a screen reader, in the order it is laid out — kind, amount,
 * date, note — so a row is one stop rather than four. The mark is left out of that: it
 * repeats the word beside it for the eye, and announced it would be a stray "mais" before
 * every contribution.
 *
 * The whole row is the control (FR-011). A button drawn inside it would be a second stop
 * per entry for a screen reader, and a smaller target for a thumb.
 *
 * @param props - See {@link EntryRowProps}
 * @returns The rendered row
 */
export function EntryRow({ entry, onPress }: EntryRowProps): ReactNode {
  const { format } = useServices()
  const kind = strings.entries.kinds[entry.type]
  const tone = TONES[entry.type]
  // A note for a contribution or an opening, a reason for a withdrawal. The ledger keeps
  // them apart because one is optional and the other is not; to a reader both are what was
  // written about the entry.
  const remark = entry.note ?? entry.withdrawalReason

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={strings.entries.rowHint}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      testID="entry-row"
    >
      <Unannounced style={styles.mark}>
        <Text variant="label" tone={tone} align="center">
          {kind.mark}
        </Text>
      </Unannounced>
      <View style={styles.body}>
        <View style={styles.heading}>
          <Text variant="label">{kind.label}</Text>
          <Text variant="label" tone={tone} numeric testID="entry-amount">
            {kind.amount(format.money(entry.amount))}
          </Text>
        </View>
        <Text variant="caption" tone="secondary">
          {format.date(entry.date)}
        </Text>
        {remark === null ? null : <Text tone="secondary">{remark}</Text>}
      </View>
      <Unannounced style={styles.opens}>
        <Text variant="heading" tone="secondary">
          {strings.entries.rowOpens}
        </Text>
      </Unannounced>
    </Pressable>
  )
}

/** Props for {@link Unannounced}. */
interface UnannouncedProps {
  /** Where the drawing sits in the row. */
  readonly style: ViewStyle
  /** What is drawn. */
  readonly children: ReactNode
}

/**
 * Drawn for the eye and kept from a screen reader: the parts of a row that repeat, as a
 * shape, what the row already says in words.
 */
function Unannounced({ style, children }: UnannouncedProps): ReactNode {
  return (
    <View style={style} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: color.background.card,
    borderRadius: radius.none,
  } satisfies ViewStyle,
  pressed: { opacity: opacity.pressed } satisfies ViewStyle,
  // A square with an edge, like an empty unit in the coverage meter: the mark is a glyph
  // set in the app's own face rather than an icon from a set, which would bring a second
  // drawing style — and a dependency — for three shapes.
  mark: {
    width: spacing.xl,
    height: spacing.xl,
    borderWidth: borderWidth.control,
    borderColor: color.boundary.control,
    borderRadius: radius.none,
    justifyContent: 'center',
  } satisfies ViewStyle,
  body: { flex: 1, gap: spacing.xs } satisfies ViewStyle,
  // Beside the body rather than inside it, so the body's wrapping never moves it, and
  // centred on the row so it stays beside the entry however many lines the entry takes.
  opens: { justifyContent: 'center' } satisfies ViewStyle,
  // Wraps, so at the largest text size the amount drops under the word instead of
  // squeezing it (FR-050).
  heading: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    columnGap: spacing.sm,
  } satisfies ViewStyle,
})
