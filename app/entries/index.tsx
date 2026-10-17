import { useRouter } from 'expo-router'
import type { ReactNode } from 'react'
import { FlatList, StyleSheet, type ViewStyle } from 'react-native'

import { toViewState } from '@/runtime/query'
import type { LedgerEntry } from '@/domain/ledger/types'
import { EntryRow } from '@/features/entries/entry-row'
import { useEntries } from '@/features/entries/hooks'
import { Button, Card, Screen, StateView, Text } from '@/ui/primitives'
import { strings } from '@/ui/strings'
import { spacing } from '@/ui/tokens'

/**
 * The history: every entry in the ledger (FR-014).
 *
 * The one screen that does not scroll through `Screen`. A decade of entries is a few
 * thousand rows, which a list has to virtualise, and a virtualised list nested in a scroll
 * view is given unbounded height and renders all of them.
 *
 * @returns The rendered screen
 */
export default function HistoryScreen(): ReactNode {
  const entries = useEntries()

  return (
    <Screen title={strings.entries.historyTitle} scrolls={false}>
      <StateView
        state={toViewState(entries)}
        empty={() => <EmptyHistory />}
        ready={(recorded) => <HistoryList entries={recorded} />}
      />
    </Screen>
  )
}

/** Props for {@link HistoryList}. */
interface HistoryListProps {
  /** Every entry, oldest first, as the ledger hands them over. */
  readonly entries: readonly LedgerEntry[]
}

/**
 * The entries, most recent first.
 *
 * The ledger's order is the one calculations want. A reader wants the other: what they
 * come here to check is what they just recorded, and under years of history that is the
 * last row.
 *
 * Pressing a row opens the entry, to be corrected or deleted (FR-011), and the line above
 * the rows says so. It is the list's header rather than fixed above it, so at the largest
 * text size it scrolls away instead of taking a share of the screen from the rows.
 */
function HistoryList({ entries }: HistoryListProps): ReactNode {
  const router = useRouter()
  return (
    <FlatList
      data={entries.toReversed()}
      keyExtractor={(entry) => entry.id}
      ListHeaderComponent={<Text tone="secondary">{strings.entries.historyHint}</Text>}
      renderItem={({ item }) => (
        <EntryRow
          entry={item}
          onPress={() => {
            router.push({ pathname: '/entries/[id]', params: { id: item.id } })
          }}
        />
      )}
      style={styles.list}
      contentContainerStyle={styles.rows}
      testID="history-list"
    />
  )
}

/** What the history says before there is one, and the way to start it (FR-025). */
function EmptyHistory(): ReactNode {
  const router = useRouter()
  return (
    <Card testID="history-empty">
      <Text variant="heading" accessibilityRole="header">
        {strings.entries.historyEmptyTitle}
      </Text>
      <Text tone="secondary">{strings.entries.historyEmptyBody}</Text>
      <Button
        label={strings.home.contributeAction}
        onPress={() => {
          router.push('/entries/contribute')
        }}
        testID="contribute"
      />
    </Card>
  )
}

const styles = StyleSheet.create({
  list: { flex: 1 } satisfies ViewStyle,
  rows: { gap: spacing.sm } satisfies ViewStyle,
})
