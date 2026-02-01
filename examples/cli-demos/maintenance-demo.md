# Maintenance CLI Demo

Automated fixes and maintenance tasks for code quality.

## What is the Maintenance CLI?

The maintain CLI provides automated solutions for common code quality issues:
- **Import fixes**: Add missing `.js` extensions
- **Linting fixes**: Auto-fix Biome and ESLint errors
- **Type fixes**: Resolve TypeScript errors
- **Script management**: Validate and fix package.json scripts
- **Cleanup**: Remove generated files and caches
- **Supabase types**: Update database types

## Quick Start

```bash
# Show all maintenance commands
pnpm maintain

# Fix import extensions
pnpm maintain:fix-imports

# Fix linting errors
pnpm maintain:fix-lint

# Validate package scripts
pnpm maintain:validate-scripts

# Clean all generated files
pnpm maintain:clean
```

## Demo Walkthrough

### Step 1: Check Available Commands

```bash
pnpm maintain --help
```

**Expected Output:**
```
🛠️  RevealUI Maintenance CLI
============================

Available commands:

  fix-imports         Fix missing .js extensions in import statements
  fix-lint            Auto-fix linting errors (Biome + ESLint)
  fix-types           Fix common TypeScript errors
  fix-supabase        Update Supabase database types
  audit-scripts       Audit package.json scripts for duplicates
  validate-scripts    Validate scripts against templates
  fix-scripts         Auto-fix package scripts
  clean               Remove all generated files

Options:
  --dry-run           Preview changes without applying
  --package <name>    Target specific package
  --json              Output in JSON format
  --help              Show this help

Examples:
  pnpm maintain fix-imports --dry-run
  pnpm maintain validate-scripts --package @revealui/core
  pnpm maintain clean
```

### Step 2: Fix Import Extensions

**Problem**: TypeScript imports missing `.js` extensions for ESM compatibility

```bash
# Preview what will be fixed (dry-run)
pnpm maintain:fix-imports --dry-run
```

**Expected Output:**
```
🔍 Scanning for import statements...

Found issues in 47 files:

📝 packages/core/src/config/index.ts
  Line 3:  import { env } from './env'
  Fix:     import { env } from './env.js'

  Line 5:  import { logger } from '../utils/logger'
  Fix:     import { logger } from '../utils/logger.js'

📝 packages/auth/src/permissions/index.ts
  Line 1:  import type { User } from '../types'
  Fix:     import type { User } from '../types.js'

...

📊 Summary:
  Files affected:     47
  Imports to fix:     156
  Type imports:       34
  Regular imports:    122

Run without --dry-run to apply changes.
```

**Apply the fixes:**
```bash
pnpm maintain:fix-imports
```

**Output:**
```
✨ Fixing import extensions...

✅ Fixed 47 files
   • Added .js to 156 imports
   • No errors detected

Next steps:
  1. Review changes: git diff
  2. Run type check: pnpm typecheck:all
  3. Run tests: pnpm test
```

### Step 3: Fix Linting Errors

```bash
# Check current lint status
pnpm lint
```

**Output (with errors):**
```
❌ Linting failed

packages/core/src/utils/format.ts:23:5
  Unexpected console.log

apps/cms/src/components/Header.tsx:45:12
  Missing return type annotation

packages/db/src/queries/users.ts:67:3
  Prefer const over let

Found 34 errors across 12 files
```

**Auto-fix:**
```bash
pnpm maintain:fix-lint
```

**Expected Output:**
```
🔧 Running auto-fix for linting errors...

Running Biome auto-fix...
  ✅ Fixed 28 errors

Running ESLint auto-fix...
  ✅ Fixed 4 errors

📊 Results:
  Total errors:        34
  Auto-fixed:          32
  Manual review:       2

Remaining issues:
  packages/core/src/utils/format.ts:23
    • console.log (manual removal required)

  apps/cms/src/lib/payload/hooks.ts:89
    • Cyclic dependency (refactor needed)

✅ Linting mostly fixed!

Next steps:
  1. Review auto-fixes: git diff
  2. Manually fix remaining 2 issues
  3. Run lint again: pnpm lint
```

### Step 4: Validate Package Scripts

```bash
pnpm maintain:validate-scripts
```

**Expected Output:**
```
✅ Package Script Validation Report
====================================

📊 Summary:
   Total Packages:    21
   ✅ Passed:          21
   ⚠️  Warnings:        0
   ❌ Failed:          0
   📈 Average Score:   97.9/100

Top Packages:
   • @revealui/core        100/100
   • @revealui/auth        100/100
   • @revealui/db          100/100
   • cms                   100/100
   • dashboard             100/100

✅ All packages meet script standards!
```

**If there are issues:**
```bash
pnpm maintain:validate-scripts --package @revealui/oldpackage
```

**Output (with issues):**
```
❌ Package Script Validation Report
====================================

📊 Summary for @revealui/oldpackage:
   Score: 65/100

❌ Missing Required Scripts:
   • clean
   • test
   • typecheck

⚠️  Incorrect Implementations:
   • lint (using old config)
     Expected: biome check .
     Actual:   eslint . && prettier --check .

💡 Suggestions:
   Run: pnpm maintain:fix-scripts --package @revealui/oldpackage
```

### Step 5: Auto-Fix Package Scripts

```bash
# Preview fixes
pnpm maintain:fix-scripts --dry-run
```

**Expected Output:**
```
🔍 Dry Run - Script Fix Preview
================================

📊 Summary:
   Total Packages:      21
   Would Fix:           1
   Skipped:             20
   Scripts Added:       3
   Scripts Corrected:   1

📝 Would Add Scripts:

   @revealui/oldpackage:
      + clean: "rm -rf dist"
      + test: "vitest run"
      + typecheck: "tsc --noEmit"

📝 Would Correct Scripts:

   @revealui/oldpackage:
      ~ lint: "eslint . && prettier --check ."
           → "biome check ."

🔍 Dry run complete. Run without --dry-run to apply changes.
```

**Apply fixes:**
```bash
pnpm maintain:fix-scripts --package @revealui/oldpackage
```

**Output:**
```
✨ Fixing package scripts...

✅ Fixed @revealui/oldpackage
   • Added 3 scripts
   • Corrected 1 script

Next steps:
  1. Review changes: git diff packages/oldpackage/package.json
  2. Validate: pnpm maintain:validate-scripts
  3. Test: pnpm --filter @revealui/oldpackage test
```

### Step 6: Clean Generated Files

```bash
pnpm maintain:clean
```

**Expected Output:**
```
🧹 Cleaning generated files...

Removing build artifacts:
  ✅ Cleaned dist/ (22 packages)
  ✅ Cleaned .next/ (5 apps)
  ✅ Cleaned .turbo/ (root + packages)

Removing cache files:
  ✅ Cleaned node_modules/.cache/
  ✅ Cleaned .eslintcache
  ✅ Cleaned tsconfig.tsbuildinfo

Removing coverage:
  ✅ Cleaned coverage/ (14 packages)

📊 Summary:
  Disk space freed:    2.3 GB
  Files removed:       15,847
  Directories removed: 892

✅ Cleanup complete!
```

## Advanced Usage

### Targeted Fixes

```bash
# Fix imports in specific package
pnpm maintain:fix-imports --package @revealui/core

# Fix imports in specific directory
pnpm maintain:fix-imports --path packages/core/src

# Fix imports in single file
pnpm maintain:fix-imports --file packages/core/src/index.ts
```

### Type Fixes

```bash
# Show common type errors
pnpm maintain:fix-types --analyze

# Auto-fix common patterns
pnpm maintain:fix-types --auto-fix

# Output:
# ✅ Fixed 12 type errors:
#   • Added return type annotations: 5
#   • Fixed implicit any: 4
#   • Added type assertions: 3
```

### Database Type Updates

```bash
# Update Supabase types
pnpm maintain:fix-supabase

# Expected output:
# 🔄 Fetching latest Supabase schema...
# ✅ Downloaded schema
# ✅ Generated TypeScript types
# ✅ Updated packages/db/src/types/supabase.ts
#
# Changes:
#   • Added 3 new tables
#   • Updated 5 table definitions
#   • Added 12 new type exports
```

### Batch Operations

```bash
# Fix everything in one command
pnpm maintain:fix-imports && \
pnpm maintain:fix-lint && \
pnpm maintain:validate-scripts

# Or use the orchestration script
pnpm maintain:fix-all
```

## Real-World Workflows

### Scenario 1: After Pulling Latest Changes

**Situation**: Pulled `main`, now have merge conflicts and linting errors

```bash
# Step 1: Resolve conflicts (manual)
git merge main

# Step 2: Clean old build artifacts
pnpm maintain:clean

# Step 3: Fix imports (ESM migration in progress)
pnpm maintain:fix-imports

# Step 4: Fix any linting issues
pnpm maintain:fix-lint

# Step 5: Validate package scripts
pnpm maintain:validate-scripts

# Step 6: Verify everything works
pnpm install
pnpm build
pnpm test
```

### Scenario 2: Preparing for Release

**Situation**: About to release, need everything clean

```bash
# Full maintenance checklist
echo "🚀 Pre-release Maintenance"

# 1. Update dependencies
pnpm update --latest --recursive

# 2. Fix any import issues
pnpm maintain:fix-imports

# 3. Fix linting
pnpm maintain:fix-lint

# 4. Validate all scripts
pnpm maintain:validate-scripts --strict

# 5. Clean everything
pnpm maintain:clean

# 6. Fresh install
pnpm install

# 7. Full build
pnpm build

# 8. Run all tests
pnpm test

# 9. Type check everything
pnpm typecheck:all

echo "✅ Ready for release!"
```

### Scenario 3: Onboarding New Package

**Situation**: Just created `packages/newlib`, need to set it up properly

```bash
# Step 1: Copy template
cp package-templates/library.json packages/newlib/package.json

# Step 2: Customize package.json
# (edit name, version, dependencies)

# Step 3: Validate scripts
pnpm maintain:validate-scripts --package @revealui/newlib

# Step 4: Auto-fix any issues
pnpm maintain:fix-scripts --package @revealui/newlib

# Step 5: Verify
pnpm --filter @revealui/newlib build
pnpm --filter @revealui/newlib test

# Expected: ✅ All passing
```

### Scenario 4: Fixing CI Failures

**Situation**: CI failing with lint/type errors

```bash
# Step 1: Reproduce locally
pnpm lint
pnpm typecheck:all

# Step 2: Auto-fix what's possible
pnpm maintain:fix-lint
pnpm maintain:fix-imports

# Step 3: Check what's left
pnpm lint
pnpm typecheck:all

# Step 4: Fix remaining issues manually
# (review output and fix individually)

# Step 5: Verify
pnpm test
pnpm build

# Step 6: Commit
git add .
git commit -m "fix: resolve linting and type errors"
```

## Integration with Git Hooks

### Pre-commit Hook

```bash
# .husky/pre-commit
#!/bin/sh

# Auto-fix common issues before committing
pnpm maintain:fix-imports --quiet
pnpm maintain:fix-lint --quiet

# Validate scripts
pnpm maintain:validate-scripts --quiet --strict

# If any changes were made, stage them
git add -u
```

### Pre-push Hook

```bash
# .husky/pre-push
#!/bin/sh

# Full validation before pushing
pnpm maintain:validate-scripts --strict || exit 1
pnpm typecheck:all || exit 1
pnpm test || exit 1
```

## Best Practices

### Before Committing
```bash
# Quick maintenance
pnpm maintain:fix-imports
pnpm maintain:fix-lint
pnpm maintain:validate-scripts
```

### Weekly Maintenance
```bash
# Full cleanup
pnpm maintain:clean
pnpm maintain:fix-all
pnpm maintain:validate-scripts --strict
```

### Before Releases
```bash
# Complete maintenance
pnpm maintain:clean
pnpm maintain:fix-imports
pnpm maintain:fix-lint
pnpm maintain:fix-types --analyze
pnpm maintain:validate-scripts --strict
pnpm maintain:audit-scripts
```

## Troubleshooting

### Import Fixes Break Code

**Problem**: Auto-fixed imports cause build errors

**Solution**: Some imports might need manual review:
```bash
# Dry-run first to see what will change
pnpm maintain:fix-imports --dry-run

# Review the output carefully
# If needed, exclude specific files:
pnpm maintain:fix-imports --exclude "test/**"
```

### Lint Auto-Fix Too Aggressive

**Problem**: Auto-fix changes code behavior

**Solution**: Use dry-run and review:
```bash
pnpm maintain:fix-lint --dry-run
git diff  # Review all changes before applying
```

### Script Validation False Positives

**Problem**: Custom scripts flagged as incorrect

**Solution**: Add exemptions:
```json
// package.json
{
  "maintenance": {
    "exemptions": {
      "scripts": ["custom:build"]
    }
  }
}
```

## Tips & Tricks

### Combine with Other Tools

```bash
# Fix, then validate
pnpm maintain:fix-lint && pnpm lint

# Clean, install, build
pnpm maintain:clean && pnpm install && pnpm build
```

### Save Maintenance Scripts

Create a custom maintenance workflow:
```json
// package.json
{
  "scripts": {
    "maintain:full": "pnpm maintain:clean && pnpm maintain:fix-imports && pnpm maintain:fix-lint && pnpm maintain:validate-scripts",
    "maintain:quick": "pnpm maintain:fix-lint && pnpm maintain:validate-scripts"
  }
}
```

### Monitor Maintenance Impact

```bash
# Before
pnpm lint | tee lint-before.txt

# Maintain
pnpm maintain:fix-lint

# After
pnpm lint | tee lint-after.txt

# Compare
diff lint-before.txt lint-after.txt
```

## Next Steps

- [Script Management Demo](./script-management-demo.md) - Package.json standardization
- [Profiling Demo](./profiling-demo.md) - Performance optimization
- [Explorer Demo](./explorer-demo.md) - Discover maintenance commands

---

**See also**: [Maintenance CLI Reference](../../SCRIPTS.md#maintenance--fixes-)
