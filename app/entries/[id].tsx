import { useLocalSearchParams, useRouter } from 'expo-router'
import type { ReactNode } from 'react'

import { EditEntry } from '@/features/entries/edit-entry'
import { leaveScreen } from '@/features/navigation/leave-screen'
import { Screen } from '@/ui/primitives'
import { strings } from '@/ui/strings'

/**
 * Correcting or deleting one entry (FR-011), reached by pressing its row in the history.
 *
 * @returns The rendered screen
 */
export default function EditEntryScreen(): ReactNode {
  const router = useRouter()
  const { id } = useLocalSearchParams<{ id: string }>()

  return (
    <Screen title={strings.entries.editTitle}>
      <EditEntry
        id={id}
        onDone={() => {
          leaveScreen(router)
        }}
      />
    </Screen>
  )
}
