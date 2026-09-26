---
paths:
  - '**/*.{ts,tsx}'
---

# Anti-patterns

Mistakes this project has actually made, kept so they are recognised the second time rather than rediscovered. Each one names the tell — the thing visible at the time, before the cost was.

These are observations, not rules. When one hardens into something that can be stated as "always do X", it moves to the rule file that governs it and leaves a tombstone here saying where it went.

Each carries an id, the way requirements and tasks do, so a commit message or a code comment can cite one without restating it. **Ids are never reused.** A retired entry leaves its number behind as a gap, because `AP-004` meaning one thing in an old commit and another in a new one is worse than an unused number.

## Tests that cannot fail

**AP-001 — an assertion on a prop nothing carries.** `expect(element.props.behavior).toBeUndefined()` on a `KeyboardAvoidingView` read `undefined` on every platform, because RNTL returns the host view and the composite consumes the prop. It shipped as the guard on a real bug and asserted nothing at all.
**The tell:** a mutation that should have killed the test did not, and the explanation offered was about the code rather than about the assertion.

**AP-002 — a fixture equal to the default.** A test storing a `balanced` goal passed against a screen that ignored storage entirely, because `balanced` is also what a fresh draft starts on.
**The tell:** the value in the fixture is the first one that came to mind. Ask what the code would fall back to if it ignored the input, and make sure the fixture is not that.

**AP-003 — an order that agrees with insertion order.** A repository test asserted entries come back by date and survived deleting the whole `ORDER BY`, because SQLite returns rows in insertion order when nothing tells it otherwise.
**The tell:** the expected order and the order the test wrote the rows in are the same. Construct them opposed.

**AP-004 — a test built on a premise the code forbids.** A test added a future-dated entry through the hook to prove the balance excludes it — but validation refuses that entry, so it proved nothing about exclusion.
**The tell:** the test fails for a reason unrelated to its own subject. That is information about the domain, not an obstacle to route around.

**AP-011 — an event fired and not awaited.** RNTL v14 made `fireEvent` return a promise, and the state updates it causes land when it resolves. Six contribute-screen tests failed as though the reducer were broken — a refusal that would not clear, a picked day that never showed. The picker's own tests had the same missing `await` and passed, only because the callback they asserted on runs synchronously. Nothing in lint flagged either.
**The tell:** a rendered value that should follow an event does not, while a spy on the same event reports it was called. Check the signature in the `.d.ts` before suspecting the component.

## Explanations invented to fit a surprise

**AP-005 — reaching for a mechanism instead of measuring one.** A surviving mutation was explained by "`babel-preset-expo` folds `Platform.OS` per bundle, so the other branch does not exist". It was false, it was written into three files and a commit message, and it sent a whole task down the wrong path. The real cause was AP-001.
**The tell:** the explanation is about a tool's internals, arrived at by reasoning rather than by looking, and it conveniently means nothing needs fixing. Read the `.d.ts`, transform the file, print the value.
**Again, twice in one round (T081):** `addDays` shipped a comment saying local time would break across daylight saving — a mutation to local time survived, because stepping by calendar field is correct in any zone; only adding a day of milliseconds breaks. And the iOS date picker was handed `pt-BR` on the belief that SwiftUI accepts either form; the simulator drew "September 2026" until it got `pt_BR`. Both were caught by looking — a mutation and a screenshot — which is the point of this entry.

**AP-006 — trusting a type's name over its declaration.** `PlatformOSType` looked like the type of `Platform.OS`. It is wider — it admits `'native'`, which `Platform.OS` never holds.
**The tell:** the names match. Check the declaration, and let `npm run typecheck` decide.

**AP-007 — applying a language feature without checking the engine.** `toSorted` typechecks — `tsconfig` targets `esnext` — and does not exist on Hermes. In the one place this codebase sorts, it would have been a boot crash on device.
**The tell:** a new built-in, and a compiler that is happy. The compiler is not the runtime; probe the device.

## Code that exists to be tested

**AP-008 — guards for states the types forbid.** `'amount' in patch && patch.amount !== undefined`, and `patch.note ?? null`, under `exactOptionalPropertyTypes` where a present optional is always defined. Reaching full branch coverage meant deleting them, not testing them.
**The tell:** a branch that is hard to write a test for. Ask whether it can happen before asking how to cover it.

## Documentation that outlives its truth

**AP-009 — a comment restating the assumption that caused the bug.** `automaticallyAdjustKeyboardInsets` carried "Android resizes the window instead" — the belief that had just been disproved by a day of debugging, left in place beside the fix.
**The tell:** fixing a behaviour without re-reading the comments that describe it.

**AP-010 — a rule written for a practice the project has never followed.** The TDD rule said the failing-test and implementation tasks were separate commits. The pre-commit hook makes that impossible, and the history had bundled them from the start. A week was spent parking files to obey it.
**The tell:** the rule describes what ought to be true. Check `git log` for whether it ever was.
