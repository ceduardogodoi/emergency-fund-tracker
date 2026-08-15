# Phase 1 Data Model: Emergency Fund Tracker

**Feature**: `specs/001-emergency-fund-tracker` | **Date**: 2026-08-15 | **Plan**: [plan.md](./plan.md)

Two rules govern everything below.

**The ledger is the only truth.** Balance, progress, statistics, and the forecast are all derived on read from the ordered set of ledger entries. None of them is stored. A stored balance would be a second source of truth that could drift from the entries that produced it, and SC-007 exists precisely to prove it never does.

**Money is an integer.** Every monetary column holds minor units (cents) as an integer. No column anywhere holds a floating-point amount.

## Stored entities

### `profile` — single row

The person's saving context. Exactly one row, created during onboarding.

| Field | Type | Rules |
|-------|------|-------|
| `id` | integer | Always `1`. A `CHECK (id = 1)` constraint enforces the single row. |
| `monthly_expenses_minor` | integer | > 0 (FR-001) |
| `currency_code` | text | ISO 4217, 3 uppercase letters. Fixed at setup; changing it requires erasing the fund (FR-039). |
| `created_at` | text | ISO 8601 UTC instant |
| `updated_at` | text | ISO 8601 UTC instant |

### `goal` — single row

The active target. Exactly one row.

| Field | Type | Rules |
|-------|------|-------|
| `id` | integer | Always `1`, same single-row constraint |
| `target_minor` | integer | > 0. Rejected at zero (spec edge case). |
| `source` | text | `calculated` or `user_defined` (FR-005) |
| `level_key` | text | `lean`, `balanced`, `cautious`, `maximum`, or `custom` (FR-002) |
| `coverage_months` | integer | 1–24 (FR-002). Retained even when `source` is `user_defined`, so switching back to calculated restores the prior choice. |
| `desired_completion_date` | text, nullable | `YYYY-MM-DD`, must be later than today when set (FR-031) |
| `created_at` | text | ISO 8601 UTC instant |
| `updated_at` | text | ISO 8601 UTC instant — "the date the goal was set or last changed" |

**Invariant**: when `source` is `calculated`, `target_minor` equals `profile.monthly_expenses_minor × coverage_months`. Enforced in the domain on every write, and asserted in tests rather than trusted.

### `goal_change` — append-only

One row per change to expenses, level, or target. Exists because the spec requires that when expenses change, "history is preserved with the change recorded".

| Field | Type | Rules |
|-------|------|-------|
| `id` | text | UUID v4 |
| `changed_at` | text | ISO 8601 UTC instant |
| `previous_target_minor` | integer | > 0 |
| `new_target_minor` | integer | > 0 |
| `previous_expenses_minor` | integer | > 0 |
| `new_expenses_minor` | integer | > 0 |
| `previous_coverage_months` | integer | 1–24 |
| `new_coverage_months` | integer | 1–24 |

Never edited, never deleted except by a full erase or a replacing import.

### `ledger_entry` — the ledger

Every movement of money. This table is the fund.

| Field | Type | Rules |
|-------|------|-------|
| `id` | text | UUID v4, generated at creation, **preserved across export and import** — this is what makes merge deduplication exact (FR-047) |
| `type` | text | `opening`, `contribution`, or `withdrawal` |
| `amount_minor` | integer | > 0 always. Direction is carried by `type`, never by a negative amount. |
| `entry_date` | text | `YYYY-MM-DD`. Not later than today at time of entry (FR-009). |
| `note` | text, nullable | Max 280 characters. Contributions and openings only. |
| `withdrawal_reason` | text, nullable | Required when `type` is `withdrawal` (FR-016), forbidden otherwise. Free text or a predefined key. |
| `created_at` | text | ISO 8601 UTC instant |
| `updated_at` | text | ISO 8601 UTC instant |

**Constraints**:

- At most one row with `type = 'opening'`, enforced by a partial unique index. Its `entry_date` is the setup date.
- `CHECK (amount_minor > 0)`
- `CHECK ((type = 'withdrawal') = (withdrawal_reason IS NOT NULL))`
- Indexed on `entry_date` — every statistic and the pace window scan by date.

**Why `opening` is an entry and not a column**: FR-012 defines the balance as opening plus contributions minus withdrawals, and the plan holds that the entry set is the only truth. Modelling the opening balance as a column would put one term of the balance outside the ledger. As an entry it also anchors the left edge of the balance-over-time chart correctly. Its cost is one exclusion rule, stated once below and tested.

### `reminder_setting` — single row

| Field | Type | Rules |
|-------|------|-------|
| `id` | integer | Always `1` |
| `enabled` | integer | 0 or 1. Defaults to 0 (FR-034). |
| `frequency` | text | `weekly` or `monthly` |
| `day_of_month` | integer, nullable | 1–28 when `frequency` is `monthly`. Capped at 28 so every month has the day. |
| `day_of_week` | integer, nullable | 0–6 when `frequency` is `weekly` |
| `time_of_day` | text | `HH:MM` local |

### `milestone_ack` — append-only

Records which milestones have already been shown, so FR-024 fires once per crossing rather than on every render.

| Field | Type | Rules |
|-------|------|-------|
| `threshold` | integer | 25, 50, 75, or 100. Primary key. |
| `acknowledged_at` | text | ISO 8601 UTC instant |

**Re-crossing rule**: if the balance falls back below a threshold — after a withdrawal, or after the target rises — that threshold's row is deleted, so crossing it again is acknowledged again. Without this, a user who recovers from a withdrawal would silently pass 50% with no acknowledgement.

## Derived values — computed, never stored

### Balance (FR-012)

```
balance = Σ(opening) + Σ(contribution) − Σ(withdrawal)
```

Over all entries dated today or earlier. Future-dated entries are excluded from every calculation (FR-033) and surfaced separately for correction.

### Progress summary (FR-013, FR-015)

- `remaining = max(0, target − balance)`
- `surplus = max(0, balance − target)`
- `percentComplete = balance ÷ target`, clamped to 0–100 for display, rounded to two decimals for presentation only
- `isReached = balance ≥ target`

Exactly one of `remaining` and `surplus` is non-zero — never a negative remaining (FR-015). At exactly the target, both are zero and `isReached` is true.

### Saving statistics (FR-020 – FR-023)

All scoped to the selected period, defaulting to all time.

| Value | Definition |
|-------|------------|
| Total contributed | Σ of `contribution` amounts. **Excludes `opening`.** |
| Total withdrawn | Σ of `withdrawal` amounts |
| Net saved | Total contributed − total withdrawn |
| Contribution count | Count of `contribution` rows. **Excludes `opening`.** |
| Largest contribution | Max `contribution` amount |
| Average monthly contribution | Total contributed ÷ number of complete calendar months in the period, rounded down to the minor unit |
| Per-month breakdown | One bucket per calendar month in range, including months with zero activity (FR-022) |

**Streaks (FR-021)**: a month counts as active if it holds at least one `contribution`. The current streak counts back from the current month; if the current month has no contribution yet, counting starts from the previous month, so a streak is not reported as broken partway through a month that has not ended. The longest streak is the longest run of active months anywhere in history.

### Forecast (FR-026 – FR-032)

Per D-017, the pace window is **complete calendar months only** — the in-progress month is excluded from the pace, though its entries still count toward the balance.

```
window        = up to 6 most recent complete calendar months
monthsInWindow= count of complete months in the window   (≥ 3 required, FR-029)
pace          = Σ(net saved in window) ÷ monthsInWindow   (integer minor units, rounded down)
monthsToTarget= ceil(remaining ÷ pace)
projectedDate = last day of (current month + monthsToTarget)
```

State machine for what the forecast screen shows:

| Condition | Result |
|-----------|--------|
| `monthsInWindow < 3` | `insufficient-history`, stating how many more months are needed (FR-029) |
| `pace ≤ 0` | `no-pace`, explaining that a date cannot be projected at a pace of zero and prompting a contribution (FR-030) |
| `isReached` | `reached` — no projection needed |
| otherwise | `projected` with `pace`, `monthsToTarget`, and `projectedDate` (FR-027, FR-028) |

**Required monthly contribution (FR-031)**, when a desired completion date is set:

```
monthsAvailable = whole calendar months between now and desiredCompletionDate  (≥ 1)
requiredMonthly = ceil(remaining ÷ monthsAvailable)
exceedsPace     = requiredMonthly > pace
```

**Recovery estimate after a withdrawal (FR-018)**: the same projection applied to the shortfall rather than the full remaining amount.

### Rounding policy

Division appears in exactly four places: average monthly contribution, pace, months-to-target, and required monthly contribution. One module owns all of it.

- Amounts derived by division round **down** to the minor unit, so the app never overstates what the user has been saving.
- Month counts derived by division round **up**, so the app never promises an earlier date than the arithmetic supports.
- Display rounding is presentation only and never feeds another calculation.

## State transitions

**Goal**: `absent → active` on onboarding completion. `active → active` on any revision, which appends a `goal_change` row and clears any `milestone_ack` rows now above the balance. `active → reached` is derived from the balance, not stored, so it reverses on its own when a withdrawal or a raised target drops the balance back below the target.

**Ledger entry**: `created → edited → deleted`. Deletion is a hard delete requiring confirmation (FR-011). Editing changes `amount_minor`, `entry_date`, `note`, or `withdrawal_reason`, never `id` or `type` — changing an entry's type means deleting it and creating the other kind, which keeps the merge identity in FR-047 stable.

**Reminder**: `off → on` requires an OS permission grant; a denial leaves it `off` (FR-035). `on → off` cancels every scheduled notification (FR-036).

## Import merge and replace semantics (FR-047)

**Replace**: delete every row in every table, then insert the document's contents. One transaction.

**Merge**: insert only `ledger_entry` rows whose `id` is not already present. An id already present is skipped entirely — never updated — so an import can never silently rewrite an entry the user edited after exporting. `profile`, `goal`, and `reminder_setting` are left as they are on merge, since the local ones are current. `milestone_ack` is recomputed from the resulting balance.

Both paths run inside a single transaction that either commits whole or rolls back whole, which is what makes FR-046's "no partial import may ever be applied" a property of the code rather than a promise.

## Schema versioning

`PRAGMA user_version` holds the schema version. Migrations are forward-only, each a numbered step applied in order inside a transaction, with the version bumped as the last statement of the step. Every migration gets an integration test that starts from the previous version's schema with data in it and asserts the data survives — FR-043 requires data to survive app updates, and an untested migration is where that promise breaks.

## Requirements traceability

| Area | Requirements covered |
|------|---------------------|
| `profile`, `goal`, `goal_change` | FR-001 – FR-007 |
| `ledger_entry` | FR-008 – FR-017 |
| Derived statistics | FR-018 – FR-025 |
| Forecast | FR-026 – FR-033 |
| `reminder_setting` | FR-034 – FR-036 |
| Money, dates, storage, transfer | FR-038, FR-039, FR-041, FR-043 – FR-047 |
