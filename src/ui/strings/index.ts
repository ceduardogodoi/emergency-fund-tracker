/**
 * The user-facing string module — constitution Principle VI's single home for text.
 *
 * A pure barrel by design: `jest.config.mjs` excludes `src/**\/index.ts` from coverage, so
 * anything with logic in it would sit outside the floor.
 */
export { strings } from './strings'
