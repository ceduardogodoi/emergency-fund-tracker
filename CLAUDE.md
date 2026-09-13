# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Rules

House rules live in [`.claude/rules/`](.claude/rules/), one file per topic, each with the reason it exists. They load automatically — the code ones when you touch `.ts`/`.tsx`, the testing ones under `tests/`, and `workflow.md` and `tooling.md` always. They are not preferences to weigh; they are decisions already made.

The two that change what you do rather than how you write it:

- **Present the diff and wait for review before committing.** A green `npm run verify` means the change is ready to show, not ready to commit.
- **Tests come before implementation**, and every new assertion is proved by breaking the code it covers and watching the suite go red. Constitution Principle IV, non-negotiable.

## Commands

|                                                     |                                                                                                     |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `npm run verify`                                    | Format, lint, typecheck, and the full suite with coverage floors. The gate the pre-commit hook runs |
| `npm test`                                          | All three Jest projects                                                                             |
| `npm run test:unit` / `:integration` / `:component` | One project                                                                                         |
| `npx jest --selectProjects unit path/to.test.ts`    | One file                                                                                            |
| `npx jest --selectProjects component -t "the name"` | One test by name. The filter matches across files, so a name shared with another suite runs both    |
| `npm start`                                         | Expo dev server, which the e2e suites need                                                          |
| `npm run e2e` / `npm run e2e:ios`                   | Maestro against an Android emulator / iOS simulator                                                 |
| `npm run e2e:clean`                                 | Removes the Maestro artifacts those runs leave behind                                               |

## Architecture

An offline-only Expo app. Nothing leaves the device: no network calls, no analytics, no crash reporting (FR-041, verified by a network-monitoring success criterion). SQLite is the only store.

**Dependencies point inward** (Constitution Principle III), which is the structure worth knowing before editing anything:

| Layer           | Holds                                                                                              | May import                    |
| --------------- | -------------------------------------------------------------------------------------------------- | ----------------------------- |
| `src/domain/`   | Pure rules and types. No I/O, no async, no React. Ports are declared here as interfaces            | nothing outside `src/domain/` |
| `src/data/`     | SQLite adapters implementing the repository ports, plus migrations and mappers                     | domain                        |
| `src/platform/` | Adapters for the remaining ports — clock, ids, logging                                             | domain                        |
| `src/features/` | Per-feature hooks and components; TanStack Query lives here                                        | domain, ui, runtime           |
| `src/ui/`       | Tokens, primitives, strings, formatters. The only place a style value or user-facing string exists | domain types                  |
| `src/runtime/`  | Composition root, query client, services context, boot                                             | everything                    |
| `app/`          | Expo Router routes, and nothing else                                                               | everything                    |

**`app/` is routes only.** Expo Router treats _every_ file under its root as a route, and it prefers `src/app/` over `app/` when that directory exists — which is why the composition root lives in `src/runtime/` and `app.json` sets `expo.extra.router.root` explicitly. A non-route module under `app/` becomes a broken route.

**Errors are values.** Every fallible operation returns `Result<T, E>` from `src/domain/result.ts`; exceptions are reserved for programmer errors, like handing `money()` a fractional cent. There is exactly one place a result becomes an exception — `unwrap` in `src/features/goal/hooks.ts` — because TanStack Query decides a query failed by catching what its function throws.

**Money and dates are branded.** `Money` is an integer count of minor units, never a float; `CalendarDate` is a `YYYY-MM-DD` string with no time or zone. The brands make passing a raw `number` or `string` a compile error. Division happens only in `src/domain/money/rounding.ts`.

**Every data-backed view renders four states.** `StateView` takes `loading`, `empty`, `error`, and `ready` renderers, with `empty` required and no default — a meaningful empty state is something only the screen knows. Screens map a query onto it with `toViewState`.

**Repositories not yet implemented fail loudly.** `src/data/sqlite/repositories/pending.ts` returns a storage failure for every call, deliberately: a stub returning `ok([])` would be indistinguishable from an empty fund, and the app would render a zero balance as though it were the truth.

## Plan of record

Built with Spec Kit. [`specs/001-emergency-fund-tracker/tasks.md`](specs/001-emergency-fund-tracker/tasks.md) is the plan of record — numbered tasks worked in order, with commit scopes naming the task being closed and the checkbox moving in the same commit. The spec, plan, data model, and the domain-port, UI, and export-format contracts sit beside it, and [`.specify/memory/constitution.md`](.specify/memory/constitution.md) holds the six principles the rules defer to.
