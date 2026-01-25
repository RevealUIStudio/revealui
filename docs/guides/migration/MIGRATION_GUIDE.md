# RevealUI Codebase Structure Migration Guide

## Overview

This document outlines the reorganization of the RevealUI codebase structure to improve maintainability, navigation, and developer experience. The reorganization addresses the convoluted structure that evolved organically without clear architectural principles.

## What Changed

### 1. Centralized Configuration (`config/`)

**Before:**
```
config/turbo.json
.vscode-recommended.json
performance.budgets.json
docs-lifecycle.config.json
.changeset/
.cursor/
.github/
.husky/
.mcp/
```

**After:**
```
config/
├── build/          # turbo.json
├── ci/            # .changeset/, .github/
├── ide/           # .vscode-recommended.json, .cursor/, .mcp/
├── hooks/         # .husky/
├── docs/          # docs-lifecycle.config.json
├── performance/   # performance.budgets.json
├── project/       # revealui.config.ts
└── README.md
```

### 2. Simplified Documentation (`docs/`)

**Before:**
```
docs/
├── analyses/
├── plans/
├── implementations/
├── reviews/
├── archives/
├── architecture/
├── automation/
├── development/
└── [10+ other categories]
```

**After:**
```
docs/
├── guides/        # User guides and tutorials
├── reference/     # API documentation
├── development/   # Process docs, analyses, plans, reviews
├── archive/       # Historical documentation (simplified)
└── README.md
```

### 3. Streamlined Scripts (`scripts/`)

**Before:**
```
scripts/
├── audit/         # (renamed to analysis/)
├── [15+ categories]
└── [200+ files scattered]
```

**After:**
```
scripts/
├── build/         # Build and deployment
├── dev/           # Development tools
├── analysis/      # Code analysis and auditing
├── database/      # Database management
├── docs/          # Documentation tools
├── validation/    # Code quality checks
├── utils/         # Shared utilities
└── README.md
```

### 4. Consistent Package Structure (`packages/`)

**Before:**
```
packages/[package]/
├── src/           # (inconsistent)
├── __tests__/     # (inconsistent location)
└── package.json
```

**After:**
```
packages/[package]/
├── src/           # Always present
├── __tests__/     # Consistent location
├── package.json   # Required
└── README.md      # Recommended
```

### 5. Clean Root Directory

**Before:**
```
/
├── [15+ loose files]
├── automation-component-audit.json
├── validation-report.json
├── PERFORMANCE_*.md
└── [other scattered files]
```

**After:**
```
/ (Clean root)
├── apps/          # Applications
├── packages/      # Core packages
├── docs/          # Documentation
├── scripts/       # Build/dev scripts
├── config/        # All configuration
├── examples/      # Example projects
├── infrastructure/# Docker/infra
├── README.md      # Project info
├── LICENSE        # License
└── [Lock files only]
```

## Migration Steps

### Phase 1: Preparation
```bash
# 1. Commit all current changes
git add .
git commit -m "Pre-reorganization state"

# 2. Create backup branch
git checkout -b backup-before-reorganization

# 3. Return to main branch
git checkout main

# 4. Run pre-migration validation
pnpm typecheck:all
pnpm lint
pnpm test
```

### Phase 2: Dry Run
```bash
# Preview reorganization changes
pnpm run reorganize:structure

# Review the output carefully
# Check for any unexpected moves or conflicts
```

### Phase 3: Apply Reorganization
```bash
# Apply the reorganization
pnpm run reorganize:structure:apply
```

### Phase 4: Validation and Fixes
```bash
# Validate the new structure
pnpm run validate:structure

# Fix any import/reference issues
pnpm typecheck:all
pnpm lint
pnpm test
```

### Phase 5: Update References

#### Import Path Updates

**Before:**
```typescript
import config from "@revealui/config";
// If config moved to packages/config/
import config from "../../../packages/config/src/index.js";
```

**After:**
```typescript
// Update import paths to new config location
import config from "../../packages/config/src/index.js";
```

#### Script Reference Updates

**Before:**
```json
{
  "scripts": {
    "audit:docs": "tsx scripts/audit-docs.ts"
  }
}
```

**After:**
```json
{
  "scripts": {
    "audit:docs": "tsx scripts/docs/verify-claims.ts"
  }
}
```

#### Documentation Links

**Before:**
```
[Analysis](../docs/analyses/2024-01-27-analysis.md)
```

**After:**
```
[Analysis](../docs/development/analyses/2024-01-27-analysis.md)
```

## Updated Development Workflow

### File Organization Standards

#### Analysis Files
- **Location:** `docs/development/analyses/`
- **Naming:** `{date}-{project}-{type}-analysis.md`
- **Example:** `2024-01-27-codebase-structure-analysis.md`

#### Plan Files
- **Location:** `docs/development/plans/`
- **Naming:** `{date}-{project}-plan-{status}.md`
- **Example:** `2024-01-27-codebase-structure-plan-approved.md`

#### Implementation Files
- **Location:** `docs/development/implementations/`
- **Naming:** `{date}-{project}-implementation.md`
- **Example:** `2024-01-27-codebase-structure-implementation.md`

### Script Organization

#### Running Scripts
```bash
# Before
pnpm run audit:docs

# After (updated paths)
pnpm run audit:docs  # Script moved to scripts/docs/
```

#### Adding New Scripts
```bash
# Place in appropriate category
scripts/analysis/new-audit.ts
scripts/docs/new-tool.ts
scripts/validation/new-check.ts
```

## Troubleshooting

### Common Issues

#### 1. Import Errors After Reorganization
```bash
# Find broken imports
pnpm typecheck:all

# Fix import paths to new locations
# config/ → ../../packages/config/src/
# scripts/audit/ → ../../scripts/analysis/
```

#### 2. Script Not Found
```bash
# Check new script location
ls scripts/analysis/  # Was scripts/audit/
ls scripts/docs/      # Was scripts/

# Update package.json scripts section
```

#### 3. Documentation Links Broken
```bash
# Update relative links
# ../docs/analyses/ → ../docs/development/analyses/
# ../docs/archives/ → ../docs/archive/
```

#### 4. Tool Configuration Not Found
```bash
# Check new config locations
ls config/ide/        # .cursor/, .vscode/
ls config/ci/         # .github/, .changeset/
ls config/hooks/      # .husky/
```

### Validation Commands

```bash
# Structure validation
pnpm run validate:structure

# Code validation
pnpm typecheck:all
pnpm lint
pnpm test

# Full validation
pnpm run validate:structure && pnpm typecheck:all && pnpm lint && pnpm test
```

## Benefits of New Structure

### 1. Improved Navigation
- **Centralized Config:** All configuration in one place
- **Logical Grouping:** Related files grouped by purpose
- **Clear Categories:** Obvious where to find things

### 2. Consistency
- **Package Structure:** Uniform across all packages
- **Naming Patterns:** Consistent file naming
- **Organization:** Predictable directory structure

### 3. Maintainability
- **Reduced Scatter:** Fewer loose files
- **Clear Ownership:** Each directory has a purpose
- **Easier Cleanup:** Obsolete files easier to identify

### 4. Developer Experience
- **Faster Onboarding:** Clear structure for new developers
- **Reduced Cognitive Load:** Less time spent finding files
- **Better Tooling:** IDEs can better understand structure

## Rollback Plan

If issues arise, rollback is straightforward:

```bash
# Revert to backup branch
git checkout backup-before-reorganization
git branch -D main
git checkout -b main

# Or selective revert
git revert <reorganization-commit>
```

## Questions?

- Check `docs/README.md` for documentation navigation
- See `config/README.md` for configuration structure
- Run `scripts/README.md` for script organization

## Success Criteria

✅ **Migration Complete When:**
- `pnpm run validate:structure` passes
- `pnpm typecheck:all` passes with no import errors
- `pnpm lint` passes
- `pnpm test` passes
- All documentation links work
- All scripts execute from new locations
- Team can navigate structure intuitively