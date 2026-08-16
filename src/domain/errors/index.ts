/**
 * Barrel for the error taxonomy — what can go wrong in this app.
 *
 * `Result`, which carries outcomes, deliberately lives at `src/domain/result.ts` instead:
 * it is a generic control-flow primitive rather than a member of this taxonomy.
 */
export * from './app-error'
