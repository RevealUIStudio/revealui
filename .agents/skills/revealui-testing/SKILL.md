---
name: revealui-testing
description: |
  RevealUI monorepo testing rules and failure-triage guidance. Use when changing tests,
  fixing flaky suites, adjusting Vitest config, debugging Turbo test failures, handling
  React Testing Library warnings, or deciding between scoped timeouts, worker limits,
  and test refactors in this repo.
---

# RevealUI Testing

Use this skill after the generic `vitest` and `react-testing-library` skills when the work is specific to this monorepo.

## Use This For

- `pnpm test` or `pnpm gate --phase=3 --no-build` failures
- Turbo fan-out flakiness that does not reproduce in isolated package runs
- Vitest worker/concurrency tuning in `packages/*` or `apps/*`
- React Testing Library `act(...)` warnings in this repo
- optional Pro package boundaries in tests
- deciding whether a failure is a real regression, test debt, or runner pressure

## Repo Rules

### 1. Prefer Narrow Fixes

Default order:

1. fix the test or component contract if behavior is actually wrong
2. fix stale selectors, bad async assertions, or missing `await`
3. add a scoped timeout to the single slow test or suite
4. cap workers for the package if the failure only happens under Turbo fan-out
5. only then consider broader runner changes

Do not raise global Vitest timeouts just to get green runs.

### 2. Treat "Passes Alone, Fails Under Turbo" as Concurrency Pressure First

If a package passes in isolation but flakes during `turbo run test`, assume resource pressure before assuming product logic broke.

Preferred fix order:

- specific test timeout for known cold imports or expensive setup
- package-level `fileParallelism: false` and `maxWorkers: 1` for packages with heavy imports, database mocks, or expensive startup
- lower Turbo concurrency in the gate if the machine is getting killed or saturated

This repo already needed that pattern in packages like `packages/test` and `packages/db`.

### 3. Package-Level Vitest Caps Are Acceptable Here

If a package repeatedly flakes only under monorepo fan-out, it is acceptable to cap that package's internal Vitest concurrency.

Typical pattern:

```ts
test: {
  fileParallelism: false,
  maxWorkers: 1,
}
```

Use this for:

- import-smoke suites
- packages with heavy module initialization
- DB/client/process orchestration tests

Do not apply it repo-wide by default.

### 4. Fix `act(...)` Warnings, Don't Ignore Them

Common fixes in this repo:

- use `await user.click(...)` instead of `fireEvent.click(...)` when the interaction is user-level
- use `findBy*` or `waitFor` when the click triggers async state
- assert on the post-update UI state, not just the callback
- wrap hook state updates in `act(...)` only when there is no better user-facing path

If a warning remains, explain why the pattern is intentional before adding an ignore.

### 5. Prefer `userEvent`, Use `fireEvent` Sparingly

Default to `@testing-library/user-event` for:

- clicks
- typing
- keyboard navigation
- focus/blur behavior

Keep `fireEvent` for narrow low-level cases like synthetic events or very small DOM-only transitions.

### 6. Optional Pro Packages Must Stay Optional in Public Tests

Public repo tests must not hard-require private sibling source trees or Pro package source paths.

Allowed patterns:

- dynamic import with graceful skip/fallback
- separate Pro-only test config/suite
- package docs that clearly mark Pro-only flows

Disallowed patterns:

- static imports to missing Pro source
- default OSS test runs that silently depend on adjacent private repos

### 7. Keep OSS and Pro Test Surfaces Honest

If a test is Pro-only:

- move it into a Pro-specific directory or config
- exclude it from default OSS test runs
- do not leave it mixed into the default suite with hidden assumptions

### 8. Distinguish Noise from Failure

Not all stderr is actionable failure in this repo.

Usually acceptable:

- intentional error-path logs in tests exercising failure branches
- expected jsdom limitations
- known parser warnings from fixture-driven negative tests

Actionable:

- `act(...)` warnings
- `MaxListenersExceededWarning`
- timeouts that only vanish with broad global increases
- tests that only pass because of local private package availability

## Working Pattern

When triaging a red test lane:

1. rerun the failing package or file directly
2. decide whether it is reproducible in isolation
3. if yes, fix the test/component/implementation
4. if no, treat it as concurrency pressure and tune narrowly
5. rerun the package
6. rerun the gate phase that exposed it

Do not keep stacking unrelated fixes without re-verifying the exact failing lane.

## Gate-Specific Guidance

- `pnpm gate --phase=3 --no-build` is the fastest useful repro for test/build instability
- if a gate hang appears, inspect shared process helpers before changing many tests
- Turbo warnings about missing outputs are configuration debt, not test correctness
- a warning-level test check in the gate still deserves cleanup if it hides real regressions

## What Not To Do

- don't inflate all test timeouts
- don't disable assertions just to remove flakes
- don't mix Pro-only tests back into OSS-default suites
- don't silence `act(...)` or listener warnings when the underlying fix is small
- don't assume a package is stable because it passed alone once
