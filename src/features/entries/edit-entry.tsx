import { useState, type ReactNode } from 'react'
import { StyleSheet, View, type ViewStyle } from 'react-native'

import { toViewState } from '@/runtime/query'
import { useServices } from '@/runtime/services-context'
import type { LedgerEntry } from '@/domain/ledger/types'
import {
  Button,
  Card,
  ConfirmSheet,
  DatePicker,
  Field,
  MoneyInput,
  StateView,
  Text,
} from '@/ui/primitives'
import { strings } from '@/ui/strings'
import { spacing } from '@/ui/tokens'
import { useEntry, useRemoveEntry } from './hooks'
import { useEntryEdit, type EntryEditState } from './use-entry-edit'

/** Props for {@link EditEntry}. */
export interface EditEntryProps {
  /** The entry to correct or delete. */
  readonly id: string
  /** Called once a correction or a deletion has landed — where the screen navigates. */
  readonly onDone: () => void
}

/** Deleting the entry, as the form sees it. */
interface Removal {
  /** Deletes the entry. Called only once the user has confirmed. */
  readonly remove: () => void
  /** Whether the deletion is in flight. */
  readonly isRemoving: boolean
  /** Whether the last deletion failed. */
  readonly hasFailed: boolean
}

/**
 * Correcting or deleting an entry already in the ledger (FR-011).
 *
 * The deletion is held here, above the form, because of what a deletion does to this
 * screen: the entry leaves the cache before the screen has left, so for a moment this is a
 * screen about an entry that does not exist, and the form has nothing to show. Whether
 * that moment reads as "not found" depends on knowing a deletion is under way, which is
 * known here and would be lost with a form that had just unmounted.
 *
 * @param props - See {@link EditEntryProps}
 * @returns The form, or what is shown in place of it
 */
export function EditEntry({ id, onDone }: EditEntryProps): ReactNode {
  const entry = useEntry(id)
  const remove = useRemoveEntry()
  const removal: Removal = {
    remove: () => {
      remove.mutate(id, { onSuccess: onDone })
    },
    isRemoving: remove.isPending,
    hasFailed: remove.isError,
  }

  return (
    <StateView
      state={toViewState(entry, (found) => found === null)}
      // Missing only if this screen did not make it so. Between a deletion landing and the
      // screen leaving the entry is gone because the user asked, and "not found" would be
      // the last thing they read about an action that worked.
      empty={() => (remove.isIdle ? <MissingEntry /> : null)}
      ready={(found) =>
        found === null ? null : <EntryForm entry={found} removal={removal} onDone={onDone} />
      }
    />
  )
}

/** Props for {@link EntryForm}. */
interface EntryFormProps {
  /** The entry as it is stored. */
  readonly entry: LedgerEntry
  readonly removal: Removal
  /** Called once a correction has landed. */
  readonly onDone: () => void
}

/**
 * The entry, open for correction, with the way to delete it underneath.
 *
 * The kind is stated and not offered: an entry's type is part of its identity (FR-047), so
 * turning a contribution into a withdrawal is deleting one and recording the other. A
 * withdrawal shows no note, because it has a reason instead, and what a reason may be
 * arrives with User Story 5 (FR-016).
 */
function EntryForm({ entry, removal, onDone }: EntryFormProps): ReactNode {
  const { format } = useServices()
  const edit = useEntryEdit(entry, onDone)
  const isBusy = edit.isSaving || removal.isRemoving

  return (
    <>
      <Text variant="label">{strings.entries.kinds[entry.type].label}</Text>
      <MoneyInput
        label={strings.entries.amountLabel}
        value={edit.amount}
        onChangeValue={edit.changeAmount}
        format={format.money}
        error={edit.amountError}
        required
        testID="amount-input"
      />
      <EntryDay edit={edit} />
      {entry.type === 'withdrawal' ? null : <EntryNote edit={edit} />}
      <Button
        label={strings.action.save}
        onPress={edit.save}
        disabled={isBusy}
        testID="save-entry"
      />
      <DeleteEntry removal={removal} disabled={isBusy} />
      {/* Storage failed, rather than a value being refused. The form stays as it was, so
          nothing the user typed is lost. */}
      {edit.hasFailed || removal.hasFailed ? (
        <Text tone="negative">{strings.state.errorBody}</Text>
      ) : null}
    </>
  )
}

/** Props for the parts of the form that read the revision. */
interface RevisionProps {
  readonly edit: EntryEditState
}

/** What was written about a contribution or an opening balance. */
function EntryNote({ edit }: RevisionProps): ReactNode {
  return (
    <Field
      label={strings.entries.noteLabel}
      value={edit.note}
      onChangeText={edit.changeNote}
      error={edit.noteError}
      testID="note-input"
    />
  )
}

/**
 * The day the entry belongs to, written out above the calendar that changes it.
 *
 * The calendar is open from the start, unlike on the contribute screen, where it waits
 * behind "Outra data": there the common answer is today and needs no calendar, and here the
 * entry already has a day, which is as likely as anything else to be what is wrong.
 */
function EntryDay({ edit }: RevisionProps): ReactNode {
  const { format, locale } = useServices()

  return (
    <View style={styles.group}>
      <Text variant="label">{strings.entries.dateLabel}</Text>
      <Text tone="secondary">{format.date(edit.date)}</Text>
      <DatePicker
        value={edit.date}
        latest={edit.today}
        locale={locale}
        onChange={edit.changeDate}
        testID="entry-date-picker"
      />
      {edit.dateError === undefined ? null : (
        <View accessibilityLiveRegion="polite">
          <Text variant="caption" tone="negative">
            {edit.dateError}
          </Text>
        </View>
      )}
    </View>
  )
}

/** Props for {@link DeleteEntry}. */
interface DeleteEntryProps {
  readonly removal: Removal
  /** Whether a write is already in flight. */
  readonly disabled: boolean
}

/**
 * The way to delete the entry, and the question asked first (FR-011).
 *
 * The button only opens the sheet. Nothing is deleted until the sheet's own action is
 * pressed, and backing out of it is cancelling.
 */
function DeleteEntry({ removal, disabled }: DeleteEntryProps): ReactNode {
  const [isAsking, setIsAsking] = useState(false)

  return (
    <>
      <Button
        label={strings.entries.deleteAction}
        variant="secondary"
        onPress={() => {
          setIsAsking(true)
        }}
        disabled={disabled}
        testID="delete-entry"
      />
      <ConfirmSheet
        open={isAsking}
        title={strings.entries.deleteTitle}
        body={strings.entries.deleteBody}
        confirmLabel={strings.action.delete}
        onConfirm={() => {
          setIsAsking(false)
          removal.remove()
        }}
        onCancel={() => {
          setIsAsking(false)
        }}
        testID="delete-sheet"
      />
    </>
  )
}

/** What is shown for an id the ledger has no entry for (FR-051). */
function MissingEntry(): ReactNode {
  return (
    <Card testID="entry-missing">
      <Text variant="heading" accessibilityRole="header">
        {strings.entries.missingTitle}
      </Text>
      <Text tone="secondary">{strings.entries.missingBody}</Text>
    </Card>
  )
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm } satisfies ViewStyle,
})
