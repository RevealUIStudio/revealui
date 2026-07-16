---
title: "Package.json Script Standards"
description: "Conventions for package.json scripts across the RevealUI monorepo."
visibility: internal
status: verified
audience: contributor
---

# Package.json Script Standards

Conventions for `package.json` scripts across the RevealUI monorepo.

## Table of Contents

- [Overview](#overview)
- [Standard Scripts](#standard-scripts)
- [Naming Conventions](#naming-conventions)
- [Package Types](#package-types)
- [Template Usage](#template-usage)
- [CI Integration](#ci-integration)
- [Migration Guide](#migration-guide)

---

## Overview

### Goals

1. **Consistency**: packages follow the same script naming and behavior.
2. **Discoverability**: developers can find and understand scripts quickly.
3. **Maintainability**: script changes can be made systematically.
4. **Performance**: Turbo caching works optimally with standardized scripts.

### Scope

The monorepo has 4 apps (`admin`, `docs`, `marketing`, `server`) under `apps/`
plus the workspace packages under `packages/` (28 in total). Package script
templates live in `.revealui/templates/` (`library.json`, `app.json`,
`tool.json`).

These are conventions, not an enforced gate. There is no package-scripts
validator alias in the root `package.json`; consistency is maintained by copying
from the templates and by review.

---

## Standard Scripts

### Core Scripts (Required)

#### `build`

**Purpose**: compile/bundle for production. Required for all packages.

- **Libraries**: `tsc`
- **Tools**: `tsup`
- **Next.js apps**: `next build`
- **Vite apps**: `vite build`

```json
{
  "scripts": {
    "build": "tsc"
  }
}
```

#### `dev`

**Purpose**: watch mode for development. Required for all packages.

- **Libraries**: `tsc --watch`
- **Tools**: `tsup --watch`
- **Next.js apps**: `next dev --port <PORT>`
- **Vite apps**: `vite dev`

#### `lint`

**Purpose**: run Biome. Required for all packages.

```json
{
  "scripts": {
    "lint": "biome check ."
  }
}
```

#### `typecheck`

**Purpose**: TypeScript type checking without emit. Required for all packages.

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit"
  }
}
```

#### `test`

**Purpose**: run tests once. Required for all packages except infrastructure.

```json
{
  "scripts": {
    "test": "vitest run"
  }
}
```

Some packages use bare `vitest`. Both are acceptable.

#### `clean`

**Purpose**: remove build artifacts. Required for all packages.

- **Libraries**: `rm -rf dist`
- **Next.js apps**: `rm -rf .next .turbo`
- **Vite apps**: `rm -rf dist .turbo`

### Optional Scripts

- `test:watch`, `vitest`
- `test:coverage`, `vitest run --coverage`
- `test:ui`, `vitest --ui`
- `format`, `biome format --write .`
- `start`, production server, apps only (`next start --port <PORT>` or `vite preview`)

---

## Naming Conventions

### Prefixes

Use consistent prefixes for related scripts. Prefixes in active use in the root
`package.json` include:

- `lint:`, linting tasks (`lint:fix`)
- `test:`, testing tasks (`test:watch`, `test:coverage`, `test:e2e`, `test:integration`)
- `db:`, database tasks (`db:migrate`, `db:seed`, `db:reset`, `db:backup`)
- `audit:`, read-only audits (`audit:any`, `audit:console`)
- `validate:`, validation gates (`validate:boundary`, `validate:claims`)
- `gate:`, CI gates (`gate:security`, `gate:types`)
- `secrets:`, secret operations (`secrets:generate`, `secrets:scan`)
- `release:`, release flows (`release:oss`, `release:pro`, `release:dry-run`)

### Separators

- Use a **colon (`:`)** to separate prefix from action.
- Use **kebab-case** for multi-word actions.

```json
{
  "test:watch": "...",
  "test_watch": "...",
  "testWatch": "..."
}
```

The first form is correct; the others are not.

### Descriptive Names

Script names should be self-documenting. Prefer `build` over `compile` or `b`,
and `test:coverage` over `test:cov`.

---

## Package Types

### Library Packages

**Location**: `packages/*` (most packages)
**Build tool**: `tsc`
**Examples**: `@revealui/ai`, `@revealui/auth`, `@revealui/core`

**Required scripts**: `build`, `dev`, `lint`, `typecheck`, `test`, `clean`
**Template**: `.revealui/templates/library.json`

```json
{
  "name": "@revealui/mylib",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "lint": "biome check .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "clean": "rm -rf dist"
  }
}
```

### Application Packages

**Location**: `apps/*`
**Build tools**: Next.js or Vite
**Examples**: `admin` (Next.js), `docs` and `marketing` (Vite), `server` (Hono)

**Required scripts**: `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `clean`
**Template**: `.revealui/templates/app.json`

```json
{
  "name": "admin",
  "scripts": {
    "dev": "next dev --port 4000",
    "build": "next build",
    "start": "next start --port 4000",
    "lint": "biome check .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "clean": "rm -rf .next .turbo"
  }
}
```

### Tool Packages

**Location**: CLI packages such as `packages/cli`, `packages/setup`
**Build tool**: `tsup`
**Examples**: `@revealui/cli`, `@revealui/setup`

**Required scripts**: `build`, `dev`, `lint`, `typecheck`, `test`
**Template**: `.revealui/templates/tool.json`

```json
{
  "name": "@revealui/mytool",
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "lint": "biome check .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

---

## Template Usage

### Selecting a Template

1. Is it a CLI tool? Use `tool.json`.
2. Is it a web application? Use `app.json`.
3. Is it a library? Use `library.json`.

### Applying a Template

Templates are applied manually: view the template, copy the relevant scripts into
your `package.json`, and adjust framework-specific commands (ports, build tools).

```bash
cat .revealui/templates/library.json
```

### Customization

Templates are starting points. Add package-specific scripts alongside the
standard ones:

```json
{
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "db:migrate": "tsx scripts/migrate.ts"
  }
}
```

Adjust the port for apps as needed (for example `next dev --port 4000`).

---

## CI Integration

The monorepo runs quality through `pnpm gate` (orchestrated by
`scripts/gates/ci-gate.ts`), which runs Biome lint, audits, structure and
boundary validation, typecheck, tests, and build. Individual pieces are also
available as aliases:

```bash
pnpm lint
pnpm typecheck:all
pnpm test
pnpm build
pnpm gate            # full pipeline
```

Package script consistency is not gated by a dedicated validator. Keep scripts
aligned with the templates above and review new package.json files against them.

---

## Migration Guide

### For an Existing Package

1. Determine the package type (app, tool, or library).
2. Open the matching template in `.revealui/templates/`.
3. Copy any missing standard scripts into the package's `package.json`,
   preserving package-specific customizations.
4. Adjust ports and build commands to match the package's framework.
5. Verify the standard scripts run:

```bash
pnpm --filter <pkg> build
pnpm --filter <pkg> test
pnpm --filter <pkg> lint
```

### For a New Package

```bash
cp .revealui/templates/library.json packages/mynewlib/package.json
```

Then set the package name, adjust ports (apps), and add package-specific scripts.

---

## Best Practices

### Do

- Use standard script names (`build`, `dev`, `test`, ...).
- Follow the package-type conventions.
- Add package-specific scripts when needed.
- Use Turbo for parallel execution.

### Don't

- Create aliases for standard scripts (`compile` instead of `build`).
- Use abbreviations (`b` instead of `build`).
- Skip required scripts.
- Use a different test framework (stick to Vitest).
- Hardcode environment-specific values.

---

## References

- [Package Templates](../.revealui/templates/README.md)
- [Turbo Configuration](../turbo.json)
- [Main Scripts README](./README.md)
