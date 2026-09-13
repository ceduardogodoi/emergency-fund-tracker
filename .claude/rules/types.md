---
paths:
  - "**/*.{ts,tsx}"
---

# Types

**Use the canonical type; do not re-describe it.** When a type already has a name — exported by our own modules or by a dependency — import it. Do not write its shape inline (`({ href }: { href: string })` where `RedirectProps` exists), and do not derive it with `typeof` or `ReturnType<typeof …>` when the real type is exported. `ReturnType<typeof useRouter>` says "whatever that hook happens to return" when expo-router exports `ImperativeRouter` and means it. `Result`'s two branches had been written out by hand six times — in the union, in both type guards, and in both test helpers — before they became `Ok<T>` and `Err<E>`.

Check the `.d.ts` rather than assuming, and verify with `npm run typecheck` rather than by eye. Three cases where an inline or local type is the right answer:

- **The named type would duplicate the source of truth.** `keyof typeof typography` and `keyof typeof COVERAGE_MONTHS` derive a union from the object that defines it; writing that union out separately creates the drift this rule prevents.
- **Every candidate is wrong and a narrower local type is right.** For the platform a test renders as, react-native's `PlatformOSType` admits `'native'` and `typeof Platform.OS` admits macos, windows and web — none of which this app builds for. A local `type ShippedPlatform = 'ios' | 'android'` is tighter than either, and rejects `renderOn('web')`, which both of the others compiled. Keep such a type local until a second consumer exists.
- **The value is not what it looks like.** A `CoverageMeter` assertion appeared to need RNTL's `TestInstance` from the undeclared `test-renderer` package; the values actually came from `props.children`, so they are `ReactElement`s with `ViewProps`, both already direct dependencies. Check what the value _is_ before naming its type.
