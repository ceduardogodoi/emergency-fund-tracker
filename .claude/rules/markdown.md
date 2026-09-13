---
paths:
  - "**/*.md"
---

# Markdown

**Prose is not hard-wrapped.** Each paragraph, bullet, and numbered item goes on one continuous line; line breaks separate blocks only. This overrides any column-limit instruction in the Spec Kit templates. Hard wraps hurt readability when rendered and make diffs noisier than the edit that caused them.

Prettier is configured with the default `proseWrap: preserve`, so it will not rewrap prose — but `specs/`, `.specify/`, and `.claude/` are in `.prettierignore`, so markdown there is never touched at all.
