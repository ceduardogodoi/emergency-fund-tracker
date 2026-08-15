# Quickstart: Emergency Fund Tracker

**Feature**: `specs/001-emergency-fund-tracker` | **Date**: 2026-08-15 | **Plan**: [plan.md](./plan.md)

How to set up, run, and prove this feature works. Design details live in [data-model.md](./data-model.md) and [contracts/](./contracts/) — this file does not repeat them.

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| asdf | Version manager. The Node.js version is pinned in `.tool-versions` at the repository root, committed, and is the single source of truth for CI and every developer machine. |
| Node.js | Installed through asdf — `asdf install` reads `.tool-versions`. Do not install it separately. |
| npm | Lockfile committed; use `npm ci` in CI |
| Xcode | iOS simulator. macOS only. |
| Android Studio | Android emulator, or a physical device |
| Maestro CLI | End-to-end flows only |

No account, no API keys, no environment variables, no services to start. The app has no backend, so there is nothing to point it at — if a setup step ever asks for a URL or a token, something has gone wrong against FR-041.

## Setup

```bash
asdf install           # installs the Node version pinned in .tool-versions
npm ci
npm run typecheck      # tsc --noEmit, strict
npm run lint           # ESLint, warnings as errors
npm test               # full Jest suite
```

All three checks must pass on a clean checkout. They are the same commands the pre-commit hook and CI run — Principle I requires the gate to be identical in both places, with CI as the authority. CI installs its toolchain from the same `.tool-versions`, so a version mismatch between a developer machine and CI is not possible.

## Running

```bash
npm run ios            # iOS simulator
npm run android        # Android emulator or attached device
npm start              # dev server; scan the QR code with a device
```

To exercise a realistic fund without months of tapping:

```bash
npm run seed -- --months 8 --pattern steady     # consistent saver
npm run seed -- --months 8 --pattern erratic    # varying amounts, missed months
npm run seed -- --months 2                      # below the forecast threshold
npm run seed -- --reset                         # wipe back to first launch
```

Seed data is synthetic. Real financial data must never enter the repository or a fixture (constitution, Quality Standards).

## Test commands

```bash
npm test                      # everything below except E2E
npm run test:unit             # domain only, no I/O — the fast loop
npm run test:integration      # repositories and migrations via better-sqlite3
npm run test:component        # screens via Testing Library
npm run test:coverage         # enforces 80% global, 95% on money/dates/statistics/forecast
npm run test:a11y             # accessibility assertions incl. max text scale
npm run e2e                   # Maestro flows on a running simulator or device
```

`test:unit` should stay under a few seconds. If it starts needing a database or a device, a dependency has leaked into the domain and the boundary rule in [domain-ports.md](./contracts/domain-ports.md) is being violated.

## Validation scenarios

One per user story, in priority order. Each is independently verifiable — a story can be validated with the later ones unbuilt. Full acceptance criteria are in [spec.md](./spec.md).

### Story 1 — Set a target (P1)

1. Launch a fresh install. Onboarding appears.
2. Enter `2000` monthly expenses, choose **Balanced**.
3. **Expect** a target of `12,000` with the derivation shown — 6 months of 2,000.
4. Switch to **Cautious** without re-entering expenses. **Expect** `18,000`.
5. Override the target with `15,000`. **Expect** it stored and marked user-defined.
6. Force-quit and relaunch. **Expect** the target intact.
7. Enter `0`, then `-5`, then `abc` as expenses. **Expect** each blocked with an explanation, and no progression.

### Story 2 — Record savings and see progress (P2)

1. With a `12,000` target and no entries, log a contribution of `500`.
2. **Expect** balance `500`, remaining `11,500`, progress `4.17%`.
3. Edit it to `700`. **Expect** all three figures update.
4. Delete it. **Expect** a confirmation first, then a return to the empty state — not a stale or zeroed screen.
5. Try a future-dated contribution. **Expect** rejection with an explanation.
6. Contribute past the target. **Expect** goal-reached with a surplus, and no negative remaining anywhere.

### Story 3 — Statistics (P3)

1. `npm run seed -- --months 8 --pattern steady`, open Statistics.
2. **Expect** balance growth over time, totals, contribution count, largest contribution, and average monthly contribution — each matching a hand calculation of the seed.
3. **Expect** the current streak to equal the run of consecutive months with a contribution, and the opening balance to be excluded from the contribution count and total contributed.
4. Filter to last 3 months. **Expect** every figure and both charts to recalculate, with the active period labelled.
5. Cross 50% with a contribution. **Expect** the milestone acknowledged once, and not again on the next launch.
6. With `--reset`, open Statistics. **Expect** a purposeful empty state, not zeroed charts.
7. Enable a screen reader. **Expect** each chart's summary and data table to convey the same information as the visual.

### Story 4 — Forecast (P4)

1. `npm run seed -- --months 6 --pattern steady` at roughly 500/month with 5,000 remaining.
2. **Expect** roughly 10 months to target, a date, and the assumed pace stated alongside it.
3. Add a contribution. **Expect** the projection to recalculate (remaining changes immediately; the pace changes when the month completes — see D-017).
4. `--months 2`. **Expect** the insufficient-history state naming how many more months are needed, and no date.
5. Seed a window whose withdrawals cancel its contributions. **Expect** the no-pace state explaining why no date can be shown — never an infinite, blank, or past date.
6. Set a desired completion date. **Expect** the required monthly contribution, and a clear indication when it exceeds the current pace.
7. Raise monthly expenses so the target grows. **Expect** the projected date to move later.

### Story 5 — Withdrawals (P5)

1. From a balance of `8,000`, withdraw `3,000` with a reason.
2. **Expect** balance `5,000`, progress recalculated against an unchanged target, and the entry visually distinct from contributions by icon and label — not by color alone.
3. **Expect** the shortfall and a recovery estimate at the current pace.
4. Attempt to withdraw more than the balance. **Expect** a warning and an explicit confirmation before it is recorded.

### Story 6 — Reminders (P6)

1. Enable reminders with notification permission not yet granted. **Expect** the OS prompt.
2. Deny it. **Expect** an explanation that reminders cannot be delivered, and the setting left off.
3. Grant it, schedule a reminder a few minutes out. **Expect** delivery at that time.
4. Disable. **Expect** no further notifications.
5. Restart the device with a reminder pending. **Expect** it to still arrive (see R-003).

### Cross-cutting

**Offline (FR-040, SC-014)**: put the device in airplane mode and run every scenario above. All must pass. Separately, with a proxy attached, exercise every screen and **expect zero outbound requests** — this is the SC-014 check, and any analytics or crash SDK would fail it.

**Export and import (SC-015)**: export from a seeded fund, `--reset`, then import. Expect the goal, every entry, the balance, and every statistic to be identical. Repeat across platforms — export on Android, import on iOS. Then confirm each rejection case in [fund-export-v1.md](./contracts/fund-export-v1.md) leaves existing data untouched.

**Money exactness (SC-007)**: `npm run test:integration -- reconciliation` runs at least 1,000 randomized entry sequences and asserts the reported balance equals the exact sum every time, with zero rounding discrepancies.

**Accessibility (SC-009)**: run `npm run test:a11y`, then walk every screen manually with VoiceOver and TalkBack at the largest text size. Expect nothing clipped, no unreachable control, and no meaning carried by color alone.

**Performance (SC-012)**: on a 3-year-old mid-range Android device with a seeded 10-year history, cold-launch to an interactive Home screen in under 2 seconds, and scroll the full history at 60fps.

## Definition of done for this feature

- [ ] Every acceptance scenario in [spec.md](./spec.md) has a passing automated test
- [ ] `npm run typecheck`, `npm run lint`, and `npm test` all clean, with no `skip`, `only`, or `todo` left in any test file
- [ ] Coverage thresholds met — 80% global, 95% on money, dates, statistics, and forecast
- [ ] Every scenario above verified on both a physical iOS and a physical Android device
- [ ] SC-014 verified by proxy: zero outbound requests
- [ ] R-001, R-002, and R-003 from [research.md](./research.md) resolved and recorded
