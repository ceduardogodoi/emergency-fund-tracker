---
paths:
  - "**/*.{ts,tsx}"
---

# Arrays

**Prefer the copying methods over spread-then-mutate** — `entries.toReversed()` rather than `[...entries].reverse()`. One call, one allocation, and the intent is in the method name.

**Except `toSorted`, which Hermes does not have.** Measured on device on 2026-09-13, identically on an iOS simulator and an Android emulator running Expo Go with Hermes 0.17:

| `toReversed` | `with` | `toSpliced` | `at` | `findLast` | `toSorted` |
| ------------ | ------ | ----------- | ---- | ---------- | ---------- |
| yes          | yes    | yes         | yes  | yes        | **no**     |

So sorting a copy stays `[...migrations].sort(…)`. This is not theoretical: `src/data/sqlite/migrations/runner.ts` sorts at every app launch, and `toSorted` there would be a boot crash on device that no test in this repo would catch — `tsconfig` targets `esnext`, so TypeScript accepts every one of these regardless of what the engine ships. Re-measure before relying on any newer built-in; the probe was a temporary line on a screen read back through Maestro, and it took about two minutes.
