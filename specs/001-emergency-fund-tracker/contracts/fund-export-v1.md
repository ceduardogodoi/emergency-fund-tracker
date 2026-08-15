# Contract: Fund Export Document v1

**Feature**: `specs/001-emergency-fund-tracker` | **Date**: 2026-08-15

This is the only interface this app exposes to the outside world. It is a real contract in both directions: a file the user keeps as their own record (FR-044), and untrusted input the app must validate before applying (FR-046). It is also the compatibility boundary between app versions and between platforms — an export written on Android must import on iOS and vice versa (SC-015).

**File name**: `emergency-fund-YYYY-MM-DD.json`
**Media type**: `application/json`, UTF-8, pretty-printed with 2-space indentation so it is readable in any text editor.

## Document shape

```json
{
  "schemaVersion": 1,
  "exportedAt": "2026-08-15T09:30:00.000Z",
  "appVersion": "1.0.0",
  "profile": {
    "monthlyExpensesMinor": 200000,
    "currencyCode": "USD"
  },
  "goal": {
    "targetMinor": 1200000,
    "source": "calculated",
    "levelKey": "balanced",
    "coverageMonths": 6,
    "desiredCompletionDate": "2027-06-30",
    "createdAt": "2026-01-04T18:12:00.000Z",
    "updatedAt": "2026-05-02T08:45:00.000Z"
  },
  "entries": [
    {
      "id": "8f14e45f-ea0c-4f2b-9a1e-7d3c2b6a5f01",
      "type": "opening",
      "amountMinor": 50000,
      "entryDate": "2026-01-04",
      "note": "Already set aside",
      "withdrawalReason": null,
      "createdAt": "2026-01-04T18:12:00.000Z",
      "updatedAt": "2026-01-04T18:12:00.000Z"
    },
    {
      "id": "3c9f1a72-6b58-4d10-8e7a-1f4b2c9d0e33",
      "type": "withdrawal",
      "amountMinor": 30000,
      "entryDate": "2026-04-18",
      "note": null,
      "withdrawalReason": "car-repair",
      "createdAt": "2026-04-18T12:00:00.000Z",
      "updatedAt": "2026-04-18T12:00:00.000Z"
    }
  ],
  "goalChanges": [
    {
      "id": "b21c7e90-33af-4c62-9f88-0ad5e6c41b77",
      "changedAt": "2026-05-02T08:45:00.000Z",
      "previousTargetMinor": 900000,
      "newTargetMinor": 1200000,
      "previousExpensesMinor": 150000,
      "newExpensesMinor": 200000,
      "previousCoverageMonths": 6,
      "newCoverageMonths": 6
    }
  ],
  "reminder": {
    "enabled": true,
    "frequency": "monthly",
    "dayOfMonth": 1,
    "dayOfWeek": null,
    "timeOfDay": "09:00"
  }
}
```

## Field rules

Validated with `zod` before a single row is written. Every rule below is a rejection, not a coercion — the document is never repaired, because silently fixing a malformed financial record is worse than refusing it.

| Field | Rule |
|-------|------|
| `schemaVersion` | Integer. Exactly `1` for this version. |
| `exportedAt` | ISO 8601 UTC instant |
| `appVersion` | Semver string. Informational — never used to gate the import. |
| `profile.monthlyExpensesMinor` | Integer > 0 |
| `profile.currencyCode` | Exactly 3 uppercase letters |
| `goal.targetMinor` | Integer > 0 |
| `goal.source` | `calculated` or `user_defined` |
| `goal.levelKey` | `lean`, `balanced`, `cautious`, `maximum`, or `custom` |
| `goal.coverageMonths` | Integer 1–24 |
| `goal.desiredCompletionDate` | `YYYY-MM-DD` or null |
| `entries[].id` | UUID v4. **Unique within the document.** |
| `entries[].type` | `opening`, `contribution`, or `withdrawal` |
| `entries[].amountMinor` | Integer > 0. Never negative — direction comes from `type`. |
| `entries[].entryDate` | `YYYY-MM-DD`, a real calendar date |
| `entries[].note` | String ≤ 280 characters, or null |
| `entries[].withdrawalReason` | Non-empty string when `type` is `withdrawal`, null otherwise |
| `reminder.dayOfMonth` | Integer 1–28 when `frequency` is `monthly`, else null |
| `reminder.dayOfWeek` | Integer 0–6 when `frequency` is `weekly`, else null |
| `reminder.timeOfDay` | `HH:MM`, 24-hour |

**Cross-field rules**, checked after per-field validation passes:

- At most one entry with `type = 'opening'`.
- `goal.coverageMonths` is present whatever `source` says.
- When `goal.source` is `calculated`, `targetMinor` must equal `profile.monthlyExpensesMinor × goal.coverageMonths`. A mismatch is rejected rather than recalculated — it means the file was hand-edited, and guessing which of the two fields the user meant would be a fabrication.

## Version handling

| Found | Behavior |
|-------|----------|
| `1` | Import proceeds |
| Integer > 1 | Rejected with `import-unsupported-version`, telling the user the file came from a newer version of the app and to update (FR-046) |
| Integer < 1, missing, or not an integer | Rejected as invalid — not a fund export |

A future v2 reader must accept v1 documents. A v1 reader never attempts to read v2, because it cannot know what changed.

## Import behavior

1. Read the picked file. A read failure returns `storage`; a user cancelling the picker returns `cancelled` and changes nothing.
2. Parse as JSON. A parse failure returns `import-invalid` with the position of the problem.
3. Validate against the schema and cross-field rules. Every problem is collected with its path — `entries[7].amountMinor` — so the user sees what was wrong rather than only that something was (FR-046).
4. If the app already holds data, ask the user to choose **replace** or **merge**, stating plainly what each will do before it happens (FR-047).
5. Apply inside a single transaction (`UnitOfWork.run`). Any failure rolls the whole thing back, leaving existing data exactly as it was.

**Replace**: every table is cleared, then the document is inserted whole.

**Merge**: entries whose `id` is already present are skipped entirely — never updated — so an import cannot silently overwrite an entry edited after the export was taken. `profile`, `goal`, and `reminder` are left as they are locally. `milestone_ack` is recomputed from the resulting balance.

Both paths guarantee: importing an export into a fresh install reproduces the goal, every entry, the balance, and every statistic identically, on either platform (SC-015).

## Test obligations

- Round-trip: export → fresh install → import → every derived figure identical.
- Cross-platform round-trip: exported on one platform, imported on the other.
- Rejection cases, each asserting existing data is untouched: malformed JSON, missing `schemaVersion`, `schemaVersion: 2`, negative amount, non-integer amount, duplicate entry id, two openings, withdrawal with no reason, `calculated` target that does not match expenses × months, and a file truncated mid-array.
- Merge: overlapping ids produce no duplicates and do not modify the local copies of those entries.
- Failure mid-transaction leaves the database byte-identical to its prior state.
