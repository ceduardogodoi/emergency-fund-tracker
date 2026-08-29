import type { LevelKey } from './types'

/**
 * The shortest coverage a custom duration may name (FR-002).
 *
 * One month, not zero: a target of zero is a fund with nothing to reach, and the spec
 * asks for a duration rather than an opt-out.
 */
export const MINIMUM_COVERAGE_MONTHS = 1

/** The longest coverage a custom duration may name (FR-002). */
export const MAXIMUM_COVERAGE_MONTHS = 24

/**
 * The preset levels and the months of coverage each stands for (FR-002).
 *
 * The numbers reflect widely published personal-finance guidance and are defaults rather
 * than rules, which is why the custom duration exists alongside them.
 *
 * The plain-language explanation FR-003 requires is deliberately not here. It is
 * user-facing text, so it lives in `src/ui/strings` with every other string — the domain
 * may not import the UI layer, and a level that carried its own Portuguese sentence would
 * make this module the second place the app's language is decided.
 */
export const COVERAGE_MONTHS = {
  lean: 3,
  balanced: 6,
  cautious: 9,
  maximum: 12,
} as const

/** A level the app names, as opposed to a duration the user typed. */
export type PresetLevelKey = keyof typeof COVERAGE_MONTHS

/** One preset level. */
export interface Level {
  /** Which level this is. */
  readonly key: PresetLevelKey
  /** The months of coverage it stands for. */
  readonly coverageMonths: number
}

/**
 * The presets in the order they are offered — least cautious first.
 *
 * An array rather than a second literal, so the order is the only thing stated here and
 * the durations cannot drift from {@link COVERAGE_MONTHS}.
 */
export const LEVELS: readonly Level[] = (['lean', 'balanced', 'cautious', 'maximum'] as const).map(
  (key) => ({ key, coverageMonths: COVERAGE_MONTHS[key] }),
)

/**
 * Names the level a duration corresponds to.
 *
 * Used when a stored goal is reopened, so the screen reselects the level the user chose
 * rather than always landing on custom. A duration matching no preset is `custom`, which
 * includes durations inside the preset range — 7 months is a choice the user typed, and
 * showing it as anything else would be putting words in their mouth.
 *
 * @param coverageMonths The stored duration.
 * @returns The matching preset key, or `custom`.
 */
export function levelForCoverageMonths(coverageMonths: number): LevelKey {
  const match = LEVELS.find((level) => level.coverageMonths === coverageMonths)
  return match === undefined ? 'custom' : match.key
}
