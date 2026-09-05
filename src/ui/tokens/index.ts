/**
 * The design tokens — constitution Principle VI's single source of truth for every
 * spacing, colour, type, radius, border, elevation, and interaction-state value in the
 * app.
 *
 * A pure barrel by design: `jest.config.mjs` excludes `src/**\/index.ts` from coverage, so
 * anything with logic in it would sit outside the floor. The values live in the modules
 * beside this one.
 */
export { color } from './color'
export { opacity } from './interaction'
export { minimumTouchTarget, screenInset, spacing } from './spacing'
export { tabularNumbers, typography } from './typography'
export { borderWidth, elevation, radius } from './shape'
