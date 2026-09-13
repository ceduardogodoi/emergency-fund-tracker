---
paths:
  - "tests/**/*.{ts,tsx}"
---

# Testing

**Assert what a component renders, not what it was passed.** RNTL queries return the **host** element — the underlying `View`, `Text`, `ScrollView` — not the composite that carried the `testID` in the JSX. A prop the composite consumes never reaches the host, so reading it back gives `undefined` whatever was passed. `expect(element.props.behavior).toBeUndefined()` on a `KeyboardAvoidingView` passed on every platform while asserting nothing, and survived a mutation pass because the mutation it existed to catch was invisible to it. `UNSAFE_root` and `UNSAFE_getByType` are not available in this project's RNTL v14, so there is no composite escape hatch. Assert the rendered consequence instead: `behavior="padding"` composes a `paddingBottom` into the host view's style, which distinguishes the platforms _and_ fails if the prop is unwired entirely.

**Break the implementation to prove the assertion.** Every new assertion set is verified by deliberately breaking the code it covers and confirming the suite goes red. A test that has never failed is a test that has not been shown to test anything — and more than one here passed on first write for the wrong reason.

**Watch the fixture as closely as the assertion.** A test that stores `balanced` — which is also the default a new draft starts on — passes just as well against a screen that ignores storage entirely. Choose fixture values that differ from every default the code could fall back to.
