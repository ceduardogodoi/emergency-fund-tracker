# Tooling and environment

**Tool configs declare their module system in the extension.** `.mjs` where the tool accepts ESM (`eslint.config.mjs`, `jest.config.mjs`), `.cjs` where it requires CommonJS (`babel.config.cjs` — babel-jest loads it synchronously and Babel's ESM path is async). Never plain `.js`, which leaves the module system implicit in `package.json`'s `type`.

**Runtimes are pinned with asdf** in a committed `.tool-versions` at the repository root. Setup starts with `asdf install`, and CI installs from the same file. Never `.nvmrc`, `nvm use`, or "install Node LTS" as a step — Principle I requires the quality gate to run identically locally and in CI, which only holds if both read one pinned file.

**After restarting the Android emulator, run `adb reverse tcp:8081 tcp:8081`** before the e2e suite. The flows open the app with `openLink: exp://127.0.0.1:8081`, and inside the emulator `127.0.0.1` is the emulator. Expo sets the reverse mapping up when it connects and an emulator restart drops it, while the dev server keeps running — so nothing looks wrong, and every flow fails on `app-root is visible` after burning the full 45-second launch timeout. Suspect it first whenever _every_ Android flow fails at launch while iOS passes; the simulator shares the host's network and is never affected.
