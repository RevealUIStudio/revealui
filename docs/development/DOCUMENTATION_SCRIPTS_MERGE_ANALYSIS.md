# Documentation Scripts Merge Analysis

**Date**: January 2025

Analysis of which documentation scripts should be merged into comprehensive scripts for better maintainability and usability.

## Executive Summary

**Recommended Merges:**
1. ✅ **All `verify-*.ts` scripts** → Single `verify-docs.ts` script
2. ✅ **`detect-duplicates.ts` + `merge-docs.ts`** → Integrate into `organize-docs.ts`
3. ⚠️ **`validate-jsdoc.ts` + `validate-all.ts`** → Keep separate (different purposes)

## Detailed Analysis

### 1. Verification Scripts (HIGH PRIORITY MERGE)

**Current State:**
- `verify-links.ts` (370 lines)
- `verify-versions.ts` (406 lines)
- `verify-commands.ts` (320 lines)
- `verify-paths.ts` (~300 lines estimated)
- `verify-code-examples.ts` (~300 lines estimated)
- `verify-consolidation.ts` (~200 lines estimated)

**Total**: ~1,896 lines across 6 files

**Why Merge:**
- ✅ **Identical Structure**: All follow the same pattern:
  - Extract data from markdown files
  - Verify against source of truth
  - Generate report
  - Similar error handling
- ✅ **Shared Dependencies**: All use same utilities (logger, getProjectRoot, fg)
- ✅ **Already Orchestrated**: `validate-all.ts` already calls them all
- ✅ **Maintenance Burden**: Changes to one often require changes to others
- ✅ **Code Duplication**: Similar file reading, parsing, and reporting logic

**Proposed Structure:**
```typescript
// scripts/docs/verify-docs.ts
interface VerificationModule {
  name: string
  description: string
  verify: (files: string[]) => Promise<VerificationResult>
}

const VERIFICATION_MODULES: VerificationModule[] = [
  { name: 'links', verify: verifyLinks },
  { name: 'versions', verify: verifyVersions },
  { name: 'commands', verify: verifyCommands },
  { name: 'paths', verify: verifyPaths },
  { name: 'code-examples', verify: verifyCodeExamples },
  { name: 'consolidation', verify: verifyConsolidation },
]

// Usage:
// pnpm docs:verify --all
// pnpm docs:verify --links
// pnpm docs:verify --versions --commands
```

**Benefits:**
- Single entry point for all verification
- Shared utilities and helpers
- Consistent reporting format
- Easier to add new verification types
- Reduced code duplication (~30-40% reduction)

**Estimated Reduction**: ~1,896 lines → ~1,200 lines (37% reduction)

---

### 2. Organization Utilities (MEDIUM PRIORITY MERGE)

**Current State:**
- `organize-docs.ts` (309 lines) - Main organization script
- `detect-duplicates.ts` (222 lines) - Finds duplicates
- `merge-docs.ts` (183 lines) - Merges files

**Total**: ~714 lines across 3 files

**Why Merge:**
- ✅ **Related Functionality**: All deal with organizing/reorganizing docs
- ✅ **Workflow Integration**: Detect → Merge → Organize is a common workflow
- ✅ **Shared Logic**: All work with markdown files and directory structure

**Proposed Structure:**
```typescript
// scripts/docs/organize-docs.ts (enhanced)
// Add subcommands:
// - organize (existing)
// - detect-duplicates (new)
// - merge (new)

// Usage:
// pnpm docs:organize --detect-duplicates
// pnpm docs:organize --merge <target> <sources...>
// pnpm docs:organize (existing behavior)
```

**Benefits:**
- Unified organization workflow
- Can chain operations: detect → merge → organize
- Shared file utilities

**Estimated Reduction**: ~714 lines → ~600 lines (16% reduction)

---

### 3. Validation Scripts (LOW PRIORITY - KEEP SEPARATE)

**Current State:**
- `validate-jsdoc.ts` (~400 lines) - JSDoc-specific validation
- `validate-all.ts` (101 lines) - Orchestrator

**Why Keep Separate:**
- ⚠️ **Different Purpose**: JSDoc validation is code-focused, not doc-focused
- ⚠️ **Different Dependencies**: Uses TypeScript compiler API
- ⚠️ **Different Output**: Generates coverage reports, not just pass/fail
- ✅ **Already Orchestrated**: `validate-all.ts` already calls it

**Recommendation**: Keep separate but improve `validate-all.ts` to be more comprehensive.

---

### 4. Generation Scripts (KEEP SEPARATE)

**Current State:**
- `generate-api-docs.ts` - API documentation
- `generate-package-readme.ts` - Package READMEs
- `build-docs-site.ts` - Website build

**Why Keep Separate:**
- ✅ **Different Outputs**: Different file types and destinations
- ✅ **Different Dependencies**: API docs use TS compiler, READMEs use file system, site uses Vite
- ✅ **Already Orchestrated**: `docs:generate:all` already runs them all
- ✅ **Independent Use Cases**: Often need to run individually

**Recommendation**: Keep separate. Current orchestration via `docs:generate:all` is sufficient.

---

## Merge Recommendations

### Priority 1: Merge All Verification Scripts ⭐⭐⭐

**Action**: Merge all `verify-*.ts` scripts into `verify-docs.ts`

**Impact:**
- **Code Reduction**: ~37% (1,896 → 1,200 lines)
- **Maintainability**: Single file to update for verification logic
- **Consistency**: Unified reporting and error handling
- **Usability**: Single command with flags instead of 6 separate commands

**Implementation:**
1. Create `verify-docs.ts` with modular verification functions
2. Move each verification into a module/function
3. Add CLI argument parsing for selective verification
4. Update `package.json` commands:
   - `docs:verify` → `verify-docs.ts --all`
   - `docs:verify:links` → `verify-docs.ts --links`
   - etc.

**Breaking Changes**: None (can maintain backward compatibility via package.json)

---

### Priority 2: Integrate Organization Utilities ⭐⭐

**Action**: Integrate `detect-duplicates.ts` and `merge-docs.ts` into `organize-docs.ts`

**Impact:**
- **Code Reduction**: ~16% (714 → 600 lines)
- **Workflow**: Can chain operations together
- **Usability**: Single command for all organization tasks

**Implementation:**
1. Add `--detect-duplicates` flag to `organize-docs.ts`
2. Add `--merge` flag to `organize-docs.ts`
3. Keep existing behavior as default
4. Update documentation

**Breaking Changes**: None (additive changes)

---

### Priority 3: Enhance validate-all.ts ⭐

**Action**: Improve `validate-all.ts` to be more comprehensive

**Impact:**
- **Usability**: Better reporting and error handling
- **Coverage**: Include all validation types

**Implementation:**
1. Add more detailed reporting
2. Add exit codes for CI/CD
3. Add JSON output option
4. Include verification results in summary

**Breaking Changes**: None

---

## Proposed New Structure

### After Merges

```
scripts/docs/
├── verify-docs.ts          # All verification (merged from 6 files)
├── organize-docs.ts        # Organization + duplicates + merge (enhanced)
├── validate-jsdoc.ts      # Keep separate (code-focused)
├── validate-all.ts         # Enhanced orchestrator
├── generate-api-docs.ts    # Keep separate
├── generate-package-readme.ts  # Keep separate
├── build-docs-site.ts      # Keep separate
├── docs-lifecycle.ts       # Keep separate (different purpose)
├── maintenance-check.ts    # Keep separate (different purpose)
└── api-doc-*.ts           # Keep separate (utilities)
```

### New Commands

```json
{
  "docs:verify": "tsx scripts/docs/verify-docs.ts --all",
  "docs:verify:links": "tsx scripts/docs/verify-docs.ts --links",
  "docs:verify:versions": "tsx scripts/docs/verify-docs.ts --versions",
  "docs:verify:commands": "tsx scripts/docs/verify-docs.ts --commands",
  "docs:verify:paths": "tsx scripts/docs/verify-docs.ts --paths",
  "docs:verify:code-examples": "tsx scripts/docs/verify-docs.ts --code-examples",
  "docs:verify:consolidation": "tsx scripts/docs/verify-docs.ts --consolidation",
  "docs:organize": "tsx scripts/docs/organize-docs.ts",
  "docs:organize:detect-duplicates": "tsx scripts/docs/organize-docs.ts --detect-duplicates",
  "docs:organize:merge": "tsx scripts/docs/organize-docs.ts --merge"
}
```

---

## Code Reduction Summary

| Category | Before | After | Reduction |
|----------|--------|-------|-----------|
| Verification Scripts | 1,896 lines | ~1,200 lines | 37% |
| Organization Scripts | 714 lines | ~600 lines | 16% |
| **Total** | **2,610 lines** | **~1,800 lines** | **31%** |

---

## Implementation Plan

### Phase 1: Merge Verification Scripts (Week 1)
1. Create `verify-docs.ts` with modular structure
2. Migrate each verification function
3. Add CLI argument parsing
4. Update package.json commands
5. Test all verification types
6. Update documentation

### Phase 2: Integrate Organization Utilities (Week 2)
1. Add duplicate detection to `organize-docs.ts`
2. Add merge functionality to `organize-docs.ts`
3. Update CLI arguments
4. Test workflows
5. Update documentation

### Phase 3: Enhance validate-all.ts (Week 3)
1. Improve reporting
2. Add JSON output
3. Better error handling
4. CI/CD integration

---

## Risks & Mitigation

### Risk 1: Breaking Changes
**Mitigation**: Maintain backward compatibility via package.json commands

### Risk 2: Increased Complexity
**Mitigation**: Use modular structure, clear separation of concerns

### Risk 3: Testing Overhead
**Mitigation**: Comprehensive test suite before merge

---

## Conclusion

**Recommended Actions:**
1. ✅ **Merge all verification scripts** (High impact, low risk)
2. ✅ **Integrate organization utilities** (Medium impact, low risk)
3. ⚠️ **Keep validation/generation separate** (Different purposes)

**Expected Benefits:**
- 31% code reduction
- Better maintainability
- Improved usability
- Consistent patterns
- Easier to extend

**Estimated Effort:**
- Verification merge: 2-3 days
- Organization integration: 1-2 days
- Testing & documentation: 1 day
- **Total: 4-6 days**
