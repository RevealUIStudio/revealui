# Linting & Code Formatting

This document describes the linting and formatting setup for the RevealUI monorepo.

## Overview

The project uses **ESLint for linting** and **Biome for formatting**. This separation provides:

- **ESLint**: Type-aware TypeScript rules that catch type safety issues
- **Biome**: Fast formatting and style rules that don't require type information

## Standardized Commands

All packages use the same ESLint command format:

```bash
eslint . --cache
```

The `--cache` flag improves performance by caching results between runs.

### Running Linting

**From root** (lints all packages):
```bash
pnpm lint
```

**In a specific package**:
```bash
cd apps/cms
pnpm lint
```

## Formatting

**Biome handles ALL formatting**. Do not use ESLint's `--fix` flag.

**Format all files**:
```bash
pnpm format
```

**Format and lint fix** (Biome formatting + lint fixes):
```bash
pnpm lint:fix
```

## ESLint Configuration

### Shared Config

All packages extend a shared ESLint configuration from `packages/dev`:

```javascript
// eslint.config.js (in any package)
import sharedConfig from 'dev/eslint'

export default [
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      // package-specific ignores
    ],
  },
  ...sharedConfig,
]
```

### What ESLint Checks

ESLint focuses on **type-aware TypeScript rules** that require type information:

- `@typescript-eslint/no-explicit-any`: Prevents `any` types
- `@typescript-eslint/no-unsafe-*`: Catches unsafe type operations
- `@typescript-eslint/explicit-module-boundary-types`: Requires return types on exports
- Type-safe rules that Biome cannot check

### Config Files

Config files are excluded from type-aware linting (they use basic syntax-only rules):
- `**/*.config.*`
- `**/eslint.config.*`
- `**/vite.config.*`
- `**/next.config.*`

## Biome Configuration

### What Biome Handles

- **Formatting**: All code formatting (quotes, semicolons, indentation)
- **Style Rules**: Code style checks (use const, use template, etc.)
- **Accessibility**: a11y rules
- **Performance**: Performance-related linting
- **Security**: Security-related linting

### Biome Rules

See `biome.json` in the root for full configuration. Key settings:

- **Quotes**: Single quotes for strings, double quotes for JSX
- **Semicolons**: `asNeeded` (only when required)
- **Line Width**: 100 characters
- **Indentation**: 2 spaces

## Pre-Commit Guidelines

Before committing:

1. **Format code**: `pnpm format` or `pnpm lint:fix`
2. **Run linting**: `pnpm lint`
3. **Fix any errors**: ESLint and Biome will report issues

## CI/CD

The CI pipeline runs:

1. **ESLint**: `pnpm lint` (checks all packages via Turbo)
2. **Biome**: `pnpm exec biome check .` (checks formatting and Biome linting)

Both must pass for CI to succeed.

## Troubleshooting

### ESLint "Cannot find module 'dev/eslint'"

Ensure `dev` workspace package is installed:
```bash
pnpm install
```

### Type-aware rules not working

Ensure your package has a `tsconfig.json` and files are included in the `include` array.

### Formatting conflicts

Never use `eslint --fix`. Always use `biome format --write .` for formatting.

### Cache issues

Clear ESLint cache:
```bash
rm -rf .eslintcache
```

Clear Biome cache:
```bash
rm -rf node_modules/.cache/biome
```

## Migration Notes

**Changed from**: Previously, some packages used `biome lint .` for linting.

**Changed to**: All packages now use `eslint . --cache` for consistent linting experience.

**Formatting**: Biome still handles all formatting (unchanged).

## Package-Specific Notes

### Apps (cms, web)

- Have additional ignores for build artifacts (`.next/`, `dist/`)
- May have app-specific ignore patterns in `eslint.config.js`

### Packages

- Use standard `eslint . --cache` command
- Extend shared config from `dev/eslint`
- Package-specific ignores in local `eslint.config.js`

## Best Practices

1. **Always run `pnpm format` before committing**
2. **Fix linting errors before pushing**
3. **Don't disable rules without justification**
4. **Keep ignore patterns minimal** (prefer fixing issues over ignoring)

## Related Documentation

- [CONTRIBUTING.md](../CONTRIBUTING.md) - General contribution guidelines
- [ESLint Config](../packages/dev/src/eslint/eslint.config.js) - Shared ESLint configuration
- [Biome Config](../biome.json) - Biome configuration
