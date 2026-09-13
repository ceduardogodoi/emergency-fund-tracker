# Conventions

House rules for this codebase, gathered as they came up in review. Each one exists because something was written the other way first, so each says _why_ — a rule you cannot argue with is a rule nobody can correct.

This sits one level below [the constitution](../.specify/memory/constitution.md). The constitution holds principles and is versioned with a sync-impact report; these are the conventions that implement them, and they change without ceremony. If the two ever disagree, the constitution wins.

Where a rule can be enforced mechanically it is — by ESLint, by `tsconfig`, or by a test. The rest live here.

## Naming and language

**Spell identifiers out.** No single-letter names (`r`, `e`, `f`), no terse abbreviations where the full word fits: `repositories` not `repos`, `result` not `res`, `error` not `err` as a local. This applies in test files and short callbacks as much as in source. The comments and JSDoc here explain _why_ code is the way it is, and a body full of one-letter names undercuts that — the reader has to reconstruct what each name refers to before the explanation is usable.

**Import React types by name.** `import type { ReactNode } from 'react'`, then `ReactNode` — never `React.ReactNode`. The namespace form relies on the ambient `React` global the JSX runtime happens to provide; a named import states the dependency the file actually has. Use `import type` for type-only imports so they erase at build.

**Numeric separators above 999.** `1_250`, `200_000`, `1_200_000` — in source, tests, fixtures, and seed data alike. It matters most for money in minor units, where miscounting digits is the exact failure the branded `Money` type exists to prevent.

**`async`/`await`, never `.then()`.** Including the two-callback `then(onFulfilled, onRejected)`. The awaited form reads in the order it executes and shares one error-handling shape with synchronous code. Inside a React effect the callback itself cannot be `async` — React reads its return value as the cleanup function — so declare an inner `async function` and call it with `void`, keeping the cleanup return at the outer level.

**JSDoc on every export.** Core types, all functions, and each member of an interface contract, with `@param`, `@returns`, and `@throws` wherever the contract is not evident from the signature. Partial documentation is worse than none: it reads as "the undocumented ones do not matter" and leaves the contract implicit exactly where a reader would look for it. Say what the units are, what throws, whether a result can be negative — never restate the signature in prose.

**Explicit class member modifiers.** `public today(): CalendarDate`, `private readonly options: Options` — attributes and methods, constructor parameter properties included, `readonly` wherever a field is never reassigned. TypeScript's implicit `public` makes the boundary between contract and internals invisible at the declaration. Enforced by `@typescript-eslint/explicit-member-accessibility`.

## Types

**Use the canonical type; do not re-describe it.** When a type already has a name — exported by our own modules or by a dependency — import it. Do not write its shape inline (`({ href }: { href: string })` where `RedirectProps` exists), and do not derive it with `typeof` or `ReturnType<typeof …>` when the real type is exported. `ReturnType<typeof useRouter>` says "whatever that hook happens to return" when expo-router exports `ImperativeRouter` and means it. `Result`'s two branches had been written out by hand six times — in the union, in both type guards, and in both test helpers — before they became `Ok<T>` and `Err<E>`.

Check the `.d.ts` rather than assuming, and verify with `npm run typecheck` rather than by eye. Three cases where an inline or local type is the right answer:

- **The named type would duplicate the source of truth.** `keyof typeof typography` and `keyof typeof COVERAGE_MONTHS` derive a union from the object that defines it; writing that union out separately creates the drift this rule prevents.
- **Every candidate is wrong and a narrower local type is right.** For the platform a test renders as, react-native's `PlatformOSType` admits `'native'` and `typeof Platform.OS` admits macos, windows and web — none of which this app builds for. A local `type ShippedPlatform = 'ios' | 'android'` is tighter than either, and rejects `renderOn('web')`, which both of the others compiled. Keep such a type local until a second consumer exists.
- **The value is not what it looks like.** A `CoverageMeter` assertion appeared to need RNTL's `TestInstance` from the undeclared `test-renderer` package; the values actually came from `props.children`, so they are `ReactElement`s with `ViewProps`, both already direct dependencies. Check what the value _is_ before naming its type.

## Arrays

**Prefer the copying methods over spread-then-mutate** — `entries.toReversed()` rather than `[...entries].reverse()`. One call, one allocation, and the intent is in the method name.

**Except `toSorted`, which Hermes does not have.** Measured on device on 2026-09-13, identically on an iOS simulator and an Android emulator running Expo Go with Hermes 0.17:

| `toReversed` | `with` | `toSpliced` | `at` | `findLast` | `toSorted` |
| ------------ | ------ | ----------- | ---- | ---------- | ---------- |
| yes          | yes    | yes         | yes  | yes        | **no**     |

So sorting a copy stays `[...migrations].sort(…)`. This is not theoretical: `src/data/sqlite/migrations/runner.ts` sorts at every app launch, and `toSorted` there would be a boot crash on device that no test in this repo would catch — `tsconfig` targets `esnext`, so TypeScript accepts every one of these regardless of what the engine ships. Re-measure before relying on any newer built-in; the probe was a temporary line on a screen read back through Maestro, and it took about two minutes.

## Files and tooling

**Tool configs declare their module system in the extension.** `.mjs` where the tool accepts ESM (`eslint.config.mjs`, `jest.config.mjs`), `.cjs` where it requires CommonJS (`babel.config.cjs` — babel-jest loads it synchronously and Babel's ESM path is async). Never plain `.js`, which leaves the module system implicit in `package.json`'s `type`.

**Runtimes are pinned with asdf** in a committed `.tool-versions` at the repository root. Setup starts with `asdf install`, and CI installs from the same file. Never `.nvmrc`, `nvm use`, or "install Node LTS" as a step — Principle I requires the quality gate to run identically locally and in CI, which only holds if both read one pinned file.

**Markdown prose is not hard-wrapped.** Each paragraph, bullet, and numbered item goes on one continuous line; line breaks separate blocks only. This overrides any column-limit instruction in the Spec Kit templates. Hard wraps hurt readability when rendered and make diffs noisier than the edit.

## Testing

**Assert what a component renders, not what it was passed.** RNTL queries return the **host** element — the underlying `View`, `Text`, `ScrollView` — not the composite that carried the `testID` in the JSX. A prop the composite consumes never reaches the host, so reading it back gives `undefined` whatever was passed. `expect(element.props.behavior).toBeUndefined()` on a `KeyboardAvoidingView` passed on every platform while asserting nothing, and survived a mutation pass because the mutation it existed to catch was invisible to it. `UNSAFE_root` and `UNSAFE_getByType` are not available in this project's RNTL v14, so there is no composite escape hatch. Assert the rendered consequence instead: `behavior="padding"` composes a `paddingBottom` into the host view's style, which distinguishes the platforms _and_ fails if the prop is unwired entirely.

**Break the implementation to prove the assertion.** Every new assertion set is verified by deliberately breaking the code it covers and confirming the suite goes red. A test that has never failed is a test that has not been shown to test anything — and more than one here passed on first write for the wrong reason.

**Write each story's Maestro flow with the story**, not as a batch afterwards, and run it on an Android emulator _and_ an iOS simulator before calling the story done. The flows are the only tests that run the real app on a device, so deferring them defers the whole class of bug they catch: `e2e/us1-set-target.yaml` found two on its first run, both shipped and unnoticed while every unit, integration, and component test passed. The two platforms have failed differently every time it has mattered.

## Working practices

**Commit scopes name the task.** `feat(T058): implement calculateTarget`, referring to a task in the feature's `tasks.md`. Several tasks list them — `feat(T032-T036)` for a contiguous run, `chore(T011,T012)` otherwise. Work closing no task keeps a plain scope-less subject. Mark the task `[X]` in `tasks.md` in the same commit, so the checkbox and the history agree. Under TDD the failing-test task and the implementation task are separate commits, because they are separate task IDs.

**Present the diff and wait for review before committing.** A green `npm run verify` is permission to present a change, not permission to commit it. Reviewing before committing is how the codebase gets read as it is built, and it catches things the suite cannot: reviewing an already-committed diff once surfaced two comments that were simply wrong, one of which restated the exact stale assumption that had caused the bug being fixed. If a commit was made early, `git reset --soft HEAD~1` puts it back for review — save the message first.

**Clean up after an inspection session.** `npm run e2e:clean` removes the Maestro artifacts, which the e2e scripts write to a gitignored `.maestro-out/<platform>/` precisely so one command can. Anything from a bare `maestro test` still lands in `~/.maestro/tests/` and needs `rm -rf ~/.maestro/tests/*`; never touch `~/.maestro/deps` (the iOS driver) or `~/.maestro/sessions`, which forces a re-install. Delete throwaway flows and comparison screenshots too. Two days of unswept runs reached 405 MB.

## Environment

**After restarting the Android emulator, run `adb reverse tcp:8081 tcp:8081`** before the e2e suite. The flows open the app with `openLink: exp://127.0.0.1:8081`, and inside the emulator `127.0.0.1` is the emulator. Expo sets the reverse mapping up when it connects and an emulator restart drops it, while the dev server keeps running — so nothing looks wrong, and every flow fails on `app-root is visible` after burning the full 45-second launch timeout. Suspect it first whenever _every_ Android flow fails at launch while iOS passes; the simulator shares the host's network and is never affected.
