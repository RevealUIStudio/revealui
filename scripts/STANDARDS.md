# Package.json Script Standards

Comprehensive standards and conventions for package.json scripts across the RevealUI monorepo.

## 📋 Table of Contents

- [Overview](#overview)
- [Standard Scripts](#standard-scripts)
- [Naming Conventions](#naming-conventions)
- [Package Types](#package-types)
- [Template Usage](#template-usage)
- [CI Integration](#ci-integration)
- [Migration Guide](#migration-guide)
- [Validation & Enforcement](#validation--enforcement)

---

## Overview

### Goals

1. **Consistency**: All packages follow the same script naming and behavior
2. **Discoverability**: Developers can easily find and understand scripts
3. **Maintainability**: Changes to scripts can be made systematically
4. **Performance**: Turbo caching works optimally with standardized scripts

### Current State (Phase 5 Complete)

- **Packages**: 22 total (5 apps, 13 libraries, 2 tools, 1 infrastructure, 1 root)
- **Validation**: 21/21 packages passing (100%)
- **Average Health Score**: 97.9/100
- **Duplication**: 50.7% (intentional standardization)
- **Templates**: 3 templates (library, app, tool)

---

## Standard Scripts

### Core Scripts (Required)

#### `build`
**Purpose**: Compile/bundle for production
**Required for**: All packages

**Implementations:**
- **Libraries**: `tsc` (TypeScript compiler)
- **Tools**: `tsup` (optimized bundling)
- **Next.js apps**: `next build`
- **Vite apps**: `vite build`

**Example:**
```json
{
  "scripts": {
    "build": "tsc"
  }
}
```

---

#### `dev`
**Purpose**: Watch mode for development
**Required for**: All packages

**Implementations:**
- **Libraries**: `tsc --watch`
- **Tools**: `tsup --watch`
- **Next.js apps**: `next dev --port <PORT>`
- **Vite apps**: `vite dev`

**Example:**
```json
{
  "scripts": {
    "dev": "tsc --watch"
  }
}
```

---

#### `lint`
**Purpose**: Run Biome linter
**Required for**: All packages

**Standard Implementation:**
```json
{
  "scripts": {
    "lint": "biome check ."
  }
}
```

**Note**: Use `lint:eslint` for ESLint (see optional scripts)

---

#### `typecheck`
**Purpose**: TypeScript type checking without emit
**Required for**: All packages

**Standard Implementation:**
```json
{
  "scripts": {
    "typecheck": "tsc --noEmit"
  }
}
```

**Benefits:**
- Catches type errors without building
- Fast feedback in CI
- Works with Turbo caching

---

#### `test`
**Purpose**: Run tests once
**Required for**: All packages (except infrastructure)

**Standard Implementation:**
```json
{
  "scripts": {
    "test": "vitest run"
  }
}
```

**Note**: Some packages use just `vitest` (without `run`) - both are acceptable

---

#### `clean`
**Purpose**: Remove build artifacts
**Required for**: All packages

**Implementations:**
- **Libraries**: `rm -rf dist`
- **Next.js apps**: `rm -rf .next .turbo`
- **Vite apps**: `rm -rf dist .turbo`

**Example:**
```json
{
  "scripts": {
    "clean": "rm -rf dist"
  }
}
```

---

### Optional Scripts

#### `lint:eslint`
**Purpose**: Run ESLint
**Recommended for**: All packages

**Standard Implementation:**
```json
{
  "scripts": {
    "lint:eslint": "eslint ."
  }
}
```

---

#### `test:watch`
**Purpose**: Run tests in watch mode
**Recommended for**: Packages with test suites

**Standard Implementation:**
```json
{
  "scripts": {
    "test:watch": "vitest"
  }
}
```

---

#### `test:coverage`
**Purpose**: Run tests with coverage
**Recommended for**: Packages with test suites

**Standard Implementation:**
```json
{
  "scripts": {
    "test:coverage": "vitest run --coverage"
  }
}
```

---

#### `test:ui`
**Purpose**: Launch Vitest UI
**Recommended for**: Packages with many tests

**Standard Implementation:**
```json
{
  "scripts": {
    "test:ui": "vitest --ui"
  }
}
```

---

#### `format`
**Purpose**: Auto-format code
**Optional**: Use for actively developed packages

**Standard Implementation:**
```json
{
  "scripts": {
    "format": "biome format --write ."
  }
}
```

---

#### `start`
**Purpose**: Start production server
**Required for**: Applications only

**Implementations:**
- **Next.js**: `next start --port <PORT>`
- **Vite**: `vite preview`

**Example:**
```json
{
  "scripts": {
    "start": "next start --port 3000"
  }
}
```

---

## Naming Conventions

### Prefixes

Use consistent prefixes for related scripts:

- **`lint:`** - Linting tasks (`lint:biome`, `lint:eslint`)
- **`test:`** - Testing tasks (`test:watch`, `test:coverage`, `test:ui`, `test:integration`)
- **`db:`** - Database tasks (`db:migrate`, `db:seed`, `db:reset`)
- **`analyze:`** - Analysis tasks (root only)
- **`maintain:`** - Maintenance tasks (root only)
- **`scripts:`** - Script management (root only)

### Separators

- Use **colon (`:`)** to separate prefix from action
- Use **kebab-case** for multi-word actions

**Examples:**
```json
{
  "test:watch": "...",          // ✅ Good
  "test_watch": "...",          // ❌ Bad (underscore)
  "testWatch": "...",           // ❌ Bad (camelCase)
  "test-watch": "..."           // ❌ Bad (no prefix)
}
```

### Descriptive Names

Script names should be self-documenting:

```json
{
  "build": "tsc",                    // ✅ Good (clear action)
  "compile": "tsc",                  // ❌ Bad (non-standard term)
  "b": "tsc",                        // ❌ Bad (abbreviation)
  "test:coverage": "vitest --coverage", // ✅ Good (descriptive)
  "test:cov": "vitest --coverage"    // ❌ Bad (abbreviation)
}
```

---

## Package Types

### Library Packages

**Location**: `packages/*` (most packages)
**Build Tool**: TypeScript compiler (`tsc`)
**Examples**: `@revealui/ai`, `@revealui/auth`, `@revealui/core`

**Required Scripts:**
- `build`, `dev`, `lint`, `typecheck`, `test`, `clean`

**Template**: Use `.revealui/templates/library.json`

**Typical package.json:**
```json
{
  "name": "@revealui/mylib",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "lint": "biome check .",
    "lint:eslint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "clean": "rm -rf dist"
  }
}
```

---

### Application Packages

**Location**: `apps/*`
**Build Tools**: Next.js or Vite
**Examples**: `cms`, `dashboard`, `docs`, `landing`, `web`

**Required Scripts:**
- `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `clean`

**Template**: Use `.revealui/templates/app.json`

**Next.js Example:**
```json
{
  "name": "myapp",
  "scripts": {
    "dev": "next dev --port 3000",
    "build": "next build",
    "start": "next start --port 3000",
    "lint": "biome check .",
    "lint:eslint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "clean": "rm -rf .next .turbo"
  }
}
```

**Vite Example:**
```json
{
  "name": "myapp",
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "start": "vite preview",
    "lint": "biome check .",
    "lint:eslint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "clean": "rm -rf dist .turbo"
  }
}
```

---

### Tool Packages

**Location**: `packages/cli`, `packages/setup`, `scripts/lib`
**Build Tool**: tsup (optimized for CLIs)
**Examples**: `@revealui/cli`, `@revealui/setup`

**Required Scripts:**
- `build`, `dev`, `lint`, `typecheck`, `test`

**Template**: Use `.revealui/templates/tool.json`

**Typical package.json:**
```json
{
  "name": "@revealui/mytool",
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "lint": "biome check .",
    "lint:eslint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

---

## Template Usage

### Selecting a Template

1. **Is it a CLI tool?** → Use `tool.json`
2. **Is it a web application?** → Use `app.json`
3. **Is it a library?** → Use `library.json`

### Applying a Template

**Option 1: Manual**
1. View the template: `cat .revealui/templates/library.json`
2. Copy relevant scripts to your `package.json`
3. Adjust framework-specific commands (ports, build tools)

**Option 2: Automated**
```bash
# Preview changes
pnpm scripts:fix

# Apply changes
pnpm scripts:fix:apply
```

### Customization

Templates are starting points - customize as needed:

**Add package-specific scripts:**
```json
{
  "scripts": {
    // Standard scripts from template
    "build": "tsc",
    "test": "vitest run",

    // Package-specific additions
    "db:migrate": "tsx scripts/migrate.ts",
    "generate:types": "tsx scripts/generate.ts"
  }
}
```

**Framework variations:**
```json
{
  // Next.js app on port 4000 instead of default
  "dev": "next dev --port 4000"
}
```

---

## CI Integration

### GitHub Actions Example

```yaml
name: CI
on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Validate package scripts
        run: pnpm scripts:validate

      - name: Audit package scripts
        run: pnpm scripts:audit

      - name: Type check
        run: pnpm typecheck:all

      - name: Lint
        run: pnpm lint

      - name: Test
        run: pnpm test

      - name: Build
        run: pnpm build
```

### Pre-commit Hook Example

```bash
#!/bin/sh
# .husky/pre-commit

# Validate scripts haven't diverged from standards
pnpm scripts:validate --strict

# Run standard quality checks
pnpm lint
pnpm typecheck:all
```

### Package.json Validation in CI

Add to your CI pipeline to enforce standards:

```yaml
- name: Enforce script standards
  run: |
    pnpm scripts:validate --strict
    if [ $? -ne 0 ]; then
      echo "❌ Package scripts do not meet standards"
      echo "Run 'pnpm scripts:fix:apply' to auto-fix"
      exit 1
    fi
```

---

## Migration Guide

### For Existing Packages

**Step 1: Determine Package Type**
```bash
# Is it in apps/? → app
# Is it a CLI? → tool
# Otherwise → library
```

**Step 2: Run Validation**
```bash
pnpm maintain:validate-scripts --package @revealui/mypackage
```

**Step 3: Preview Auto-Fix**
```bash
pnpm maintain:fix-scripts --package @revealui/mypackage --dry-run
```

**Step 4: Apply Fixes**
```bash
pnpm maintain:fix-scripts --package @revealui/mypackage
```

**Step 5: Manual Adjustments**
- Adjust ports for applications
- Add package-specific scripts
- Verify build commands match your setup

**Step 6: Validate**
```bash
pnpm maintain:validate-scripts --package @revealui/mypackage
```

---

### For New Packages

**Step 1: Copy Template**
```bash
# For a library
cp .revealui/templates/library.json packages/mynewlib/package.json

# For an app
cp .revealui/templates/app.json apps/mynewapp/package.json

# For a tool
cp .revealui/templates/tool.json packages/mytool/package.json
```

**Step 2: Customize**
- Set package name
- Adjust ports (apps)
- Add package-specific scripts

**Step 3: Validate**
```bash
pnpm scripts:validate
```

---

## Validation & Enforcement

### Local Validation

**Quick check:**
```bash
pnpm scripts:validate
```

**Detailed audit:**
```bash
pnpm scripts:audit
```

**Full health check:**
```bash
pnpm scripts:health
```

**Per-package:**
```bash
pnpm maintain:validate-scripts --package @revealui/ai
```

### Exit Codes

- **0**: All packages pass validation
- **1**: One or more packages fail validation

### Health Scoring

Packages receive a score from 0-100:

- **90-100**: Excellent - all required scripts present and correct
- **70-89**: Good - minor issues or missing optional scripts
- **50-69**: Fair - missing some required scripts
- **0-49**: Poor - missing many required scripts

**Current Average**: 97.9/100

### Automated Enforcement

**Add to package.json:**
```json
{
  "scripts": {
    "precommit": "pnpm scripts:validate",
    "prepush": "pnpm scripts:health"
  }
}
```

**Use with husky:**
```bash
# .husky/pre-commit
pnpm scripts:validate --strict
```

---

## Best Practices

### DO

✅ Use standard script names (`build`, `dev`, `test`, etc.)
✅ Follow package type conventions
✅ Add package-specific scripts when needed
✅ Run validation before committing
✅ Use turbo for parallel execution
✅ Document custom scripts in package README

### DON'T

❌ Create aliases for standard scripts (`compile` instead of `build`)
❌ Use abbreviations (`b` instead of `build`)
❌ Skip required scripts
❌ Use different test frameworks (stick to Vitest)
❌ Hardcode environment-specific values

---

## Troubleshooting

### Script Validation Fails

**Problem**: `pnpm scripts:validate` fails

**Solutions**:
1. Check which packages are failing: `pnpm scripts:validate`
2. Preview auto-fix: `pnpm scripts:fix`
3. Apply fix: `pnpm scripts:fix:apply`
4. Manual review: Check package.json for the failing package

### Build Tool Detection Wrong

**Problem**: Auto-fix adds wrong build command

**Solutions**:
1. Manually set the correct build command
2. Ensure existing `build` script uses the right tool
3. Re-run auto-fix after correcting

### Missing Package-Specific Scripts

**Problem**: Auto-fix removes custom scripts

**Solution**: Auto-fix only adds missing scripts, never removes. Custom scripts are safe.

---

## Metrics & Monitoring

### Track Script Health

**Current metrics** (as of Phase 5 completion):
- Total packages: 22
- Passing validation: 21/21 (100%)
- Average health score: 97.9/100
- Scripts added in Phase 5: 52
- Duplication rate: 50.7% (intentional)

**Monitor over time:**
```bash
# Daily check
pnpm scripts:health

# Track in CI
pnpm scripts:validate --json > metrics/scripts-health.json
```

---

## References

- [Package Templates](../.revealui/templates/README.md)
- [Turbo Configuration](../turbo.json)
- [Main Scripts Reference](../SCRIPTS.md)
- [Contributing Guide](../CONTRIBUTING.md)

---

**Last Updated**: Phase 5 - Package.json Cleanup Complete
**Maintained By**: RevealUI Team
