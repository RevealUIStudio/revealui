# Documentation Management Strategy

**Last Updated**: January 11, 2026  
**Status**: Proposed Strategy

---

## Core Principle

**Documentation should be managed by correctness, not age.**

- ✅ **Keep** correct documentation (regardless of age)
- ✅ **Delete** incorrect/outdated documentation (via validation)
- ✅ **Organize** future plans in dedicated directory

---

## Problem with Age-Based Cleanup

The current archive cleanup script (`scripts/deployment/cleanup-archive.ts`) is **too simplistic**:

- ❌ Deletes files based on age (wrong approach)
- ❌ No distinction between correct vs incorrect docs
- ❌ No consideration for documentation value
- ❌ May delete valuable historical documentation

---

## Recommended Approach

### 1. Use Existing Documentation Lifecycle System

**Tool**: `scripts/docs-lifecycle.ts`  
**Command**: `pnpm docs:check` / `pnpm docs:archive`

The existing system validates documentation by:
- Package names (outdated references)
- File references (broken links)
- Code snippets (outdated examples)
- Dates (stale content)
- Status (incomplete documentation)
- TODOs (documentation needing updates)

**This is the right approach** - it identifies **incorrect** documentation, not just old documentation.

### 2. Organize Future Plans

**Location**: `docs/roadmap/` (new directory)

Create a dedicated directory for:
- Future feature plans
- Upcoming improvements
- Long-term goals
- Experimental ideas

This keeps future planning organized without cluttering active documentation.

### 3. Archive Strategy

**Active Documentation**: `docs/` (root)
- Current, correct documentation
- Active guides and references
- Keep regardless of age if correct

**Roadmap Documentation**: `docs/roadmap/`
- Future plans
- Upcoming features
- Experimental ideas

**Historical Documentation**: `docs/archive/`
- Historical assessments: `docs/archive/assessments/`
- Historical migrations: `docs/archive/migrations/`
- Completed/obsolete documentation (correct but no longer relevant)

**Incorrect Documentation**: Delete
- Validated as incorrect by `docs-lifecycle.ts`
- Outdated references
- Broken examples
- Stale content

---

## Implementation

### Step 1: Disable Age-Based Cleanup

The `cleanup-archive.ts` script should be:
- ❌ **Disabled** for automatic cleanup (too simplistic)
- ✅ **Kept** as manual utility (if needed for specific cases)
- ✅ **Replaced** with validation-based cleanup

### Step 2: Use Validation-Based Cleanup

Use the existing docs lifecycle system:

```bash
# Check for stale/incorrect documentation
pnpm docs:check

# Archive stale files (validates correctness first)
pnpm docs:archive
```

This only archives documentation that's **actually incorrect**, not just old.

### Step 3: Create Roadmap Directory

```bash
mkdir -p docs/roadmap
cat > docs/roadmap/README.md << 'EOF'
# Roadmap & Future Plans

This directory contains documentation about future plans, upcoming features, and experimental ideas.

## Structure

- `*.md` - Future feature plans
- `experimental/` - Experimental ideas
- `backlog/` - Long-term goals

**Note**: Documentation in this directory represents future work, not current functionality.
EOF
```

### Step 4: Update Documentation Index

Add roadmap section to `docs/README.md`:

```markdown
## Roadmap & Planning

- **[Roadmap Directory](./roadmap/)** - Future plans and upcoming features
```

---

## Examples

### Keep This (Correct, regardless of age)
- `docs/DRIZZLE-GUIDE.md` - Correct database guide (even if from 2024)
- `docs/DEPLOYMENT-RUNBOOK.md` - Correct deployment guide
- `docs/KNOWN-LIMITATIONS.md` - Accurate limitations (valuable reference)

### Move to Roadmap (Future plans)
- "Planned feature: Multi-tenant improvements"
- "Upcoming: Advanced caching system"
- "Experimental: GraphQL API"

### Archive (Obsolete but historically valuable)
- `docs/archive/migrations/GRADE-A-CRDT-PLAN.md` - Completed migration plan
- `docs/archive/assessments/BRUTAL_ASSESSMENT_2025.md` - Historical assessment

### Delete (Incorrect/outdated)
- Documentation with broken code examples
- References to deleted packages
- Outdated API documentation
- Stale configuration guides

---

## Workflow

1. **Regular Validation**:
   ```bash
   pnpm docs:check  # Identify incorrect documentation
   ```

2. **Review & Fix**:
   - Fix incorrect documentation (if still relevant)
   - Move to roadmap (if future plan)
   - Archive (if historically valuable but obsolete)
   - Delete (if incorrect and not valuable)

3. **Archive Incorrect Docs**:
   ```bash
   pnpm docs:archive  # Archives validated incorrect docs
   ```

---

## Benefits

✅ **Preserves correct documentation** (regardless of age)  
✅ **Identifies incorrect documentation** (via validation)  
✅ **Organizes future plans** (dedicated roadmap directory)  
✅ **Uses existing tools** (docs-lifecycle system)  
✅ **Value-based management** (not age-based)  

---

## Action Items

- [ ] Disable automatic archive cleanup (or make it validation-based)
- [ ] Create `docs/roadmap/` directory
- [ ] Run `pnpm docs:check` to identify incorrect documentation
- [ ] Update `docs/README.md` to include roadmap section
- [ ] Document this strategy in project docs

---

**Recommendation**: Replace age-based cleanup with validation-based cleanup using the existing `docs-lifecycle.ts` system.
