<!--
Sync Impact Report
Version change: (template, unversioned) → 1.0.0
Bump rationale: Initial ratification. All placeholder tokens replaced with concrete, enforceable governance; six core principles defined.

Modified principles:
- [PRINCIPLE_1_NAME] → I. Code Quality Gates (NON-NEGOTIABLE)
- [PRINCIPLE_2_NAME] → II. Clean Code
- [PRINCIPLE_3_NAME] → III. SOLID Design
- [PRINCIPLE_4_NAME] → IV. Test-First & Testing Standards (NON-NEGOTIABLE)
- [PRINCIPLE_5_NAME] → V. Consistent Code Patterns
- (new) → VI. User Interface & Experience Consistency

Added sections:
- Quality Standards (replaces [SECTION_2_NAME])
- Development Workflow & Quality Gates (replaces [SECTION_3_NAME])

Removed sections: none

Deferred items / TODOs:
- TODO(TECH_STACK_BINDING): Language, framework, linter, formatter, test runner, and design-token source are not yet chosen. Record them in this file (PATCH bump) once the first `/speckit-plan` selects them.
-->

# Emergency Fund Tracker Constitution

## Core Principles

### I. Code Quality Gates (NON-NEGOTIABLE)

Every change MUST pass the full automated quality gate before merge: formatter, linter, type checker (strict mode where the language supports it), and the full test suite. Warnings are treated as errors; suppressions (`eslint-disable`, `# type: ignore`, and equivalents) MUST carry an inline comment stating the reason and MUST be scoped to the narrowest possible line or block. No commented-out code, dead code, or unreachable branches may be merged. Gates run identically in local pre-commit and in CI, and CI is the authority.

**Rationale**: A gate that can be skipped is not a gate. Making the gate automatic and uniform removes quality from the space of things a reviewer must remember to check.

### II. Clean Code

Code MUST be written for the next reader:

- Names state intent. No abbreviations beyond widely understood domain terms; booleans read as predicates; functions read as verb phrases.
- Functions do one thing at one level of abstraction. A function exceeding ~40 lines or a cyclomatic complexity of 10 MUST be decomposed or explicitly justified in review.
- Nesting stops at 3 levels; prefer guard clauses and early returns over `else` ladders.
- Comments explain *why*, never *what*. A comment restating the code is a signal to rename or extract instead.
- Duplication is removed on the third occurrence (rule of three); premature abstraction of the first two is itself a violation.
- Errors are handled explicitly. Empty catch blocks and silently swallowed failures are prohibited; every failure path either recovers or surfaces a typed, actionable error.

**Rationale**: Readability is the dominant cost driver over a project's life. These are the smallest set of rules that keep review conversations about design rather than style.

### III. SOLID Design

Modules MUST be designed against the five SOLID principles, applied pragmatically:

- **Single Responsibility**: A module has exactly one reason to change. A file mixing domain rules, persistence, and presentation MUST be split.
- **Open/Closed**: New behavior is added by extension (new implementation, new strategy, new handler) rather than by editing a growing conditional over types.
- **Liskov Substitution**: Any implementation of an interface MUST be substitutable without the caller branching on concrete type or catching implementation-specific errors.
- **Interface Segregation**: Interfaces expose only what a given consumer needs. Wide "kitchen-sink" service interfaces MUST be split by consumer role.
- **Dependency Inversion**: Domain and business logic depend on abstractions defined by the domain, never on concrete I/O, framework, or vendor types. Dependencies are passed in (constructor or parameter injection); modules MUST NOT construct their own I/O-performing collaborators or read globals and singletons directly.

Applying a SOLID pattern MUST be justified by an actual, present need. Speculative indirection ("we might swap the database") is a violation of the simplicity rule in Quality Standards and MUST be rejected in review.

**Rationale**: The financial-domain core of this project must remain testable and portable across UI and storage choices. Dependency inversion is what makes fast, deterministic unit tests possible at all.

### IV. Test-First & Testing Standards (NON-NEGOTIABLE)

Tests are written before the implementation they cover. The Red-Green-Refactor cycle is mandatory: a new test MUST be observed failing for the intended reason before the implementing code is written.

Required standards:

- **Coverage of behavior, not lines**: Every user-facing requirement in a spec MUST map to at least one automated test. Line coverage MUST NOT fall below 80% overall and 95% for modules containing money, interest, date, or balance calculations.
- **Test pyramid**: Fast unit tests for domain logic; integration tests for every persistence boundary, external contract, and cross-module workflow; a thin end-to-end layer for critical user journeys only.
- **Determinism**: Tests MUST NOT depend on wall-clock time, timezone, locale, network, random seeds, or execution order. Clocks and randomness are injected. A flaky test is a build-blocking defect, not a retry candidate.
- **Arrange-Act-Assert**: One logical assertion target per test; the test name states the scenario and the expected outcome.
- **Regression rule**: Every bug fix MUST begin with a failing test that reproduces the bug.
- Tests MUST NOT be deleted or weakened to make a build pass; changing an assertion requires a stated behavior change in the spec.

**Rationale**: This application computes financial targets people rely on. Silent arithmetic or rounding regressions are the highest-severity failure mode available to it, and only executable specifications prevent them.

### V. Consistent Code Patterns

The codebase MUST look like it was written by one author:

- Project structure, module boundaries, and file naming follow one documented convention; new code adopts the existing pattern rather than introducing a parallel one.
- One canonical way per concern: one error-handling strategy, one validation approach, one data-access pattern, one state-management approach, one logging interface.
- Domain types are explicit. Money MUST be represented by a dedicated type or minor-unit integer — never a floating-point number. Dates and currencies are always explicit, never implied by context.
- Public module APIs are documented at the boundary: purpose, inputs, outputs, and failure modes.
- Introducing a new library, framework, or pattern requires a written justification in the plan (what it replaces, why the existing pattern is insufficient) and removal of the superseded approach — parallel patterns MUST NOT coexist indefinitely.

**Rationale**: Consistency compounds. Each additional way of doing the same thing multiplies the context a contributor must hold and the surface where bugs hide.

### VI. User Interface & Experience Consistency

The interface MUST behave predictably across every screen:

- **Single source of truth for design**: All spacing, color, typography, radii, and elevation come from shared design tokens. Hard-coded style values are prohibited.
- **Component reuse**: A UI pattern appearing twice becomes a shared component. Screens compose existing components; one-off variants require justification.
- **Uniform state handling**: Every asynchronous view MUST define and render all four states — loading, empty, error, and populated — using the shared patterns for each.
- **Consistent language**: Terminology, capitalization, date, number, and currency formatting, and error phrasing follow one documented style. The same concept uses the same word everywhere.
- **Accessibility is a gate, not a feature**: WCAG 2.1 AA is the minimum. All interactive elements are keyboard reachable with a visible focus indicator, carry accessible names, and meet 4.5:1 text contrast. Color is never the sole carrier of meaning.
- **Predictable feedback**: Every user action produces visible feedback within 100ms. Destructive actions require confirmation and, where feasible, are reversible.
- Responsive layouts MUST be verified at mobile, tablet, and desktop breakpoints before a UI change is considered complete.

**Rationale**: Users judge a financial tool by whether it feels trustworthy. Inconsistent formatting of a currency figure or an unhandled empty state costs more confidence than a missing feature.

## Quality Standards

These constraints apply to all code in the repository:

- **Correctness of money**: Currency arithmetic uses exact decimal or integer minor units. Rounding rules are defined once, centrally, and covered by tests including boundary and negative cases.
- **Static analysis**: Strict type checking is enabled and MUST NOT be relaxed globally.
- **Dependencies**: Each third-party dependency MUST be justified by the plan that introduces it. Dependencies with known unpatched high or critical vulnerabilities MUST NOT be merged.
- **Secrets and user data**: No secrets, credentials, or real user financial data in the repository, in tests, or in logs. Test data is synthetic.
- **Observability**: Failures are logged through the single logging interface with enough structured context to diagnose them, and never with sensitive values.
- **Simplicity (YAGNI)**: The simplest solution that satisfies the current spec wins. Abstraction layers, configurability, and generality that no current requirement demands MUST be rejected.

TODO(TECH_STACK_BINDING): The concrete language, framework, linter, formatter, type checker, test runner, and design-token source are not yet selected. The first `/speckit-plan` that chooses them MUST record them here as a PATCH amendment.

## Development Workflow & Quality Gates

1. **Specify** — Behavior is agreed in a spec before design. Every requirement is stated so that it is testable.
2. **Plan** — The plan MUST include a Constitution Check: each principle is either satisfied or has an explicit, recorded justification for deviation.
3. **Test** — Tests are written and observed failing before implementation.
4. **Implement** — Code is written to make tests pass, then refactored under green tests.
5. **Review** — Every change is reviewed. The reviewer MUST verify: tests exist and were written first, principles I–VI hold, no new pattern was introduced without justification, and UI changes were checked against Principle VI's state, accessibility, and responsiveness requirements.
6. **Merge** — Only with all automated gates green and review approval. Failing or skipped tests MUST NOT be merged; `skip`, `only`, and `todo` markers left in test files block the merge.

Deviations from any principle are permitted only when recorded in the plan's Complexity Tracking section with the rule deviated from, the reason, and the simpler alternative that was rejected and why. Undocumented deviations are defects and MUST be reverted or remediated.

## Governance

This constitution supersedes all other development practices, conventions, and preferences. Where a tool default, a tutorial, or a habit conflicts with it, this document wins.

**Amendments**: Any contributor may propose an amendment via a pull request modifying this file. The PR MUST state the rationale, the version bump and its justification, and a migration plan for any existing code the amendment would render non-compliant. Amendments take effect on merge.

**Versioning**: This document follows semantic versioning.

- **MAJOR**: A principle is removed or redefined in a backward-incompatible way, or governance itself changes.
- **MINOR**: A principle or section is added, or existing guidance is materially expanded.
- **PATCH**: Clarifications, wording, typo fixes, and non-semantic refinements — including recording the technology stack binding.

**Compliance review**: Compliance is verified at every pull request via the review checklist in Development Workflow & Quality Gates, and at every `/speckit-plan` via the Constitution Check gate. Any principle that is repeatedly deviated from MUST be brought to amendment rather than quietly ignored — a rule nobody follows is worse than no rule.

**Runtime guidance**: Agent- and contributor-facing operational guidance (commands, stack specifics, repository layout) belongs in the project guidance file (`CLAUDE.md`), not in this constitution. That file MUST NOT contradict this document.

**Version**: 1.0.0 | **Ratified**: 2026-08-09 | **Last Amended**: 2026-08-09
