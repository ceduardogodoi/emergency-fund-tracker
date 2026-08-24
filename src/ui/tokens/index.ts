/**
 * The design tokens — constitution Principle VI's single source of truth for every
 * spacing, colour, type, radius, and elevation value in the app.
 *
 * A pure barrel by design: `jest.config.mjs` excludes `src/**\/index.ts` from coverage, so
 * anything with logic in it would sit outside the floor. The values live in the modules
 * beside this one.
 */
export { color } from './color'
export { minimumTouchTarget, screenInset, spacing } from './spacing'
export { tabularNumbers, typography } from './typography'
export { elevation, radius } from './shape'
