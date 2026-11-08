# Feature Specification: Drawer Navigation

**Feature Branch**: `main` *(no branch hook configured; work tracked by feature directory)*

**Feature Directory**: `specs/002-drawer-navigation`

**Created**: 2026-11-08

**Status**: Draft

**Input**: User description: "The home screen now has too many navigation items (as buttons), forcing users to scroll to find options. Research and plan a drawer navigation to improve that experience."

## Context

Each story of [001-emergency-fund-tracker](../001-emergency-fund-tracker/spec.md) added its way in as a button on Home. Home now carries seven: record a contribution, record a withdrawal, history, statistics, forecast, revise the goal, and reminders. They sit below the balance, the recovery card, and the goal card, so most of them are below the fold on a phone, and further still at a large text size. A user looking for the forecast has to know to scroll for it.

This feature gives the app one place where every section can be reached, a navigation menu that slides in from the side of the screen, and gives Home back to the fund itself.

## Clarifications

### Session 2026-11-08

- Q: Does recording a withdrawal stay on Home, or move into the menu? → A: It stays on Home beside recording a contribution.
- Q: Where does revising the goal live once Home loses its navigation buttons? → A: In the menu, as Goal. The goal card keeps showing the target and its coverage, without the button; the forecast screen's contextual link to revise the goal stays.
- Q: Where does back lead from a section reached through the menu? → A: To Home, never back through earlier menu choices.
- Q: Goal and Reminders are forms with unsaved edits. Do they open as menu sections with the menu control, or over the current screen like the contribute form? → A: Over the current screen. They are listed in the menu, but open on top of where the user is, with no menu control, and back or saving returns there — to Forecast, for instance, when the forecast's link to revise the goal opened it. An abandoned edit never lingers behind the menu.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Find any section from a menu, with Home showing the fund (Priority: P1)

A returning user opens the app and sees their balance, their progress, and the two things they come to do — record a contribution or a withdrawal — without scrolling. When they want something else, they open the menu from a control at the top of Home, see every section of the app listed by name, and choose one.

**Why this priority**: This is the problem as reported. Moving the destinations into a menu is what lets Home stop scrolling, and on its own it already delivers the fix.

**Independent Test**: Seed a fund with a recovery in progress and a milestone banner showing, open Home on a phone, and confirm the balance and both primary actions are visible without scrolling; then open the menu and reach each section from it.

**Acceptance Scenarios**:

1. **Given** a user with a goal, **When** they open the app, **Then** Home shows the balance, progress, and the contribute and withdraw actions without scrolling, and no button that only leads to another section.
2. **Given** Home is showing, **When** the user activates the menu control, **Then** a menu opens listing Home, History, Statistics, Forecast, Goal, and Reminders by name.
3. **Given** the menu is open, **When** the user chooses a section, **Then** the menu closes and that section is shown.
4. **Given** the menu is open, **When** the user taps outside it, swipes it closed, or uses the system back gesture or button, **Then** the menu closes and the screen beneath is unchanged.
5. **Given** the user chose a section from the menu, **When** they go back, **Then** they return to Home.

---

### User Story 2 - Move between sections without returning to Home (Priority: P2)

A user reading their statistics wants to see the forecast. They open the menu from the statistics screen and go straight there, rather than going back to Home first. The menu marks the section they are in, so they always know where they are.

**Why this priority**: Story 1 fixes Home; this makes the menu the app's navigation rather than Home's. It is worth less without Story 1 and is testable on its own once the menu exists.

**Independent Test**: From each main section in turn, open the menu, confirm the current section is marked, and reach a different section directly.

**Acceptance Scenarios**:

1. **Given** the user is on History, Statistics, or Forecast, **When** they look at the top of the screen, **Then** the same menu control is there that Home has.
2. **Given** the user is on Statistics, **When** they choose Goal or Reminders from the menu, **Then** that screen opens over Statistics with no menu control, and going back or saving returns to Statistics.
3. **Given** the menu is open on any section that shows it, **When** the user reads the list, **Then** the section they are in is marked as current, by more than colour.
4. **Given** the user is on Statistics, **When** they choose Forecast from the menu, **Then** the forecast is shown, and going back returns to Home rather than to Statistics.
5. **Given** the menu is open, **When** the user chooses the section they are already in, **Then** the menu closes and nothing else changes.

---

### Edge Cases

- **Before a goal exists**: onboarding shows no menu control. Every section reads the goal, and setup is not optional.
- **Forms and detail screens** (recording a contribution or withdrawal, editing an entry, revising the goal, setting reminders) show no menu control, including Goal and Reminders when the menu opened them. They are steps with a way back, not places, and leaving one from a menu could abandon what the user was typing.
- **Home loading or failed to load**: the menu control is still available, because the other sections do not depend on Home's data having loaded.
- **Milestone message showing**: opening and closing the menu leaves the message as it was. Opening the menu does not count as dismissing it.
- **Largest text size**: the menu's items wrap rather than clip, and the list scrolls if it no longer fits, so every item stays reachable.
- **Screen reader**: opening the menu moves focus into it, and the content behind it cannot be reached while it is open. Closing it returns focus to the menu control.
- **Wide screens** (a tablet, or a phone in landscape): the menu behaves as it does on a phone, sliding over the content. It never stays permanently open.
- **Arriving from a reminder notification**: whatever screen the notification opens, the menu works there as it does when that screen is reached any other way.
- **A swipe in from the left edge** opens the menu on Home, History, Statistics, and Forecast. On a screen that opens over the menu — Goal, Reminders, recording a contribution or withdrawal, editing an entry — it goes back instead, as it does on any iOS screen and as Android's back gesture does. With no navigation header, that swipe is the only way back from those screens on iOS short of saving, and the menu is deliberately absent there. Measured on the iPhone 15 simulator on 2026-11-08, when it was raised as a possible bug on Goal: Contribute behaves the same way.
- **Development-only screens** are never listed in the menu.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a navigation menu listing every main section of the app: Home, History, Statistics, Forecast, Goal, and Reminders, in that order, each named so that it plainly matches the screen it opens. The same section uses the same word in the menu, on its screen, and anywhere else that names it (Constitution Principle VI).
- **FR-002**: System MUST show a control that opens the menu, in the same place on Home, History, Statistics, and Forecast. Forms, detail screens, and onboarding MUST NOT show it; Goal and Reminders are forms.
- **FR-003**: The menu control MUST have an accessible name stating what it opens, and MUST announce whether the menu is open or closed.
- **FR-004**: Home MUST NOT show any button whose only purpose is to lead to another main section. The contribute and withdraw actions remain on Home.
- **FR-005**: On a phone with a 6.1-inch-class screen at the default text size, Home MUST show the balance, the progress toward the target, and both primary actions without scrolling, including when a milestone message or the recovery card is showing.
- **FR-006**: Choosing a section from the menu MUST close the menu and show that section. Choosing the current section MUST close the menu and change nothing else. Goal and Reminders MUST open over the screen the menu was opened on, and going back or saving MUST return to that screen.
- **FR-007**: The menu MUST mark the current section, in a way that does not rely on colour alone and that a screen reader announces.
- **FR-008**: The menu MUST close, leaving the screen beneath unchanged, when the user taps outside it, swipes it closed, or uses the platform's back gesture or button.
- **FR-009**: Going back from History, Statistics, or Forecast reached through the menu MUST return to Home. It MUST NOT step back through earlier menu choices.
- **FR-010**: While the menu is open, the content behind it MUST NOT be reachable by touch or by screen reader. Opening the menu MUST move screen-reader focus into it, and closing it MUST return focus to the menu control.
- **FR-011**: The menu MUST meet the first release's accessibility requirements: WCAG 2.1 AA (001 FR-049), full use at the largest text size with every item reachable (001 FR-050), and visible feedback within 100 milliseconds of opening or choosing (001 FR-052).
- **FR-012**: Contextual actions that lead from one section to another, such as the statistics and forecast screens' prompt to record a contribution or revise the goal, MUST remain where they are. The menu adds a route to each section; it does not replace one tied to what the screen is saying.
- **FR-013**: The menu MUST behave the same on Android and iOS, apart from following each platform's own back convention.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Home holds at most two action buttons, down from seven, and on a 6.1-inch-class phone at the default text size its balance, progress, and both actions are visible without scrolling in 100% of fund states: new, in progress, reached, with a shortfall to restore, and with a milestone message.
- **SC-002**: Every main section is reachable from Home in at most two taps: open the menu, choose the section.
- **SC-003**: Every main section is reachable from Home, History, Statistics, and Forecast in at most two taps, without passing through Home.
- **SC-004**: Using only a screen reader, a user can open the menu, hear every item with its name and which one is current, choose one, and close the menu, on both platforms.
- **SC-005**: At the largest text size each platform supports, every menu item is reachable and none is clipped.
- **SC-006**: In moderated testing, at least 4 of 5 people using the app for the first time find a named section, such as the forecast, within 10 seconds and without help.

## Assumptions

- A slide-in menu reached from a control at the top of the screen is the pattern asked for, and fits an app with six sections, of which only Home is visited on most launches. A bottom tab bar was the alternative considered: it would keep sections one tap away but holds five items at most, and would take permanent space from the screen that is meant to show the fund.
- Recording a contribution or a withdrawal is why people open the app, so both stay on Home as buttons. Withdrawals are rarer, but when one is needed the user should not have to look for it.
- Revising the goal moves from the goal card on Home to the menu, as Goal. The card still shows the target and its coverage; the forecast screen's own contextual link to revise the goal stays.
- The menu lists sections, not actions: contribute and withdraw are not repeated in it.
- Back from History, Statistics, or Forecast returns to Home, the convention for apps built around a slide-in menu. Home is the app's starting point, and a back path that retraced every menu choice would make "back" unpredictable.
- The menu shows names only, with no counts, balances, or badges.
- How the menu is built, and any library it needs, is for planning to research. Whatever is chosen must keep the first release's constraints: no network access and no new data leaving the device.

## Out of Scope

- New sections, or any change to what an existing section shows, beyond the removal of navigation buttons from Home.
- A menu that stays open beside the content on wide screens.
- Search, recent items, or shortcuts within the menu.
- App-icon shortcuts and home-screen widgets.

## Dependencies

- The sections built in [001-emergency-fund-tracker](../001-emergency-fund-tracker/spec.md) User Stories 1–6. This feature changes how they are reached, not what they do.
- The first release's Phase 10 accessibility walk (001 T146) covers eleven screens. If it runs after this feature, it must cover the menu too.
