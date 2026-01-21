# Documentation Scripts Consolidation Plan

## Current State: 22 Scripts → Target: 5 Scripts

### Phase 1: Analysis (Week 1)
**Scripts to keep as-is:**
- `docs-lifecycle.ts` - Core lifecycle management ✅
- `generate-api-docs.ts` - API documentation generation ✅
- `verify-docs.ts` - Documentation verification ✅

**Scripts to merge into comprehensive tools:**
- `validate-all.ts` - Merge: validate-jsdoc, validate-references, validate-documentation-accuracy
- `manage-content.ts` - Merge: detect-duplicates, detect-stale-docs, review-archive, organize-docs, consolidate-root-docs
- `generate-content.ts` - Merge: generate-package-readme, build-docs-site, api-doc-extractor, api-doc-template

**Scripts to remove:**
- `maintenance-check.ts` - Redundant with lifecycle
- `merge-docs.ts` - Too specialized
- `run-lifecycle.ts` - Duplicate functionality
- `manage-assessments.ts` - Too narrow

### Phase 2: Implementation (Week 2-3)
1. Create unified CLI interface with subcommands
2. Implement comprehensive validation suite
3. Build content management tools
4. Add generation pipeline

### Phase 3: Migration (Week 4)
1. Update package.json scripts
2. Update CI/CD workflows
3. Update documentation
4. Remove old scripts

## Result: 5 Powerful, Maintainable Scripts

```bash
# Instead of 22 individual scripts:
pnpm docs:validate all
pnpm docs:manage check-duplicates
pnpm docs:generate api
```