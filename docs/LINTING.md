# Linting & Code Formatting

This document describes the linting and formatting setup for the RevealUI monorepo.

## Overview

The project uses **ESLint for type-aware linting** and **Biome for formatting + fast linting**. This separation provides:

- **ESLint**: Type-aware TypeScript rules that catch type safety issues
- **Biome**: Fast formatting and style rules that don't require type information

## Standardized Commands

The repo standardizes on a single ESLint command from the root (Turbo runs per-package `lint:eslint` scripts):

```bash
pnpm lint:eslint
```

### Running Linting

**From root** (lints all packages):
```bash
pnpm lint
```

**Biome-only in a specific package**:
```bash
cd apps/cms
pnpm lint
```

**ESLint in a specific package/app**:
```bash
pnpm --filter <pkg> lint:eslint
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

**ESLint fixes** (type-aware lint fixes):
```bash
pnpm lint:eslint:fix
```

## ESLint Configuration

### Shared Config

Each package/app owns its `eslint.config.js` (or `eslint.config.mjs` if it is not ESM) and composes the shared config from `packages/dev`:

```javascript
// eslint.config.js
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { baseConfig, createTypeCheckedConfig } from 'dev/eslint'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default [
  ...baseConfig,
  createTypeCheckedConfig({ tsconfigRootDir: __dirname }),
]
```

For Next.js apps, add the Next plugin rules:

```javascript
import next from '@next/eslint-plugin-next'

const nextFiles = [
  'src/**/*.{ts,tsx,js,jsx}',
  'app/**/*.{ts,tsx,js,jsx}',
  'pages/**/*.{ts,tsx,js,jsx}',
]

export default [
  ...baseConfig,
  createTypeCheckedConfig({ tsconfigRootDir: __dirname }),
  {
    ...next.configs['core-web-vitals'],
    files: nextFiles,
  },
]
```

### What ESLint Checks

ESLint focuses on **type-aware TypeScript rules** that require type information:

- `@typescript-eslint/no-explicit-any`: Prevents `any` types
- `@typescript-eslint/no-unsafe-*`: Catches unsafe type operations
- Additional type-safe rules from the `recommended-type-checked` preset

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

1. **Biome**: `pnpm lint:biome` (checks formatting and Biome linting)
2. **ESLint**: `pnpm lint:eslint` (type-aware checks for apps/packages source)

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

**Changed to**: Each package/app owns an `eslint.config.*` and a `lint:eslint` script; the root `pnpm lint:eslint` runs them via Turbo.

**Formatting**: Biome still handles all formatting (unchanged).

## Package-Specific Notes

### Apps

- Use local `eslint.config.js`/`eslint.config.mjs` plus the shared `dev/eslint` config
- Next apps add `@next/eslint-plugin-next` rules (core web vitals)

### Packages

- Use the `lint:eslint` script (`eslint .`)
- Extend shared config from `dev/eslint`
- Package-specific ignores in local `eslint.config.*`

## Best Practices

1. **Always run `pnpm format` before committing**
2. **Fix linting errors before pushing**
3. **Don't disable rules without justification**
4. **Keep ignore patterns minimal** (prefer fixing issues over ignoring)

## Related Documentation

- [CONTRIBUTING.md](../CONTRIBUTING.md) - General contribution guidelines
- [ESLint Config](../packages/dev/src/eslint/eslint.config.js) - Shared ESLint configuration
- [Biome Config](../biome.json) - Biome configuration
