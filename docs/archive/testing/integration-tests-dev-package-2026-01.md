# Integration Tests & Verification Scripts

## Overview

This package now includes comprehensive integration tests and automated verification scripts to ensure all configs work correctly and imports are consistent.

## Integration Tests

**Location**: `packages/dev/src/__tests__/integration/configs.integration.test.ts`

### What They Test

1. **Tailwind Config**
   - Config can be imported
   - `createTailwindConfig` helper works
   - Configs have correct structure (content, plugins, theme)
   - Deep merging of theme.extend works correctly

2. **PostCSS Config**
   - Config can be imported
   - Required plugins are present

3. **Vite Config**
   - Config can be imported
   - Build configuration is present
   - Resolve aliases are configured

4. **ESLint Config**
   - Config can be imported
   - Proper config structure (array format)

5. **Biome Config**
   - Config can be imported
   - Formatter configuration is present

6. **TypeScript Configs**
   - JSON config files exist (base.json, nextjs.json, revealui.json)

7. **App Config Integration**
   - All main exports are accessible
   - Configs can be used in app context

### Running Tests

```bash
# Run all tests
pnpm --filter dev test

# Run in watch mode
pnpm --filter dev test:watch

# Run integration tests only
pnpm --filter dev test:integration

# Run with UI
pnpm --filter dev test:ui
```

### Test Coverage

Tests verify:
- ✅ All configs can be imported via `dev/...` paths
- ✅ Configs have correct structure
- ✅ Helper functions work correctly
- ✅ Deep merging works as expected
- ✅ All exports are accessible

## Verification Script

**Location**: `scripts/validation/verify-dev-package-imports.ts`

### What It Does

Automatically verifies that all config files use correct `dev/...` import paths and don't have:
- Relative paths to `packages/dev/src/...`
- Incorrect package names (`@revealui/dev/...`)
- Legacy path mappings

### Running Verification

```bash
# From root
pnpm verify:dev-imports

# From dev package
pnpm --filter dev verify:imports
```

### What It Checks

- ✅ All config files (tailwind, postcss, vite, eslint)
- ✅ Uses `dev/...` imports correctly
- ✅ No relative paths to packages/dev
- ✅ No incorrect package references

### Output

- **✅ All imports correct**: Exit code 0
- **❌ Errors found**: Exit code 1 (fails CI/CD)
- **⚠️ Warnings**: Non-critical issues (legitimate configs that don't need dev imports)

## CI/CD Integration

### Add to CI Pipeline

```yaml
# Example GitHub Actions
- name: Verify dev package imports
  run: pnpm verify:dev-imports

- name: Run dev package tests
  run: pnpm --filter dev test
```

### Pre-commit Hook (Optional)

```bash
#!/bin/sh
pnpm verify:dev-imports && pnpm --filter dev test
```

## Benefits

1. **Prevents Regressions**: Catches import path issues before they reach production
2. **Automated Verification**: No manual checking needed
3. **Fast Feedback**: Runs quickly in CI/CD pipelines
4. **Comprehensive Coverage**: Tests all config types and exports

## Maintenance

- **Tests**: Update when config structure changes
- **Verification Script**: Update when adding new config patterns
- **Both**: Run automatically in CI/CD for continuous verification
