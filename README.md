# Emergency Fund

A mobile app for sizing and tracking a personal emergency fund — _reserva de emergência_. You enter what you spend in a typical month, choose how many months of that the fund should cover, and the app works out the target, then tracks what you have saved towards it.

Android and iOS, built with Expo and React Native. The interface is Brazilian Portuguese and amounts are in reais.

## Everything stays on the device

There is no account, no server, and no network call. The fund lives in a SQLite database inside the app's own sandbox, and nothing is ever transmitted — no analytics, no crash reporting, no third-party SDK that phones home. That is a requirement of the spec rather than a default, and it is verified: through a full pass over every screen in release builds, the operating system's own per-app network counters recorded zero bytes sent or received, on Android and on iOS ([quickstart](specs/001-emergency-fund-tracker/quickstart.md), Cross-cutting).

The cost of that promise is that the data does not follow you to a new phone. Moving it is planned as a change of its own, not yet specified.

## Status

All six stories of the first release are built ([`specs/001-emergency-fund-tracker/`](specs/001-emergency-fund-tracker/)): a personalised target, recording savings and progress, statistics, a forecast of when the goal is reached, withdrawals and recovery, and monthly or weekly reminders. A navigation menu replaced Home's buttons to the other sections ([`specs/002-drawer-navigation/`](specs/002-drawer-navigation/)). What remains is release verification — some of it waiting on a physical iPhone and a mid-range Android phone — and the work listed in [`specs/backlog.md`](specs/backlog.md).

## Getting started

Runtimes are pinned in [`.tool-versions`](.tool-versions) and managed with [asdf](https://asdf-vm.com):

```bash
asdf install    # the Node.js version in .tool-versions
npm ci          # the exact dependencies in package-lock.json
npm start       # the Expo dev server
```

Press `a` or `i` in the dev server to open the app in Expo Go on an Android emulator or iOS simulator. Node.js comes from asdf only, never from a separate install or `nvm`: CI reads the same `.tool-versions`, which is how the gate runs identically on every machine. There are no accounts, keys, or environment variables to set up.

## Working on it

| Command                                             | What it does                                                                                                    |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `npm run verify`                                    | Format, lint, typecheck, and the full suite with coverage floors. The gate the pre-commit hook runs             |
| `npm test`                                          | Jest — the unit, integration, and component projects                                                            |
| `npm run test:unit` / `:integration` / `:component` | One project                                                                                                     |
| `npx jest path/to.test.ts --selectProjects unit`    | One file. The path goes first: `--selectProjects` takes a list, and swallows a path after it                    |
| `npm run test:a11y`                                 | The accessibility suites: colour contrast, the statistics read aloud, and every screen at the largest text size |
| `npm run typecheck` / `npm run lint`                | TypeScript in strict mode / ESLint with warnings as errors                                                      |
| `npm run e2e` / `npm run e2e:ios`                   | Maestro flows on an Android emulator / iOS simulator, with the dev server running                               |
| `npm run e2e:clean`                                 | Removes the artifacts those runs leave behind                                                                   |
| `npm run seed -- --months 8 --pattern steady`       | Fills the app in Expo Go with a synthetic fund, through a development-only route; `--reset` empties it          |

Tests come before implementation, and `npm run verify` has to pass before a commit — the hook runs it either way. The end-to-end flows run the real app on a device and have caught several defects that every other test missed, so they run on **both** platforms before a story is called done.

## How it is organised

```
app/          Expo Router routes, and nothing else
src/domain/   Pure rules and types — no I/O, no React. Ports declared as interfaces
src/data/     SQLite adapters for those ports, plus migrations
src/platform/ Adapters for the rest — clock, ids, logging
src/features/ Per-feature hooks and components
src/ui/       Design tokens, primitives, strings, formatters
src/runtime/  Composition root, query client, app boot
tests/        Unit, integration, and component suites
e2e/          Maestro flows, written alongside the story each covers
```

**Dependencies point inward.** Each layer imports only from the layers listed beside it, so the rules of the fund can be tested without a database, a device, or React, and a storage or UI change cannot reach into them:

| Layer           | May import                          |
| --------------- | ----------------------------------- |
| `src/domain/`   | nothing outside `src/domain/`       |
| `src/data/`     | domain                              |
| `src/platform/` | domain                              |
| `src/ui/`       | domain                              |
| `src/features/` | domain, ui, runtime, other features |
| `src/runtime/`  | everything                          |
| `app/`          | everything                          |

`app/` holds routes and nothing else: Expo Router turns every file under it into a screen, so a helper placed there becomes a broken route. Money is an integer count of centavos behind a branded type, so a float can never reach an amount, and every fallible operation returns a `Result` rather than throwing.

## Documents

|                                                                                              |                                                                        |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| [`.specify/memory/constitution.md`](.specify/memory/constitution.md)                         | The six principles the project is held to                              |
| [`specs/001-emergency-fund-tracker/`](specs/001-emergency-fund-tracker/)                     | Spec, plan, data model, and the task list that is the plan of record   |
| [`specs/001-emergency-fund-tracker/contracts/`](specs/001-emergency-fund-tracker/contracts/) | Domain ports, the UI and accessibility contract, and the export format |
| [`specs/002-drawer-navigation/`](specs/002-drawer-navigation/)                               | The navigation menu: spec, plan, research, and tasks                   |
| [`specs/backlog.md`](specs/backlog.md)                                                       | Tasks outside any feature's phases, waiting to be picked up            |
| [`.claude/rules/`](.claude/rules/)                                                           | House rules, each with the reason it exists                            |

## Licence

Unlicensed and private.
