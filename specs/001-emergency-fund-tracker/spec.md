# Feature Specification: Emergency Fund Tracker

**Feature Branch**: `main` *(no branch hook configured; work tracked by feature directory)*

**Feature Directory**: `specs/001-emergency-fund-tracker`

**Created**: 2026-08-09

**Status**: Draft

**Input**: User description: "Build a mobile application (Android and iOS) that help users save money for their emergency fund. It helps them keep set the amount according their monthly expenses and conservative level option, track of the money they have saved so far, check other statistics regarding their progress, monitor their progress, and assess predictability"

## Clarifications

### Session 2026-08-09

- Q: Is manual entry the only way contributions are captured in this release, or must the app also import transactions from a linked bank account? → A: Manual entry only. Bank account linking and transaction import are out of scope.
- Q: Does "assess predictability" mean forecasting a completion date, rating the consistency of the user's saving behavior, or letting the user run what-if scenarios? → A: Forecast only — a projected completion date at the current saving pace, plus a required-monthly-contribution calculator. No consistency rating and no what-if scenarios.
- Q: Is data stored only on the user's device, or does the product require a user account with cloud sync? → A: Device-only storage with no account. Accounts, authentication, and cloud sync are planned for a future release.
- Q: Should the app require a device passcode, fingerprint, or face unlock before showing the user's fund data? → A: No in-app lock. The device's own lock screen is the only protection in this release; the planned accounts and authentication release will address in-app access control.
- Q: When a user reinstalls the app or moves to a new phone, should their fund history come back automatically? → A: No automatic restore. The user restores by importing a file they previously exported, which also works across a device or platform switch.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Set a personalized emergency fund target (Priority: P1)

A first-time user opens the app and is asked what they typically spend in a month on essentials. They enter that figure, then choose how cautious they want to be — from a lean cushion to a very conservative one. The app immediately shows the target amount they should be saving, explains how it arrived at that number, and lets them adjust either input or override the target outright before saving it.

**Why this priority**: Without a target, none of the tracking, statistics, or forecasting features have meaning. This story alone is a viable product — a user who only ever uses this screen still walks away knowing how much they need to save, which is the single most common unanswered question for people starting an emergency fund.

**Independent Test**: Install the app fresh, enter a monthly expense figure, select each conservativeness level in turn, and confirm the displayed target changes correctly and is retained after closing and reopening the app. Delivers value with no other feature present.

**Acceptance Scenarios**:

1. **Given** a user with no saved data, **When** they enter monthly essential expenses of 2,000 and select the "Balanced" (6 months) level, **Then** the app displays a target of 12,000 with an explanation that it equals 6 months of the entered expenses.
2. **Given** a user viewing their computed target, **When** they change the conservativeness level from "Balanced" to "Cautious" (9 months), **Then** the target updates to 18,000 without requiring the expense figure to be re-entered.
3. **Given** a user who wants a specific number, **When** they override the computed target with a manually entered amount, **Then** the app stores the manual amount as the target and marks it as user-defined rather than calculated.
4. **Given** a user enters zero, a negative number, or a non-numeric value as monthly expenses, **When** they attempt to continue, **Then** the app blocks progression and explains what a valid amount looks like.
5. **Given** an existing user with contributions already recorded, **When** they raise their monthly expenses and the target recalculates upward, **Then** all recorded contributions are preserved and the progress percentage is recalculated against the new target.

---

### User Story 2 - Record savings and see progress (Priority: P2)

Each time the user moves money into their emergency fund, they open the app and log the amount with a date and an optional note. The home screen shows how much they have saved so far, how much remains, and what percentage of the target they have reached. Mistakes can be corrected by editing or deleting any past entry.

**Why this priority**: This is the "tracking" core of the product and the reason users return. It is second only to target-setting because a progress figure is meaningless without a target to measure against.

**Independent Test**: With a target already set, log three contributions on different dates, verify the running balance, remaining amount, and percentage are correct, then edit one entry and delete another and verify all figures recalculate correctly.

**Acceptance Scenarios**:

1. **Given** a target of 12,000 and no contributions, **When** the user logs a contribution of 500, **Then** the balance shows 500, remaining shows 11,500, and progress shows 4.17% (rounded for display).
2. **Given** existing contributions, **When** the user edits a past contribution's amount, **Then** the balance, remaining amount, and progress percentage all update to reflect the corrected value.
3. **Given** existing contributions, **When** the user deletes a contribution, **Then** it is removed from history and all derived figures recalculate; the deletion requires explicit confirmation.
4. **Given** the user is logging a contribution, **When** they select a date in the future, **Then** the app rejects the date and explains that contributions must be dated today or earlier.
5. **Given** a user setting up the app who already has money set aside, **When** they enter a starting balance during setup, **Then** that amount is recorded as the opening balance and counts toward progress.
6. **Given** a user whose balance reaches or exceeds the target, **When** they view the home screen, **Then** the app shows the goal as reached and displays the surplus amount rather than a negative remaining figure.

---

### User Story 3 - Monitor progress with statistics (Priority: P3)

The user opens a statistics view to understand their saving behavior over time: how their balance has grown, how much they contribute in a typical month, which months they missed, how long their current saving streak is, and how far they have come since starting.

**Why this priority**: Statistics turn a ledger into motivation and insight. They depend on accumulated contribution history, so they deliver value only after Stories 1 and 2 are in use, but they are the primary driver of sustained engagement.

**Independent Test**: Seed several months of contribution history, open the statistics view, and verify each displayed figure against a manual calculation of the same data.

**Acceptance Scenarios**:

1. **Given** at least two months of contribution history, **When** the user opens statistics, **Then** they see balance growth over time, total contributed, total withdrawn, net saved, number of contributions, and average monthly contribution.
2. **Given** contributions in three consecutive calendar months and none in the month before those, **When** the user views statistics, **Then** the current streak shows 3 months and the longest streak shows at least 3 months.
3. **Given** a user selects a time period filter such as last 3 months, last 12 months, or all time, **When** the filter is applied, **Then** every statistic and chart in the view recalculates to that period and the active period is clearly labeled.
4. **Given** a user with no contributions yet, **When** they open statistics, **Then** they see a purposeful empty state explaining what will appear here and prompting the first contribution, not a blank screen or zeroed charts.
5. **Given** a user crosses 25%, 50%, 75%, or 100% of their target, **When** the contribution that crosses the threshold is saved, **Then** the app acknowledges the milestone.

---

### User Story 4 - Forecast when the goal will be reached (Priority: P4)

The user wants to know when they will actually get there. The app looks at how much they have been saving each month recently, projects the date they will reach their target if they keep up that pace, and shows the pace the projection is based on. The user can also name a date they want to finish by and see what monthly contribution that would require.

**Why this priority**: A projected finish date is what turns a target into a plan, but it is only meaningful once enough history exists to establish a pace. It builds directly on Story 2.

**Independent Test**: Seed contribution histories of differing lengths and amounts, and verify the projected date, the stated pace, and the required-monthly-contribution figure each match manual calculation, including the cases where history is too short and where recent saving has stopped.

**Acceptance Scenarios**:

1. **Given** six months of contributions averaging 500 per month and a remaining amount of 5,000, **When** the user views the forecast, **Then** the app projects completion in approximately 10 months and states that the projection assumes the current pace of 500 per month continues.
2. **Given** a projection is displayed, **When** the user adds, edits, or deletes a contribution or withdrawal, **Then** the projected date and the stated pace recalculate to reflect the change.
3. **Given** a user with fewer than three calendar months of contribution history, **When** they open the forecast, **Then** the app shows an explicit "not enough history yet" state stating how much more history is needed, rather than an unreliable projection.
4. **Given** a user who has recorded no net saving over the trailing window, **When** they open the forecast, **Then** the app explains that a date cannot be projected at a pace of zero and prompts them to record a contribution, rather than showing an infinite or blank date.
5. **Given** a user sets a desired completion date, **When** the date is saved, **Then** the app shows the monthly contribution required to meet it and indicates whether that exceeds their recent average pace.
6. **Given** a user whose target increases because their monthly expenses rose, **When** they view the forecast, **Then** the projected date moves later and reflects the new remaining amount.

---

### User Story 5 - Handle withdrawals and recovery (Priority: P5)

An emergency happens and the user takes money out. They record the withdrawal with a reason, and the app shows the reduced balance, the shortfall against the target, and how long recovery will take at their recent saving pace — without treating the withdrawal as a failure.

**Why this priority**: Withdrawal is the actual purpose of an emergency fund, and a tracker that cannot represent it will show wrong balances the first time a user needs the money. It ranks below the core saving loop because it is used infrequently.

**Independent Test**: With a positive balance, record a withdrawal, and verify the balance, progress percentage, shortfall, and recovery estimate all update correctly and the withdrawal appears distinctly in history.

**Acceptance Scenarios**:

1. **Given** a balance of 8,000, **When** the user records a withdrawal of 3,000 with a reason, **Then** the balance shows 5,000, progress recalculates against the unchanged target, and the entry is visually distinguishable from contributions in history.
2. **Given** a balance of 5,000, **When** the user attempts to withdraw 6,000, **Then** the app warns that the withdrawal exceeds the available balance and requires explicit confirmation before recording it.
3. **Given** a withdrawal has been recorded, **When** the user views their progress, **Then** the app shows the shortfall to restore and an estimated recovery time based on their recent contribution pace.

---

### User Story 6 - Stay on track with reminders (Priority: P6)

The user chooses to be reminded to contribute — for example monthly on payday — and receives a notification at the chosen time. Reminders are entirely optional and can be changed or switched off at any time.

**Why this priority**: Because every contribution is entered by hand, a forgotten entry is a gap in the balance, the statistics, and the forecast. Reminders are the lowest-cost defense against that, but the product is fully usable without them.

**Independent Test**: Enable a reminder at a set frequency and time, verify the notification is delivered at that time, then disable it and verify no further notifications arrive.

**Acceptance Scenarios**:

1. **Given** a user who has not granted notification permission, **When** they enable reminders, **Then** the app requests permission and, if declined, explains that reminders cannot be delivered and leaves the setting off.
2. **Given** an enabled monthly reminder set for a specific day and time, **When** that time arrives, **Then** a notification prompts the user to log a contribution.
3. **Given** an enabled reminder, **When** the user disables it, **Then** no further reminder notifications are delivered.

---

### Edge Cases

- What happens when the user's monthly expenses change dramatically (for example doubling), making a previously completed goal incomplete again? The target recalculates, progress drops below 100%, and history is preserved with the change recorded.
- What happens when a user records contributions dated out of chronological order (backfilling an older month)? All statistics, streaks, and the forecast must recalculate from the corrected timeline, not from entry order.
- What happens when a user's balance reaches exactly the target? The goal is shown as reached with zero remaining and no negative or surplus figure displayed.
- What happens when every contribution is deleted after statistics and the forecast have been shown? All derived views must return to their empty states rather than showing stale figures or errors.
- What happens when the user's net saving over the trailing window is zero or negative because withdrawals matched or exceeded contributions? No completion date is projected; the app explains why instead of showing an infinite, blank, or past date.
- What happens when the device date changes or is set incorrectly, producing entries dated in the future relative to a corrected clock? Future-dated entries are excluded from pace and streak calculations and flagged for the user to correct.
- What happens when the user contributes many small amounts in a single day? Each is recorded individually and the day is treated as a single active period for streak purposes.
- How does the system handle a target of zero or a user who has already saved more than their target before setup? Zero targets are rejected at entry; an opening balance above the target shows the goal as already reached with the surplus stated.
- What happens when the app is used across a device timezone change? Entry dates remain anchored to the calendar date the user selected, not to a shifting UTC offset.
- What happens when the user reinstalls the app or replaces their device? Because data is stored only on the device, it does not follow the user automatically; they recover it by importing a file they exported earlier, and the app must make that path discoverable before it is needed rather than after.
- What happens when an import file is corrupt, truncated, hand-edited into an invalid state, or was produced by a newer version of the app? The import is refused with an explanation and existing data is left exactly as it was.
- What happens when a user imports a file that overlaps with entries already in the app? The user is asked to replace or merge, and merging does not duplicate entries that are already present.
- How does the system handle very large amounts (for example a target in the millions) in charts and layouts? Figures remain fully readable without truncation or overlap at every supported text size.
- What happens on a device with the largest accessibility text size enabled? All screens remain usable with no clipped labels or unreachable controls.

## Requirements *(mandatory)*

### Functional Requirements — Target Setting

- **FR-001**: System MUST allow the user to record their average monthly essential expenses as a currency amount greater than zero, and MUST reject zero, negative, and non-numeric input with an explanatory message.
- **FR-002**: System MUST offer at least four named conservativeness levels mapped to months of expense coverage — Lean (3 months), Balanced (6 months), Cautious (9 months), and Maximum (12 months) — and MUST allow a custom coverage duration between 1 and 24 months.
- **FR-003**: System MUST display, for each conservativeness level, a plain-language explanation of who that level suits, so the choice is informed rather than arbitrary.
- **FR-004**: System MUST calculate the target as monthly essential expenses multiplied by the selected months of coverage, and MUST show this derivation to the user alongside the result.
- **FR-005**: Users MUST be able to override the calculated target with a manually entered amount, and the system MUST record whether the active target is calculated or user-defined.
- **FR-006**: System MUST recalculate the target immediately when the expense figure or conservativeness level changes, preserving all recorded contributions and withdrawals, and MUST show the resulting change in progress percentage.
- **FR-007**: System MUST persist the target, its inputs, and its derivation so they survive app restarts and device restarts.

### Functional Requirements — Contributions and Balance

- **FR-008**: Users MUST be able to manually record a contribution with an amount greater than zero, a date, and an optional note. Manual entry is the only means of recording contributions; the system does not connect to, read from, or import from any financial institution.
- **FR-009**: System MUST reject contribution and withdrawal dates later than the current date.
- **FR-010**: Users MUST be able to record an opening balance during setup representing money already saved before using the app.
- **FR-011**: Users MUST be able to edit and delete any recorded contribution or withdrawal, with deletion requiring explicit confirmation.
- **FR-012**: System MUST maintain the current balance as the opening balance plus all contributions minus all withdrawals, and MUST recalculate it immediately after any entry is added, edited, or deleted.
- **FR-013**: System MUST display the current balance, the amount remaining to the target, and progress as a percentage of the target on the primary screen.
- **FR-014**: System MUST display a chronological history of all contributions and withdrawals, visually distinguishing the two.
- **FR-015**: System MUST show the goal as reached, together with any surplus amount, when the balance meets or exceeds the target, and MUST NOT display a negative remaining amount.

### Functional Requirements — Withdrawals

- **FR-016**: Users MUST be able to record a withdrawal with an amount, a date, and a reason selected from a predefined set or entered freely.
- **FR-017**: System MUST warn the user and require explicit confirmation when a withdrawal would exceed the current balance.
- **FR-018**: System MUST display the shortfall against the target and an estimated recovery duration based on the recent contribution pace after any withdrawal.

### Functional Requirements — Statistics and Monitoring

- **FR-019**: System MUST display balance growth over time in a visual form covering the full recorded history.
- **FR-020**: System MUST display total contributed, total withdrawn, net amount saved, number of contributions, largest single contribution, and average monthly contribution.
- **FR-021**: System MUST display the current streak of consecutive calendar months containing at least one contribution, and the longest such streak achieved.
- **FR-022**: System MUST display a month-by-month breakdown of amounts contributed and withdrawn, including months with no activity.
- **FR-023**: Users MUST be able to filter all statistics to a selected period — at minimum last 3 months, last 6 months, last 12 months, and all time — with the active period clearly labeled.
- **FR-024**: System MUST acknowledge to the user when their balance crosses 25%, 50%, 75%, and 100% of the target.
- **FR-025**: System MUST present a purposeful empty state, explaining what the view will show and what action produces it, for every statistic or chart with insufficient data.

### Functional Requirements — Forecasting

- **FR-026**: System MUST calculate a saving pace as the average monthly net amount saved — contributions minus withdrawals — over a trailing window of the most recent 6 calendar months.
- **FR-027**: System MUST project the calendar date on which the target will be reached, by dividing the amount remaining by the saving pace, and MUST present the result both as a date and as a number of months away.
- **FR-028**: System MUST display the saving pace the projection is based on, alongside the projection, and MUST state that the projection assumes that pace continues.
- **FR-029**: System MUST require at least 3 calendar months of contribution history before showing any projection, and MUST otherwise display an explicit insufficient-history state stating how much more history is required.
- **FR-030**: System MUST NOT project a date when the saving pace is zero or negative, and MUST instead explain why no date can be shown and prompt the user to record a contribution.
- **FR-031**: Users MUST be able to set a desired completion date, and the system MUST calculate the monthly contribution required to meet it and indicate whether that exceeds their current saving pace.
- **FR-032**: System MUST recalculate the pace, the projection, and any required-contribution figure whenever a contribution or withdrawal is added, edited, or deleted, or the target changes.
- **FR-033**: System MUST exclude future-dated entries from all pace, streak, and projection calculations, and MUST flag them to the user for correction.

### Functional Requirements — Reminders

- **FR-034**: Users MUST be able to enable an optional recurring contribution reminder and choose its frequency and delivery time; reminders MUST default to off.
- **FR-035**: System MUST request notification permission only when the user enables reminders, and MUST explain the consequence and leave the setting off if permission is declined.
- **FR-036**: Users MUST be able to change or disable reminders at any time, and no further reminders may be delivered once disabled.

### Functional Requirements — Data, Platform, and Experience

- **FR-037**: System MUST run on both Android and iOS with equivalent features on both platforms.
- **FR-038**: System MUST store and calculate all monetary values exactly, with no rounding drift across any sequence of entries; displayed values are rounded for presentation only.
- **FR-039**: Users MUST select a single currency during setup, and all amounts MUST be displayed in that currency with formatting consistent with the user's device locale.
- **FR-040**: System MUST allow every feature of the app to be used with no network connectivity, at any time.
- **FR-041**: System MUST store all user data on the user's own device only. No user account, sign-in, or registration is required or offered, and no user data is transmitted off the device.
- **FR-042**: System MUST open directly to the user's fund without any in-app lock, passcode prompt, or biometric gate. Access to the app is governed solely by the device's own lock screen.
- **FR-043**: System MUST persist all user data across app restarts, device restarts, and app updates.
- **FR-044**: Users MUST be able to export their complete data — goal, all entries, and settings — to a file in a portable, human-readable format, and the app MUST make clear that export is how history is preserved if the device is lost or the app is reinstalled.
- **FR-045**: Users MUST be able to restore their data by importing a file previously produced by the export, on the same device or a different one, on either platform.
- **FR-046**: System MUST validate an imported file before applying it, MUST reject a malformed or unrecognized file with an explanation of what was wrong, and MUST leave existing data untouched when an import fails — no partial import may ever be applied.
- **FR-047**: System MUST require the user to choose between replacing all existing data and merging when importing into an app that already holds data, MUST state plainly what each choice will do before it happens, and MUST NOT produce duplicate entries when merging a file that overlaps with existing history.
- **FR-048**: Users MUST be able to permanently erase all their data from the app, with explicit confirmation before the erasure occurs.
- **FR-049**: System MUST meet WCAG 2.1 Level AA for all screens, including a minimum 4.5:1 text contrast ratio, accessible names on all interactive elements, full screen-reader operability, and no reliance on color alone to convey meaning.
- **FR-050**: System MUST remain fully usable at the largest device text size supported by each platform, with no clipped content or unreachable controls.
- **FR-051**: System MUST define and render loading, empty, error, and populated states for every view that depends on stored or computed data.
- **FR-052**: System MUST provide visible feedback for every user action within 100 milliseconds, and MUST require confirmation for destructive actions.

### Key Entities *(include if feature involves data)*

- **User Profile**: The person's saving context — average monthly essential expenses, selected currency, and app preferences including reminder settings. Held on the device and tied to no account or identity.
- **Fund Goal**: The savings target — the target amount, whether it was calculated or user-defined, the conservativeness level and coverage months used, the optional desired completion date, and the date the goal was set or last changed.
- **Ledger Entry**: A single movement of money — its type (contribution or withdrawal), amount, calendar date, optional note, and reason for withdrawals. Every entry is created by the user by hand. The complete, ordered set of entries is the sole source of truth for the balance.
- **Balance**: The derived current amount saved — opening balance plus contributions minus withdrawals — never stored independently of the entries that produce it.
- **Progress Summary**: The derived view of standing against the goal — amount saved, amount remaining or surplus, percentage complete, and the highest milestone crossed.
- **Saving Statistics**: Derived aggregates over a selected period — totals, counts, averages, per-month breakdown, current streak, and longest streak.
- **Forecast**: The derived projection — the saving pace over the trailing 6-month window, the projected completion date and months remaining, and, when a desired completion date is set, the monthly contribution required to meet it.
- **Reminder Setting**: The user's optional notification schedule — enabled state, frequency, and delivery time.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time user can go from opening the app to seeing their personalized target amount in under 3 minutes without external help.
- **SC-002**: A returning user can record a contribution in 3 interactions or fewer and in under 20 seconds from opening the app.
- **SC-003**: In usability testing, at least 90% of users correctly state their target amount, current balance, and percentage complete after 30 seconds on the primary screen.
- **SC-004**: In usability testing, at least 80% of users correctly state their projected completion date and the monthly saving pace it assumes, without additional explanation.
- **SC-005**: Every displayed figure reflects the user's latest entry within 1 second of that entry being saved.
- **SC-006**: 100% of app features are usable with the device offline, with no feature unavailable, degraded, or blocked by a lack of connectivity.
- **SC-007**: Across reconciliation testing of at least 1,000 randomized entry sequences, the reported balance matches the exact sum of entries in 100% of cases, with zero rounding discrepancies.
- **SC-008**: Across backtesting on at least 100 historical saving records, the projected months-to-target is within 10% of the actual outcome in at least 75% of cases where the saver maintained their trailing pace.
- **SC-009**: 100% of screens pass a WCAG 2.1 Level AA audit covering contrast, screen-reader operability, focus visibility, and largest supported text size, on both platforms.
- **SC-010**: At least 60% of users who complete target setup record their first contribution within 7 days.
- **SC-011**: At least 40% of users who record a first contribution are still recording contributions 90 days later.
- **SC-012**: Every primary screen becomes interactive within 2 seconds of launch on a mid-range device that is 3 years old.
- **SC-013**: Feature parity between Android and iOS is 100% — no user-facing capability is available on only one platform.
- **SC-014**: Zero user data leaves the device — verified by network monitoring showing no outbound transmission of user-entered financial data during a full pass over every feature.
- **SC-015**: Exporting a fund and importing it into a fresh installation reproduces the goal, every entry, the balance, and all statistics identically in 100% of test cases, including across a switch between platforms.

## Assumptions

- The product serves individual consumers managing personal savings; there are no shared, joint, or advisor-managed funds in this scope.
- A user tracks exactly one emergency fund. Multiple named goals or sub-funds are deferred to a later feature.
- The app records money the user has set aside elsewhere; it does not hold, move, or transfer funds, and is not a payment or banking product.
- Every contribution and withdrawal is entered by the user by hand, so the app's figures are only as complete as the user's own record-keeping. This is why the optional reminders in User Story 6 exist.
- All data lives on the device with no account. The user is the only party who can see it, and the app has no way to recover it for them if the device is lost and they never exported. Export and import are the entire backup story for this release.
- The export format is stable enough to be read back by the app on either platform, and is the same format users are told to keep as their own record.
- Anyone who can unlock the device can see the user's fund. The app relies entirely on the device lock screen for that protection, on the assumption that a tracker holding no money and moving no money does not warrant a second lock. In-app access control arrives with the planned accounts and authentication release.
- The forecast is a straight-line projection of the trailing 6-month pace onto the remaining amount. It is not a statistical confidence model and makes no claim about how likely the user is to maintain that pace.
- The conservativeness levels of 3, 6, 9, and 12 months reflect widely published personal-finance guidance; they are defaults, and the custom option exists for users whose circumstances differ.
- The fund is held in an account whose growth comes from the user's deposits; interest and investment returns are not modeled and are not part of projections.
- One currency per user, fixed at setup and changeable only by resetting the fund; multi-currency funds and conversion are out of scope.
- Users are assumed to know roughly what they spend in a month; the app does not analyze or categorize their spending to derive that figure.

## Out of Scope

- Bank account linking, automatic transaction import, and any connection to a financial institution or data aggregator.
- User accounts, sign-in, authentication, cloud sync, multi-device access, and server-side backup. These are planned for a future release and the data model should not make them harder to add later.
- In-app locking of any kind — app passcode, PIN, biometric gate, or encryption at rest behind a user secret. Deferred to the accounts and authentication release.
- Automatic or silent restore through platform backup services such as iCloud or Android Auto Backup. Recovery is by explicit user-initiated import only.
- Consistency or reliability scoring of saving behavior, confidence intervals or projection ranges, and what-if scenario simulation.
- Budgeting, expense tracking, debt payoff planning, and retirement or investment planning.
- Holding, transferring, or investing user funds, and any interest or return modeling.
- Multiple concurrent savings goals, shared or joint funds, and household or family accounts.
- Multi-currency funds and currency conversion.
- Financial advice, product recommendations, or referrals to financial institutions.
- Web or desktop clients.

## Dependencies

- Platform notification services on Android and iOS, required only for the optional reminders in User Story 6.
- Platform file selection and sharing services on both platforms, required for exporting a data file and choosing one to import.
- Device-local persistent storage sufficient to retain the complete entry history for the life of the fund.
- No third-party financial data provider, backend service, or network connectivity is required for any part of this feature.
