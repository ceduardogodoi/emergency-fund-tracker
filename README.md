# Emergency Fund

A mobile app for sizing and tracking a personal emergency fund — _reserva de emergência_. You enter what you spend in a typical month, choose how many months of that the fund should cover, and the app works out the target, then tracks what you have saved towards it.

Android and iOS, built with Expo and React Native. The interface is Brazilian Portuguese and amounts are in reais.

## Everything stays on the device

There is no account, no server, and no network call. The fund lives in a SQLite database inside the app's own sandbox, and nothing is ever transmitted — no analytics, no crash reporting, no third-party SDK that phones home. That is a requirement of the spec rather than a default, and it is verified by monitoring the app's network traffic during a full journey.

The cost of that promise is that the data does not follow you to a new phone on its own. Export and import exist so you can carry it yourself.

## Status

In development, built story by story against [`specs/001-emergency-fund-tracker/`](specs/001-emergency-fund-tracker/). **User Story 1 — set a personalised target — is complete**: onboarding, the four conservativeness levels with a custom duration, the manual override, and the revision screen, all persisted and covered end to end on both platforms. **User Story 2 — record savings and see progress** — is in progress; the ledger it needs does not exist yet, and the repository standing in for it fails every call by design rather than reporting an empty fund.

## Getting started

Runtimes are pinned in [`.tool-versions`](.tool-versions) and managed with [asdf](https://asdf-vm.com):

```bash
asdf install
npm install
npm start
```

`npm start` runs the Expo dev server; press `a` or `i` to open the app on a connected Android emulator or iOS simulator.

## Working on it

| Command                           | What it does                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------- |
| `npm run verify`                  | Format, lint, typecheck, and the full suite with coverage floors. The pre-commit gate |
| `npm test`                        | Jest — unit, integration, and component projects                                      |
| `npm run e2e` / `npm run e2e:ios` | Maestro flows on an Android emulator / iOS simulator, with the dev server running     |
| `npm run e2e:clean`               | Removes the artifacts those runs leave behind                                         |

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

Dependencies point inward: the domain knows nothing about SQLite, React, or the screens. Money is an integer count of centavos behind a branded type, so a float can never reach an amount, and every fallible operation returns a `Result` rather than throwing.

## Documents

|                                                                                              |                                                                        |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| [`.specify/memory/constitution.md`](.specify/memory/constitution.md)                         | The six principles the project is held to                              |
| [`specs/001-emergency-fund-tracker/`](specs/001-emergency-fund-tracker/)                     | Spec, plan, data model, and the task list that is the plan of record   |
| [`specs/001-emergency-fund-tracker/contracts/`](specs/001-emergency-fund-tracker/contracts/) | Domain ports, the UI and accessibility contract, and the export format |
| [`.claude/rules/`](.claude/rules/)                                                           | House rules, each with the reason it exists                            |

## Licence

Unlicensed and private.
