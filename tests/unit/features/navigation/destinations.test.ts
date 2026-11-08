import { DESTINATIONS } from '@/features/navigation/destinations'
import { strings } from '@/ui/strings'

/**
 * The menu is drawn from this list, so the list is the menu's contract: what it offers, in
 * what order, under what names, and whether each place opens as a section of the menu or
 * over the screen the menu was opened on (specs/002-drawer-navigation/data-model.md).
 */
describe('the destination list', () => {
  it('offers every main section, in the order the menu shows them (FR-001)', () => {
    expect(DESTINATIONS.map((destination) => destination.key)).toEqual([
      'home',
      'history',
      'statistics',
      'forecast',
      'goal',
      'reminders',
    ])
  })

  it.each(DESTINATIONS)('names $key from the strings module', ({ key, label }) => {
    expect(label).toBe(strings.navigation.destinations[key])
  })

  // FR-001: the same section uses the same word in the menu and on its screen. Goal is the
  // one exception, deliberately: its screen is titled "Ajustar meta", an action, and the
  // menu lists places. The menu's word is the noun inside that title.
  it.each([
    ['home', strings.home.title],
    ['history', strings.entries.historyTitle],
    ['statistics', strings.statistics.title],
    ['forecast', strings.forecast.title],
    ['reminders', strings.reminders.title],
  ] as const)('names %s with the title its screen shows', (key, title) => {
    expect(strings.navigation.destinations[key]).toBe(title)
  })

  it('names the goal with the noun its screen title contains', () => {
    expect(strings.revision.title).toContain(strings.navigation.destinations.goal.toLowerCase())
  })

  // Goal and Reminders are forms. As sections, the drawer would keep them mounted and an
  // abandoned draft would come back on the next visit; opened over the current screen, they
  // are discarded on leaving and return the user to where they were (spec, Clarifications).
  it('opens the two forms over the current screen, and the rest as sections', () => {
    expect(
      Object.fromEntries(DESTINATIONS.map(({ key, presentation }) => [key, presentation])),
    ).toEqual({
      home: 'section',
      history: 'section',
      statistics: 'section',
      forecast: 'section',
      goal: 'over',
      reminders: 'over',
    })
  })

  // The paths every `router.push` and every Maestro deep link already uses. The drawer
  // regroups the route files without renaming a single URL (research D-003), so a change
  // here is a change to every caller, not to the menu alone.
  it('leads to the paths the app already uses', () => {
    expect(Object.fromEntries(DESTINATIONS.map(({ key, href }) => [key, href]))).toEqual({
      home: '/',
      history: '/entries',
      statistics: '/statistics',
      forecast: '/forecast',
      goal: '/settings/goal',
      reminders: '/settings/reminders',
    })
  })
})
