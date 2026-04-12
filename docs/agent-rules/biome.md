# Biome Conventions

## Overview

Biome 2 is the sole linter and formatter for this monorepo.

## Commands

- `pnpm lint`  -  check all files with Biome (`biome check .`)
- `pnpm format`  -  format all files with Biome (`biome format --write .`)
- `pnpm lint:fix`  -  auto-fix with Biome (`biome check --write .`)
- `biome check .`  -  lint + format check (per-package)
- `biome check --write .`  -  auto-fix (used by lint-staged)

## Lint-Staged

Pre-commit hook runs `biome check --write` on staged `*.{ts,tsx,js,jsx}` files via Husky + lint-staged.

## Key Rules

- No unused variables or imports (auto-removed on format)
- No `console.*` in production code (use `@revealui/utils` logger instead)
- No `any` types (use `unknown` + type guards)
- Consistent import ordering (auto-sorted)
- Single quotes for strings
- Trailing commas
- Semicolons always
- 2-space indentation (tabs in Biome config, spaces in output)

## Suppressing Rules

- Use `// biome-ignore <rule>: <reason>` for specific lines
- Avoid blanket suppressions  -  prefer fixing the code
- Document why a suppression is needed in the comment

## Unused Variables  -  Special Protocol

**Before suppressing any unused variable or import warning, see unused-declarations.md in this directory.**

The mandatory decision tree there must be followed. Unused declarations frequently indicate incomplete implementations that need to be finished, not suppressed. Silencing the warning without completing the code creates permanent dead stubs.

TL;DR: implement first, suppress only as a last resort.
