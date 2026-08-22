import { initialSchema } from './001-initial'

import type { Migration } from './runner'

/**
 * Every migration this build knows how to apply, oldest first.
 *
 * Adding a schema change means adding the next numbered file and appending it here.
 * Existing entries are never edited: a device in the field has already applied them, and
 * rewriting one would leave that device on a schema no code describes.
 */
export const MIGRATIONS: readonly Migration[] = [initialSchema]

export type { AppliedMigration, Migration, MigrationReport } from './runner'
export { migrate } from './runner'
