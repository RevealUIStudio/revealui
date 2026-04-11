---
title: "Testing Guide"
description: "Vitest unit tests, Playwright E2E, test utilities, and coverage targets"
category: guide
audience: contributor
---

# Testing Guide

Reference guide to testing in the RevealUI monorepo.

## Overview

RevealUI has **~13,700 test cases across 811 test files**.

### Testing Stack

| Tool | Purpose |
|------|---------|
| **Vitest 4** | Primary test runner (unit, integration, component) |
| **React Testing Library** | Component rendering and interaction |
| **PGlite** | In-memory PostgreSQL for database tests |
| **Playwright** | End-to-end (E2E) and visual regression |

### Test Infrastructure Package

`@revealui/test`  -  shared fixtures, mocks, and test utilities used across the monorepo.

## Running Tests

```bash
# Run all tests (turbo, respects dependency order)
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run Playwright E2E tests
pnpm test:e2e

# Run integration tests only
pnpm test:integration

# Run tests for a specific package
pnpm --filter @revealui/core test

# Run a specific test file
pnpm --filter @revealui/auth test -- src/__tests__/session.test.ts
```

## Test Layout

| Convention | Location | Example |
|-----------|----------|---------|
| Unit tests | `__tests__/` directory within each package | `packages/auth/src/__tests__/session.test.ts` |
| Co-located tests | `*.test.ts` sibling to source file | `packages/db/src/queries/users.test.ts` |
| Integration tests | `packages/test/src/integration/` | `packages/test/src/integration/services/stripe.integration.test.ts` |
| E2E specs | `e2e/` root directory | `e2e/auth.e2e.ts` |
| Visual snapshots | `e2e/__snapshots__/` | `e2e/__snapshots__/visual-snapshots.e2e.ts/` |
| Test fixtures | `packages/test/src/fixtures/` | Shared test data and factory functions |
| Test mocks | `packages/test/src/mocks/` | Common mock implementations |

## Test Categories

### Unit Tests

Standard Vitest tests. Each package has its own test suite. Run with `pnpm --filter <package> test`.

**Key conventions:**
- Use `vi.mock()` for module mocking (Vitest 4 requires `class` syntax in mock factories)
- Use `@revealui/test` fixtures instead of creating ad-hoc test data
- Database tests use PGlite (in-memory PostgreSQL)  -  no real DB needed
- Test files must not import from `@revealui/ai` or `@revealui/harnesses` statically

### Integration Tests

Tests that exercise real infrastructure (PostgreSQL, Stripe, Supabase). These run separately from unit tests because they require service credentials.

```bash
# Run integration tests (requires POSTGRES_URL)
pnpm test:integration

# Skip if env vars are missing (CI handles this)
SKIP_ENV_VALIDATION=true pnpm test:integration
```

Integration tests are gated to `main` branch in CI (not run on feature branches or PRs to `test`).

### E2E Tests (Playwright)

End-to-end tests that exercise the full application stack (admin + API + Marketing).

```bash
# Run all E2E tests
pnpm test:e2e

# Run a specific E2E test
pnpm test:e2e -- e2e/auth.e2e.ts

# Run with UI mode for debugging
pnpm test:e2e -- --ui
```

**E2E test phases in CI (main branch only):**
1. **Smoke tests**  -  basic page loads and API responses
2. **Accessibility**  -  WCAG compliance checks
3. **Visual regression**  -  screenshot comparison against committed baselines

### Visual Regression

21 baseline screenshots committed in `e2e/__snapshots__/`. Playwright compares against these on every push to `main`. Differences fail CI.

To update baselines after intentional UI changes:
```bash
pnpm test:e2e -- --update-snapshots e2e/visual-snapshots.e2e.ts
git add e2e/__snapshots__/
```

## Database Tests

Database tests use **PGlite**  -  an in-memory PostgreSQL implementation that requires no running database. This means:

- Tests are fast (no network round-trips)
- Tests are isolated (fresh database per test or describe block)
- No database setup required for contributors

**Configuration:**
- `hookTimeout: 30000` in PGlite test configs (30s for schema setup)
- `maxWorkers: 2` to avoid memory pressure from parallel PGlite instances

## Coverage

```bash
# Generate coverage reports for all packages
pnpm test:coverage

# Check coverage gate (fails if any package has 0% coverage)
pnpm coverage:check

# Check coverage for changed packages only
pnpm coverage:check -- --changed
```

Coverage reports are generated per-package in `<package>/coverage/`. The CI coverage gate runs on `main` branch and fails if any package with >100 LOC has zero test coverage.

## CI Pipeline

Tests run as part of the CI gate:

| Phase | Branch | What runs |
|-------|--------|-----------|
| Unit tests | all | `pnpm test` (turbo, all packages) |
| Integration tests | main only | `pnpm test:integration` (requires PostgreSQL service) |
| Coverage gate | main only | `pnpm coverage:check --fail-on-zero` |
| E2E smoke | main only | Playwright smoke tests (admin + API + Marketing) |
| Accessibility | main only | Playwright accessibility audit |
| Visual regression | main only | Screenshot comparison against baselines |

Feature branches run quality-only gates (lint + typecheck) via the pre-push hook. Unit tests run in CI on PR to `test` or `main`.

## Writing Tests

### New Package

Every new package must have at least one test file. The CI coverage gate enforces this  -  packages with >100 LOC and zero test files are flagged.

### Conventions

1. **Test file naming:** `*.test.ts` (unit) or `*.integration.test.ts` (integration)
2. **Describe blocks:** Match the module or function being tested
3. **Test isolation:** Each test should be independent  -  no shared mutable state
4. **No `any` in tests:** Use typed mocks via `@revealui/test` fixtures
5. **PGlite for DB:** Never require a running database for unit tests
6. **Conditional E2E skips:** E2E tests that require credentials use `test.skip()` with a condition  -  not unconditional skips
