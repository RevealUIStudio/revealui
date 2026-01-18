# ESLint Configuration

This ESLint configuration is designed to **complement** Biome, not replace it.

## Strategy: ESLint + Biome

### Biome Handles:
- ✅ Code formatting (indentation, quotes, semicolons, etc.)
- ✅ Style rules (useForOf, useConst, useTemplate, etc.)
- ✅ Most correctness checks (no unused variables, no unreachable code, etc.)
- ✅ Performance rules (no accumulating spread, no delete, etc.)
- ✅ Security rules (no global eval, no dangerouslySetInnerHtml, etc.)
- ✅ Import organization
- ✅ Accessibility rules

### ESLint Handles:
- ✅ Type-aware TypeScript rules (requires TypeScript compiler)
- ✅ Type safety checks (`no-unsafe-*` rules)
- ✅ Type-only import enforcement
- ✅ React-specific type checking

## Why Both?

**Biome** is fast and handles most linting/formatting needs, but it doesn't have access to TypeScript's type information. **ESLint with typescript-eslint** can leverage the TypeScript compiler to catch type safety issues that Biome cannot detect.

## Usage

This config is exported from `dev/eslint` and used by apps/packages:

```js
import sharedConfig from 'dev/eslint'

export default [...sharedConfig]
```

## Type-Aware Rules

The config includes type-aware rules that require files to be included in `tsconfig.json`. If you see "TSConfig does not include this file" errors:

1. Add the file to your `tsconfig.json` `include` array, OR
2. The file is intentionally excluded (config files, scripts, etc.)

## Performance

Type-aware linting can be slower. The config uses:
- ESLint's `--cache` flag for faster subsequent runs
- Automatic tsconfig.json detection per package/app
- Exclusions for config files and scripts that don't need type checking
