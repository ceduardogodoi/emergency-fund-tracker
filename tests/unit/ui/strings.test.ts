import { LEVELS, MAXIMUM_COVERAGE_MONTHS, MINIMUM_COVERAGE_MONTHS } from '@/domain/goal/levels'
import type { LevelKey } from '@/domain/goal/types'
import { strings } from '@/ui/strings'

/**
 * The strings module is data, so there is little in it to test. What is worth pinning is
 * the places where its shape has to agree with something else — a screen that renders a
 * list from the domain and reads its copy from here breaks silently when only one of the
 * two gains an entry.
 */
describe('level copy', () => {
  /** Every level a user can be shown: the presets, plus the custom duration. */
  const allLevelKeys: readonly LevelKey[] = [...LEVELS.map((level) => level.key), 'custom']

  it('names and explains every level the domain offers', () => {
    expect(Object.keys(strings.levels).sort()).toEqual([...allLevelKeys].sort())
  })

  it.each(allLevelKeys)('gives %s copy that says who it suits, not what it is', (key) => {
    const level = strings.levels[key]
    expect(level.name.length).toBeGreaterThan(0)
    // FR-003 asks for a plain-language explanation of who the level suits. A length floor
    // cannot check that it is plain language, but it does catch the placeholder that gets
    // left behind when a level is added in a hurry.
    expect(level.explanation.length).toBeGreaterThan(20)
  })

  // The durations live in the domain (`COVERAGE_MONTHS`) and are formatted at the screen.
  // Repeating them in the copy would put "6 months" in two places, and a level retuned in
  // one of them would then contradict the other on the same screen.
  it.each(allLevelKeys)('leaves the duration out of %s copy', (key) => {
    expect(strings.levels[key].explanation).not.toMatch(/\d+\s*mes/)
  })

  // The one place a duration is written into a sentence takes it as a parameter, so the
  // help text cannot claim a range the validator does not enforce.
  it('builds the range help from the bounds the validator actually applies', () => {
    expect(strings.coverageRangeHelp(MINIMUM_COVERAGE_MONTHS, MAXIMUM_COVERAGE_MONTHS)).toBe(
      'Entre 1 e 24 meses.',
    )
  })

  it('states the range as a correction as well, in different words', () => {
    expect(strings.coverageRangeError(MINIMUM_COVERAGE_MONTHS, MAXIMUM_COVERAGE_MONTHS)).not.toBe(
      strings.coverageRangeHelp(MINIMUM_COVERAGE_MONTHS, MAXIMUM_COVERAGE_MONTHS),
    )
  })

  // The shortest permitted duration is one month, so the singular is a value the app can
  // actually show — and "1 meses" is the kind of slip that makes an app feel machine-made.
  it('agrees in number, at both ends of the permitted range', () => {
    expect(strings.coverageDuration(MINIMUM_COVERAGE_MONTHS)).toBe('1 mês')
    expect(strings.coverageDuration(MAXIMUM_COVERAGE_MONTHS)).toBe('24 meses')
  })
})
