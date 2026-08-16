import type { IdGenerator } from '@/domain/ports/id-generator'

/**
 * A function returning a fresh UUID v4 string.
 *
 * Supplied by the composition root rather than imported here, so this module stays free
 * of native-module imports and can run in the fast Node test project. On device the
 * source is `expo-crypto`'s `randomUUID`; in tests it is the platform's own.
 */
export type UuidSource = () => string

/**
 * Adapts a platform UUID source to the {@link IdGenerator} port.
 *
 * The indirection earns its keep twice. It keeps `expo-crypto` — a native module that
 * cannot load in a Node test process — out of the import graph of anything unit-tested.
 * And it documents that the id source is a decision, not an accident: these ids travel in
 * the export document and are what merge deduplication matches on (FR-047), so they must
 * be globally unique rather than unique-per-database, which rules out a local sequence.
 *
 * @param randomUuid The platform generator. Must produce RFC 4122 v4 identifiers.
 */
export function createIdGenerator(randomUuid: UuidSource): IdGenerator {
  return {
    uuid: () => randomUuid(),
  }
}
