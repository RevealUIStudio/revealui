# Script Management Demo

Comprehensive guide to managing package.json scripts across the monorepo.

## Overview

RevealUI provides powerful tools to standardize and validate package.json scripts:
- **Audit**: Find duplicates and inconsistencies
- **Validate**: Check compliance with templates
- **Auto-Fix**: Add missing scripts automatically
- **Health Check**: Overall script health monitoring

## Quick Start

```bash
# Full health check (validate + audit)
pnpm scripts:health

# Individual commands
pnpm scripts:audit      # Check for duplicates
pnpm scripts:validate   # Verify against templates
pnpm scripts:fix        # Preview auto-fix (dry-run)
pnpm scripts:fix:apply  # Apply fixes
```

## Demo Walkthrough

### Step 1: Audit Current State

```bash
pnpm scripts:audit
```

**Expected Output:**
```
📊 Package.json Script Audit Report
====================================

📈 Summary:
   Total Packages:        22
   Total Scripts:         347
   Unique Script Names:   171
   Duplicate Scripts:     17
   Duplication Rate:      50.7%

🔄 Top Duplicated Scripts:
   ✅ typecheck                 21 packages
   ⚠️  build                     22 packages
      Different implementations: 7
   ✅ test:watch                11 packages

💡 Recommendations:
   • Found 11 scripts duplicated across 5+ packages
   • Scripts are standardized (intentional duplication)
```

**What This Tells You:**
- 50.7% duplication is **good** (standardized scripts)
- `typecheck` is 100% consistent across packages
- `build` has 7 variants (expected - different build tools)

### Step 2: Validate Against Templates

```bash
pnpm scripts:validate
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

✅ Validation passed
```

**What This Tells You:**
- All packages meet standards
- Average health score: 97.9/100 (excellent)
- No missing required scripts

### Step 3: Validate Specific Package

```bash
pnpm scripts:validate --package @revealui/ai
```

**Output for a healthy package:**
```
✅ Package Script Validation Report
====================================

📊 Summary:
   Total Packages:    1
   ✅ Passed:          1
   ❌ Failed:          0
   📈 Average Score:   100/100

✅ Validation passed
```

### Step 4: Preview Auto-Fix

```bash
pnpm scripts:fix
```

**Example Output (if issues found):**
```
🔍 Dry Run - Script Fix Preview
================================

📊 Summary:
   Total Packages:      21
   Would Fix:           3
   Skipped:             18
   Scripts Added:       5
   Scripts Corrected:   0

📝 Would Add Scripts:

   @revealui/newpackage:
      + clean
      + test
      + typecheck

🔍 Dry run complete. Run without --dry-run to apply changes.
```

### Step 5: Apply Fixes

```bash
pnpm scripts:fix:apply
```

**Output:**
```
✨ Script Fix Report
====================

📊 Summary:
   Total Packages:      21
   Fixed:           3
   Scripts Added:       5

✅ Scripts fixed successfully!

Next steps:
  1. Review changes: git diff
  2. Validate: pnpm scripts:validate
  3. Test: pnpm test
```

### Step 6: Verify Fixes

```bash
# Check what changed
git diff

# Validate again
pnpm scripts:validate
```

## Advanced Usage

### Audit with Details

```bash
# Show all duplicate scripts with full details
pnpm scripts:audit --show-duplicates
```

**Output includes:**
```
📋 All Duplicate Scripts:

   build (22 packages):
      • reveal-ui: turbo run build --parallel
      • cms: next build
      • dashboard: next build
      • @revealui/ai: tsc
      • @revealui/cli: tsup
      ...
```

### Strict Validation

```bash
# Fail on warnings (not just errors)
pnpm scripts:validate --strict
```

**Use in CI/CD:**
```yaml
- name: Validate Scripts
  run: pnpm scripts:validate --strict
```

### JSON Output

```bash
# Get machine-readable output
pnpm scripts:audit --json > audit-results.json
pnpm scripts:validate --json > validation-results.json
```

## Real-World Scenarios

### Scenario 1: Adding a New Package

You just created `packages/mynewlib`:

```bash
# 1. Copy template
cp .revealui/templates/library.json packages/mynewlib/package.json

# 2. Customize package name and version
vim packages/mynewlib/package.json

# 3. Validate
pnpm scripts:validate --package @revealui/mynewlib

# Expected: ✅ Passed (100/100)
```

### Scenario 2: Package Missing Scripts

An older package is missing scripts:

```bash
# 1. Check what's missing
pnpm scripts:validate --package @revealui/oldpackage

# Output might show:
# ❌ Failed Packages:
#    @revealui/oldpackage (score: 65/100)
#       Missing: clean, test, typecheck

# 2. Preview fix
pnpm scripts:fix --package @revealui/oldpackage --dry-run

# 3. Apply fix
pnpm scripts:fix:apply --package @revealui/oldpackage

# 4. Verify
pnpm scripts:validate --package @revealui/oldpackage
# Now shows: ✅ Passed (100/100)
```

### Scenario 3: Pre-Commit Hook

Add validation to your git hooks:

```bash
# .husky/pre-commit
#!/bin/sh
pnpm scripts:validate --strict

if [ $? -ne 0 ]; then
  echo "❌ Script validation failed"
  echo "Run 'pnpm scripts:fix:apply' to fix"
  exit 1
fi
```

### Scenario 4: CI Pipeline

```yaml
# .github/workflows/ci.yml
- name: Validate Package Scripts
  run: |
    pnpm scripts:health
    pnpm scripts:audit --json > audit.json

- name: Upload Audit Report
  uses: actions/upload-artifact@v3
  with:
    name: script-audit
    path: audit.json
```

## Understanding Templates

### Library Template
For TypeScript libraries (most packages):
```json
{
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "lint": "biome check .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "clean": "rm -rf dist"
  }
}
```

### App Template
For Next.js/Vite applications:
```json
{
  "scripts": {
    "dev": "next dev --port 3000",
    "build": "next build",
    "start": "next start",
    "lint": "biome check .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "clean": "rm -rf .next .turbo"
  }
}
```

### Tool Template
For CLI tools and utilities:
```json
{
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "lint": "biome check .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  }
}
```

## Troubleshooting

### Issue: Validation Fails for Correct Scripts

**Problem**: Package has correct scripts but validation fails.

**Solution**: Check if script name matches exactly:
```bash
# Wrong
"typeCheck": "tsc --noEmit"

# Correct
"typecheck": "tsc --noEmit"
```

### Issue: Auto-Fix Adds Wrong Build Command

**Problem**: Auto-fix detected wrong framework.

**Solution**: Set correct build command first, then re-run:
```json
{
  "scripts": {
    "build": "vite build"  // Set this first
  }
}
```

Then run: `pnpm scripts:fix:apply`

### Issue: Want to Keep Custom Scripts

**Problem**: Worried auto-fix will remove custom scripts.

**Answer**: Auto-fix **only adds** missing scripts, never removes existing ones. Your custom scripts are safe.

## Best Practices

✅ **DO:**
- Run `pnpm scripts:health` regularly
- Validate before committing new packages
- Use templates when creating new packages
- Keep scripts standardized

❌ **DON'T:**
- Skip validation in CI
- Use non-standard script names
- Mix different testing frameworks
- Manually copy scripts between packages

## Next Steps

- [Script Standards](../../scripts/STANDARDS.md) - Complete reference
- [Package Templates](../../.revealui/templates/README.md) - Template details
- [Explorer Demo](./explorer-demo.md) - Discover available scripts

---

**See also**: [Scripts Reference](../../SCRIPTS.md#script-management-orchestration-)
