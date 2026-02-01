# Migration Guide

Comprehensive guide for migrating to RevealUI's standardized script management system.

## Overview

This guide covers the migration from legacy script patterns to the new standardized system implemented in Phase 5 of the Script Management Improvement Plan.

**What Changed:**
- ✅ Package.json scripts now follow standard templates
- ✅ New CLI tools for maintenance and validation
- ✅ Automated script auditing and fixing
- ✅ Enhanced turbo.json with optimized caching
- ✅ Comprehensive script documentation

**Timeline:** Phase 5 completed, all 21 packages migrated

---

## Table of Contents

1. [Who Should Read This](#who-should-read-this)
2. [Breaking Changes](#breaking-changes)
3. [New Features](#new-features)
4. [Migration Steps](#migration-steps)
5. [Command Reference](#command-reference)
6. [Troubleshooting](#troubleshooting)
7. [FAQ](#faq)

---

## Who Should Read This

### Developers
If you:
- Work on the RevealUI monorepo
- Create new packages
- Modify package.json scripts
- Run CI/CD pipelines

**Action Required:** Update your workflows to use new commands

### Package Maintainers
If you:
- Maintain individual packages
- Create new packages
- Set up package scripts

**Action Required:** Use package templates for new packages

### DevOps/CI Engineers
If you:
- Manage CI/CD pipelines
- Configure build systems
- Monitor build performance

**Action Required:** Update CI scripts to use new validation commands

---

## Breaking Changes

### ⚠️ Important: No Breaking Changes!

The migration was designed with **zero breaking changes**:

- ✅ All existing commands still work
- ✅ Old script names preserved (with new standardized versions)
- ✅ No changes to build outputs or behavior
- ✅ Backward compatibility maintained

### Deprecated (But Still Working)

The following commands are deprecated but continue to work:

```bash
# Old Analysis Commands (still work)
pnpm analysis:quality       # → Use: pnpm analyze:quality
pnpm analysis:types         # → Use: pnpm analyze:types
pnpm analysis:console       # → Use: pnpm analyze:console

# Old Fix Commands (still work)
pnpm fix:import-extensions  # → Use: pnpm maintain:fix-imports
pnpm fix:import-extensions:dry  # → Use: pnpm maintain:fix-imports --dry-run
```

**Deprecation Timeline:**
- **Now (Phase 6):** Both old and new commands work
- **v2.0 (3 months):** Old commands show deprecation warnings
- **v3.0 (6 months):** Old commands removed

---

## New Features

### 1. Package Script Management

**New Commands:**
```bash
pnpm scripts:audit              # Audit all package scripts
pnpm scripts:validate           # Validate against templates
pnpm scripts:fix                # Preview auto-fix (dry-run)
pnpm scripts:fix:apply          # Apply auto-fix
pnpm scripts:health             # Full health check
```

**What it does:**
- Detects duplicate scripts across packages
- Validates scripts against standard templates
- Auto-fixes missing scripts
- Provides health scoring (0-100)

**Example:**
```bash
# Before Phase 5
# Manual checking, inconsistent scripts

# After Phase 5
$ pnpm scripts:validate
✅ 21/21 packages passing (97.9/100 average score)
```

### 2. Enhanced Maintain CLI

**New Commands:**
```bash
pnpm maintain                   # Show all maintain commands
pnpm maintain:fix-imports       # Fix missing .js extensions
pnpm maintain:fix-lint          # Auto-fix linting errors
pnpm maintain:fix-types         # Fix TypeScript errors
pnpm maintain:validate-scripts  # Validate package scripts
pnpm maintain:audit-scripts     # Audit for duplicates
pnpm maintain:fix-scripts       # Auto-fix scripts
pnpm maintain:clean             # Clean generated files
```

**What it does:**
- Consolidates all fix-* scripts into one CLI
- Provides dry-run mode for previewing changes
- Supports targeting specific packages
- JSON output for CI integration

### 3. Package Templates

**New Templates:**
```
package-templates/
├── library.json      # Standard library template
├── app.json          # Next.js/Vite app template
└── tool.json         # CLI tool template
```

**What it does:**
- Provides standardized starting points for new packages
- Ensures consistency across the monorepo
- Reduces setup time for new packages

**Example:**
```bash
# Creating a new library
cp package-templates/library.json packages/mylib/package.json
# Edit name, version, dependencies
pnpm scripts:validate --package @revealui/mylib
# ✅ 100/100 score
```

### 4. Optimized Turbo.json

**New Features:**
- Clear task organization with comments
- Comprehensive input/output definitions
- Proper dependency chains
- Cache configuration for all tasks

**Example:**
```json
{
  "tasks": {
    "build": {
      "cache": true,
      "dependsOn": ["^build"],
      "inputs": ["src/**", "package.json", "tsconfig.json"],
      "outputs": ["dist/**", ".next/**"]
    }
  }
}
```

### 5. Comprehensive Documentation

**New Documentation:**
- [Script Standards](../scripts/STANDARDS.md) - Complete standards reference
- [CLI Demos](../examples/cli-demos/README.md) - Interactive tutorials
- [Scripts Reference](../SCRIPTS.md) - All commands documented

---

## Migration Steps

### For Existing Developers

#### Step 1: Update Local Environment

```bash
# Pull latest changes
git pull origin main

# Clean install
pnpm clean:install

# Verify everything works
pnpm build
pnpm test
```

**Expected:** All builds and tests pass as before

#### Step 2: Learn New Commands

```bash
# Explore available scripts
pnpm explore

# View script standards
cat scripts/STANDARDS.md

# Check package script health
pnpm scripts:validate
```

**Time:** 15 minutes

**Outcome:** Familiar with new tools

#### Step 3: Update Workflows

**Before:**
```bash
# Old workflow
pnpm fix:import-extensions
pnpm analysis:quality
```

**After:**
```bash
# New workflow (old still works!)
pnpm maintain:fix-imports
pnpm analyze:quality
```

**Time:** 5 minutes

**Outcome:** Using preferred commands

#### Step 4: Update IDE/Editor Config

**VS Code tasks.json:**
```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Validate Scripts",
      "type": "shell",
      "command": "pnpm scripts:validate"
    },
    {
      "label": "Fix Imports",
      "type": "shell",
      "command": "pnpm maintain:fix-imports"
    }
  ]
}
```

**Time:** 10 minutes

**Outcome:** Quick access to new commands

### For Package Maintainers

#### Step 1: Validate Your Packages

```bash
# Check specific package
pnpm scripts:validate --package @revealui/mypackage

# Expected output:
# ✅ Passed (score: 100/100)
# or
# ❌ Failed (score: 65/100)
#    Missing: clean, test, typecheck
```

#### Step 2: Auto-Fix Issues (If Needed)

```bash
# Preview fixes
pnpm maintain:fix-scripts --package @revealui/mypackage --dry-run

# Review proposed changes

# Apply fixes
pnpm maintain:fix-scripts --package @revealui/mypackage

# Verify
pnpm scripts:validate --package @revealui/mypackage
# ✅ Passed (score: 100/100)
```

#### Step 3: Review Changes

```bash
# Check what changed
git diff packages/mypackage/package.json

# Common changes:
# + "clean": "rm -rf dist"
# + "typecheck": "tsc --noEmit"
# + "test:watch": "vitest"
```

#### Step 4: Test Package

```bash
# Run all package scripts
pnpm --filter @revealui/mypackage clean
pnpm --filter @revealui/mypackage build
pnpm --filter @revealui/mypackage test
pnpm --filter @revealui/mypackage typecheck

# Expected: All pass
```

### For New Package Creation

#### Step 1: Choose Template

```bash
# Library (most packages)
cp package-templates/library.json packages/mynewlib/package.json

# App (Next.js/Vite)
cp package-templates/app.json apps/mynewapp/package.json

# Tool (CLI)
cp package-templates/tool.json packages/mytool/package.json
```

#### Step 2: Customize Package.json

```json
{
  "name": "@revealui/mynewlib",
  "version": "0.1.0",
  "description": "My new library",
  // ... scripts from template (already included)
  "dependencies": {
    // Add your dependencies
  }
}
```

#### Step 3: Validate

```bash
pnpm scripts:validate --package @revealui/mynewlib
# ✅ Passed (score: 100/100)
```

#### Step 4: Develop

```bash
# All standard scripts available immediately
pnpm --filter @revealui/mynewlib dev
pnpm --filter @revealui/mynewlib build
pnpm --filter @revealui/mynewlib test
```

### For CI/CD Pipelines

#### Step 1: Add Script Validation

**Before:**
```yaml
# .github/workflows/ci.yml
- name: Build
  run: pnpm build

- name: Test
  run: pnpm test
```

**After:**
```yaml
# .github/workflows/ci.yml
- name: Validate Package Scripts
  run: pnpm scripts:validate --strict

- name: Build
  run: pnpm build

- name: Test
  run: pnpm test
```

**Benefit:** Catch script inconsistencies in CI

#### Step 2: Add Script Health Check

```yaml
- name: Script Health Check
  run: |
    pnpm scripts:health
    pnpm scripts:audit --json > audit-results.json

- name: Upload Audit Results
  uses: actions/upload-artifact@v3
  with:
    name: script-audit
    path: audit-results.json
```

**Benefit:** Track script quality over time

#### Step 3: Update Scheduled Jobs

```yaml
# .github/workflows/scheduled.yml
name: Weekly Maintenance

on:
  schedule:
    - cron: '0 0 * * 0'  # Every Sunday

jobs:
  maintenance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Validate Scripts
        run: pnpm scripts:validate --strict

      - name: Audit Scripts
        run: pnpm scripts:audit

      - name: Create Issue if Failed
        if: failure()
        uses: actions/create-issue@v2
        with:
          title: 'Weekly script validation failed'
```

**Benefit:** Proactive quality monitoring

---

## Command Reference

### Old → New Mapping

| Old Command | New Command | Status |
|-------------|-------------|--------|
| `pnpm analysis:quality` | `pnpm analyze:quality` | Old deprecated |
| `pnpm analysis:types` | `pnpm analyze:types` | Old deprecated |
| `pnpm analysis:console` | `pnpm analyze:console` | Old deprecated |
| `pnpm fix:import-extensions` | `pnpm maintain:fix-imports` | Old deprecated |
| `pnpm fix:import-extensions:dry` | `pnpm maintain:fix-imports --dry-run` | Old deprecated |
| _(no equivalent)_ | `pnpm scripts:audit` | **New** |
| _(no equivalent)_ | `pnpm scripts:validate` | **New** |
| _(no equivalent)_ | `pnpm scripts:fix` | **New** |
| _(no equivalent)_ | `pnpm scripts:health` | **New** |
| _(no equivalent)_ | `pnpm maintain:validate-scripts` | **New** |
| _(no equivalent)_ | `pnpm maintain:audit-scripts` | **New** |
| _(no equivalent)_ | `pnpm maintain:fix-scripts` | **New** |

### New Root Scripts

These are completely new:

```bash
# Script Management
pnpm scripts:audit              # Audit package scripts
pnpm scripts:validate           # Validate against templates
pnpm scripts:fix                # Preview auto-fix
pnpm scripts:fix:apply          # Apply auto-fix
pnpm scripts:health             # Full health check

# Enhanced Maintenance
pnpm maintain                   # Show maintain CLI
pnpm maintain:fix-imports       # Fix import extensions
pnpm maintain:fix-lint          # Auto-fix linting
pnpm maintain:validate-scripts  # Validate scripts
pnpm maintain:audit-scripts     # Audit scripts
pnpm maintain:fix-scripts       # Auto-fix scripts
```

---

## Troubleshooting

### Issue: Validation Fails for My Package

**Symptom:**
```bash
$ pnpm scripts:validate --package @revealui/mypackage
❌ Failed (score: 65/100)
   Missing: clean, test, typecheck
```

**Solution 1: Auto-fix**
```bash
pnpm maintain:fix-scripts --package @revealui/mypackage
```

**Solution 2: Manual fix**
```json
{
  "scripts": {
    "clean": "rm -rf dist",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  }
}
```

### Issue: Build Tool Detection Wrong

**Symptom:** Auto-fix adds wrong build command (e.g., `tsc` instead of `next build`)

**Solution:**
```bash
# Set correct build command first
# In package.json:
{
  "scripts": {
    "build": "next build"  // Correct this first
  }
}

# Then run auto-fix for other scripts
pnpm maintain:fix-scripts --package @revealui/myapp
```

### Issue: Custom Scripts Flagged as Incorrect

**Symptom:** Validation complains about intentional custom scripts

**Solution:** Custom scripts are allowed and not removed by auto-fix. Validation only checks for *missing* required scripts, not incorrect existing ones.

### Issue: Old Commands Not Working

**Symptom:** `pnpm analysis:quality` shows "command not found"

**Solution:** This shouldn't happen - old commands are preserved. If it does:
```bash
# Clean install
pnpm clean:install

# Verify package.json has both old and new commands
cat package.json | grep "analysis:quality"
cat package.json | grep "analyze:quality"
```

### Issue: CI Failing After Migration

**Symptom:** CI pipeline fails with script validation errors

**Solution:**
```bash
# Temporarily disable strict mode
pnpm scripts:validate  # Without --strict

# See what's failing
# Fix issues locally

# Re-enable strict mode in CI
pnpm scripts:validate --strict
```

---

## FAQ

### Q: Do I need to change anything immediately?

**A:** No. All old commands still work. You can migrate at your own pace.

### Q: When will old commands stop working?

**A:** Old commands are scheduled for removal in v3.0 (approximately 6 months from now). You'll see deprecation warnings starting in v2.0 (3 months).

### Q: Can I use templates for existing packages?

**A:** Yes! The auto-fix tool (`pnpm maintain:fix-scripts`) does exactly this. It detects your package type and adds missing scripts based on the appropriate template.

### Q: What if I don't want some standard scripts?

**A:** You don't have to use them all, but having them improves consistency. The validation tool only *recommends* optional scripts - it won't fail your package for missing them.

### Q: How do I know which template to use?

**A:**
- **Library:** TypeScript packages that compile with `tsc` (most packages)
- **App:** Next.js or Vite applications
- **Tool:** CLI tools that bundle with `tsup`

Run `pnpm maintain:fix-scripts` and it will auto-detect for you.

### Q: Will auto-fix break my package?

**A:** No. Auto-fix only *adds* missing scripts. It never removes or modifies existing scripts. Always use `--dry-run` first to preview changes.

### Q: What's the health scoring formula?

**A:**
- Required scripts present: 60 points
- Optional scripts present: 30 points
- Correct implementations: 10 points
- **Total:** 100 points

### Q: Can I customize the templates?

**A:** Templates are standardized for consistency, but you can add package-specific scripts alongside the standard ones.

### Q: What if I find a bug in the new tools?

**A:** Please report it:
- 🐛 [GitHub Issues](https://github.com/RevealUIStudio/revealui/issues)
- 💬 [Discussions](https://github.com/RevealUIStudio/revealui/discussions)
- 📧 [Email](mailto:support@revealui.com)

---

## Best Practices

### ✅ DO

- Use `pnpm scripts:validate` before committing new packages
- Run `pnpm scripts:health` regularly
- Use templates when creating new packages
- Keep scripts standardized
- Review auto-fix changes with `--dry-run` first

### ❌ DON'T

- Manually copy scripts between packages (use templates)
- Skip validation in CI
- Remove standard scripts
- Use non-standard script names
- Ignore validation warnings

---

## Additional Resources

- **[Script Standards](../scripts/STANDARDS.md)** - Complete script standards
- **[CLI Demos](../examples/cli-demos/README.md)** - Interactive tutorials
- **[Scripts Reference](../SCRIPTS.md)** - All commands documented
- **[Contributing Guide](../CONTRIBUTING.md)** - Contribution guidelines

---

## Support

Need help with migration?

- 💬 [GitHub Discussions](https://github.com/RevealUIStudio/revealui/discussions)
- 🐛 [GitHub Issues](https://github.com/RevealUIStudio/revealui/issues)
- 📧 [Email Support](mailto:support@revealui.com)

---

**Migration Guide Version:** 1.0.0
**Last Updated:** Phase 6 - Documentation & Polish
**Maintained By:** RevealUI Team
