# Quickstart: Drawer Navigation

**Feature**: `specs/002-drawer-navigation` | **Date**: 2026-11-08

How to prove the feature works. Setup is [001's quickstart](../001-emergency-fund-tracker/quickstart.md) unchanged; nothing here needs a new tool.

## Automated

```sh
npm run verify                                  # the gate, including the menu's component tests
npm start                                       # in one terminal
npm run e2e && npm run e2e:ios                  # every flow, on Android and iOS
```

`e2e/navigation-menu.yaml` is this feature's flow. The seven flows that used to open a section from a Home button now reach it through the menu (research D-007), so a pass of the full suite on both platforms is also the regression check for every earlier story.

## By hand

Seed a fund that shows everything Home can show at once — a milestone message and a shortfall to restore — with `npm run seed -- --months 8 --pattern erratic`, then record a withdrawal and a contribution that crosses a milestone.

| # | Scenario | Expect | Spec |
|---|----------|--------|------|
| 1 | Open Home on a 6.1-inch-class iPhone simulator and Android emulator, default text size | Balance, progress, contribute, and withdraw on screen without scrolling | FR-005, SC-001 |
| 2 | Tap the menu button | Menu lists Sua reserva, Histórico, Estatísticas, Previsão, Meta, Lembretes; Sua reserva is marked | FR-001, FR-007 |
| 3 | Choose Estatísticas, then open the menu there and choose Previsão, then go back | Statistics, then Forecast, then Home | FR-006, FR-009, SC-003 |
| 4 | From Estatísticas, choose Meta; go back | Goal opens over Statistics with no menu button; back returns to Statistics | FR-002, FR-006 |
| 5 | On Previsão, follow the link to revise the goal and save | Returns to Forecast, as before this feature | FR-012 |
| 6 | Open the menu; close it by tapping outside, by swiping, and by system back | Each closes it, screen beneath unchanged | FR-008 |
| 7 | Open the menu with a milestone message showing, then close it | The message is still there | Edge cases |
| 8 | Contribute, withdraw, edit an entry, and onboarding (`--reset`) | No menu button on any of them | FR-002 |
| 9 | VoiceOver and TalkBack: open the menu, read every item, choose one, reopen, close | Button announces its state; each item its name, the current one as selected; nothing behind the menu reachable; focus returns to the button on close | FR-003, FR-007, FR-010, SC-004, R-001 |
| 10 | Largest text size on both platforms | Every item readable in full and reachable, list scrolls if needed | FR-011, SC-005 |
| 11 | iPad simulator, and a phone in landscape | The menu slides over the content and is never permanently open | Edge cases, research D-006 |
| 12 | Android with gesture navigation: swipe in from the left edge on Home | Record what happens, for R-004 | R-004 |

Clean up afterwards with `npm run e2e:clean`, per the workflow rules.
