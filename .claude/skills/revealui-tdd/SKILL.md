---
name: revealui-tdd
description: |
  Test-driven development workflow for RevealUI. Use when implementing any feature,
  fixing bugs, adding functionality, or writing new code. Enforces write-test-first,
  red-green-refactor cycle. Works with Vitest and React Testing Library.
---

# RevealUI TDD Workflow

Follow this cycle for every code change. No exceptions.

## The Cycle

1. **Write a failing test** — describe the expected behavior
2. **Run it** — confirm it fails for the right reason
3. **Write minimal implementation** — just enough to pass
4. **Run it** — confirm it passes
5. **Refactor** — clean up, then run tests again
6. **Commit** — one commit per cycle

## Commands

```bash
# Run tests for a specific package
pnpm --filter @revealui/<package> test

# Run a specific test file
pnpm --filter @revealui/<package> test -- <file>

# Run with coverage
pnpm --filter @revealui/<package> test -- --coverage
```

## Test File Conventions

- Unit/integration: `*.test.ts` in `src/__tests__/` or adjacent to source
- E2E: `*.e2e.ts` in `packages/test/`
- Use `@revealui/test` for shared fixtures, mocks, and utilities

## What to Test

- Public API surface of each module
- Error paths and edge cases
- Integration points between packages

## What NOT to Test

- Private implementation details
- Third-party library internals
- Type-only code (interfaces, type aliases)

## Repo-Specific Patterns

For concurrency tuning, flaky test triage, and Pro/OSS test boundaries, see the `$revealui-testing` skill.

## Anti-Patterns

- Writing implementation before the test
- Writing tests that pass immediately (test must fail first)
- Testing implementation details instead of behavior
- Skipping the refactor step
- Large commits with multiple features
