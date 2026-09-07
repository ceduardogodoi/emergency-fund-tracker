/**
 * The design tokens — constitution Principle VI's single source of truth for every
 * spacing, colour, type, radius, border, and interaction-state value in the app.
 *
 * A pure barrel by design: `jest.config.mjs` excludes `src/**\/index.ts` from coverage, so
 * anything with logic in it would sit outside the floor. The values live in the modules
 * beside this one.
 */
export { color } from './color'
export { opacity } from './interaction'
export { coverageUnit, minimumTouchTarget, screenInset, spacing } from './spacing'
export { fontFamily, tabularNumbers, typography } from './typography'
export { borderWidth, radius } from './shape'
