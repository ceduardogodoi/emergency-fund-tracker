---
paths:
  - "**/*.{ts,tsx}"
---

# Naming and language

**Spell identifiers out.** No single-letter names (`r`, `e`, `f`), no terse abbreviations where the full word fits: `repositories` not `repos`, `result` not `res`, `error` not `err` as a local. This applies in test files and short callbacks as much as in source. The comments and JSDoc here explain _why_ code is the way it is, and a body full of one-letter names undercuts that — the reader has to reconstruct what each name refers to before the explanation is usable.

**Import React types by name.** `import type { ReactNode } from 'react'`, then `ReactNode` — never `React.ReactNode`. The namespace form relies on the ambient `React` global the JSX runtime happens to provide; a named import states the dependency the file actually has. Use `import type` for type-only imports so they erase at build.

**Numeric separators above 999.** `1_250`, `200_000`, `1_200_000` — in source, tests, fixtures, and seed data alike. It matters most for money in minor units, where miscounting digits is the exact failure the branded `Money` type exists to prevent.

**`async`/`await`, never `.then()`.** Including the two-callback `then(onFulfilled, onRejected)`. The awaited form reads in the order it executes and shares one error-handling shape with synchronous code. Inside a React effect the callback itself cannot be `async` — React reads its return value as the cleanup function — so declare an inner `async function` and call it with `void`, keeping the cleanup return at the outer level.

**JSDoc on every export.** Core types, all functions, and each member of an interface contract, with `@param`, `@returns`, and `@throws` wherever the contract is not evident from the signature. Partial documentation is worse than none: it reads as "the undocumented ones do not matter" and leaves the contract implicit exactly where a reader would look for it. Say what the units are, what throws, whether a result can be negative — never restate the signature in prose.

**Explicit class member modifiers.** `public today(): CalendarDate`, `private readonly options: Options` — attributes and methods, constructor parameter properties included, `readonly` wherever a field is never reassigned. TypeScript's implicit `public` makes the boundary between contract and internals invisible at the declaration. Enforced by `@typescript-eslint/explicit-member-accessibility`.
