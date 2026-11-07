import { isWithdrawalReasonKey, type WithdrawalReasonKey } from '@/domain/ledger/withdrawal'

/** Which reason is chosen: a predefined one, or the user's own words. */
export type ReasonChoice = WithdrawalReasonKey | 'other'

/**
 * A withdrawal's reason as a form holds it (FR-016).
 *
 * The text is kept while a predefined reason is chosen, so going back to "Outro motivo"
 * finds what was written — but it is the entry's reason only while "Outro motivo" is the
 * choice.
 */
export interface ReasonDraft {
  /** The reason chosen, or null before anything is. */
  readonly choice: ReasonChoice | null
  /** The user's own words, as typed, surrounding whitespace included. */
  readonly text: string
}

/** Nothing chosen. A reason picked by default would be a reason nobody gave. */
export const NO_REASON: ReasonDraft = { choice: null, text: '' }

/**
 * A stored reason, as the form opens on it.
 *
 * @param stored The reason as stored: a predefined key, or words the user wrote.
 * @returns The key chosen, or "Outro motivo" chosen with the words in it.
 */
export function reasonDraftOf(stored: string): ReasonDraft {
  return isWithdrawalReasonKey(stored)
    ? { choice: stored, text: '' }
    : { choice: 'other', text: stored }
}

/**
 * The reason the draft gives, as it would be stored.
 *
 * The user's words are trimmed, and blank words are no reason — which the rules refuse,
 * as they refuse no choice at all.
 *
 * @param draft The reason as the form holds it.
 * @returns The key, the trimmed words, or null when no reason is given.
 */
export function reasonOf(draft: ReasonDraft): string | null {
  if (draft.choice !== 'other') {
    return draft.choice
  }
  const text = draft.text.trim()
  return text === '' ? null : text
}
