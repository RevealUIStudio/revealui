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
| **Playwright** | End-to-end (E2E) tests |

### Test Infrastructure Package

`@revealui/test` — shared fixtures, mocks, and test utilities used across the monorepo.

## Running Tests

```bash
# Run all tests (turbo, 15 concurrency)
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run Playwright E2E tests
pnpm test:e2e

# Run integration tests only
pnpm test:integration

# Run tests for a specific package
pnpm --filter <package> test
```

Examples:

```bash
pnpm --filter @revealui/core test
pnpm --filter @revealui/auth test
pnpm --filter cms test
```

## Test Layout

Tests live alongside source files as `*.test.ts` siblings, or under `__tests__/` directories within each package. E2E specs are in `packages/test/` and follow the `*.e2e.ts` naming convention.

## CI

Tests run as part of `pnpm gate` (phase 3 — parallel with turbo build). A test failure blocks the gate and prevents the push.

The full gate runs on `test` and `main` branches. Feature branches run the quality-only gate (lint + typecheck) before push.
