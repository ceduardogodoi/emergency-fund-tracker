# Working in this repository

Read [docs/conventions.md](docs/conventions.md) before writing code here. It holds the house rules — naming, types, arrays, testing, commits — each with the reason it exists. They are not preferences to weigh; they are decisions already made.

Two that change what you do first, rather than how you write it:

- **Present the diff and wait for review before committing.** A green `npm run verify` means the change is ready to show, not ready to commit.
- **Tests come before implementation**, and every new assertion is proved by breaking the code it covers and watching the suite go red. Constitution Principle IV, and it is non-negotiable.

## Where things are

|                                                                                              |                                                             |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| [`.specify/memory/constitution.md`](.specify/memory/constitution.md)                         | The six principles. Versioned; conventions defer to it      |
| [`specs/001-emergency-fund-tracker/`](specs/001-emergency-fund-tracker/)                     | Spec, plan, data model, and `tasks.md` — the plan of record |
| [`specs/001-emergency-fund-tracker/contracts/`](specs/001-emergency-fund-tracker/contracts/) | Domain ports, the UI contract, and the export format        |
| [`docs/conventions.md`](docs/conventions.md)                                                 | House rules, and why each exists                            |

`tasks.md` is the plan of record: commit scopes name the task being closed, and the checkbox moves in the same commit.

## Commands

|                                   |                                                                                    |
| --------------------------------- | ---------------------------------------------------------------------------------- |
| `npm run verify`                  | Format, lint, typecheck, and the full suite with coverage floors. The gate         |
| `npm test`                        | Jest — unit, integration, and component projects                                   |
| `npm run e2e` / `npm run e2e:ios` | Maestro against an Android emulator / iOS simulator, with `npx expo start` running |
| `npm run e2e:clean`               | Removes the Maestro artifacts those runs leave behind                              |

The e2e suites need a booted device and the dev server. After restarting the Android emulator, `adb reverse tcp:8081 tcp:8081` — see the Environment section of the conventions for why every flow otherwise fails at launch.
