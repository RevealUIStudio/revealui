# Root-Level Documentation Policy

This document defines the policy for which documentation files should be kept at the project root versus moved to the `docs/` directory.

## Essential Root Files

The following files **must** remain at the project root:

- `README.md` - Project overview and quick start guide
- `CHANGELOG.md` - Version history and release notes
- `CONTRIBUTING.md` - Contribution guidelines
- `LICENSE.md` - License information

These files are essential for:
- GitHub repository display
- Package registry display (npm, etc.)
- Developer onboarding
- Legal compliance

## Files That Should Be Moved

### Assessment Files
Files containing assessments, evaluations, or analysis should be moved to `docs/archive/assessments/`:
- `BRUTAL_*_ASSESSMENT.md`
- `AGENT_WORK_ASSESSMENT.md`
- `TYPE_SYSTEM_*.md`
- Any file with "ASSESSMENT" in the name

### Status Files
Files containing status updates, completion reports, or fix summaries should be moved to `docs/archive/status/`:
- `*_COMPLETE.md`
- `*_FIXES_*.md`
- `*_STATUS.md`
- `*_VERIFICATION_*.md`
- Any file documenting a completed task or fix

### Documentation Files
All other documentation should be organized in the `docs/` directory:
- User guides → `docs/guides/`
- Reference docs → `docs/reference/`
- Developer docs → `docs/development/`
- API docs → `docs/api/` (auto-generated)

## Rationale

### Why Keep Some Files at Root?

1. **Visibility**: Root-level files are immediately visible when viewing the repository
2. **Conventions**: Industry standard to have README, CHANGELOG, CONTRIBUTING, LICENSE at root
3. **Tooling**: Many tools (GitHub, npm, etc.) expect these files at root

### Why Move Other Files?

1. **Organization**: Keeps root directory clean and focused
2. **Discoverability**: Organized structure makes it easier to find documentation
3. **Maintenance**: Easier to maintain and update when organized
4. **Archive**: Status and assessment files are historical and belong in archive

## Enforcement

Use the consolidation script to enforce this policy:

```bash
# Check what would be moved (dry run)
pnpm docs:consolidate --dry-run

# Actually move files
pnpm docs:consolidate
```

## Exceptions

In rare cases, exceptions may be made for:
- Files that are actively referenced in CI/CD workflows
- Files that are part of the build process
- Files that are required by external tools

Exceptions should be documented in this file.

## See Also

- [Documentation Structure](./STRUCTURE.md) - Overall documentation structure
- [Documentation Tools](./DOCUMENTATION-TOOLS.md) - Documentation management tools
# Root Markdown File Policy

**Last Updated**: January 11, 2026  
**Status**: Active Policy

---

## Policy

**Only predetermined .md files are allowed in the project root. All other .md files must be in `docs/` subfolder.**

---

## Allowed Root Files

The following markdown files (and their variants) are allowed in the project root:

1. **README.md** - Project overview and getting started
2. **AGENT.md** - Agent handoff, instructions, or agent-related documentation (exact match only)
3. **INFRASTRUCTURE.md** / **ARCHITECTURE.md** - Infrastructure or architecture documentation
4. **SKILLS.md** - Skills, capabilities, or competency documentation
5. **SECURITY.md** - Security policy and vulnerability reporting (GitHub recognizes)
6. **CONTRIBUTING.md** - Contribution guidelines (GitHub recognizes)
7. **CODE_OF_CONDUCT.md** - Code of conduct and community guidelines (GitHub recognizes)
8. **CHANGELOG.md** - Version history and release notes

**Allowed Files** (exact matches, case-insensitive):
- `README.md` - Project overview
- `AGENT.md` - Agent documentation (exact match only)
- `INFRASTRUCTURE.md` - Infrastructure documentation
- `ARCHITECTURE.md` - Architecture documentation
- `SKILLS.md` - Skills documentation
- `SECURITY.md` - Security policy (GitHub displays in Security tab)
- `CONTRIBUTING.md` - Contribution guidelines (GitHub links in PR/Issue creation)
- `CODE_OF_CONDUCT.md` - Code of conduct (GitHub displays in Community tab)
- `CHANGELOG.md` - Version history (common in root)

---

## All Other Files

All other markdown files **must** be in `docs/` or an appropriate subfolder:

- `docs/` - Main documentation directory
- `docs/roadmap/` - Future plans
- `docs/archive/` - Historical documentation
- `docs/root/` - Files moved from root (temporary location)

---

## Validation

Run validation to check for violations:

```bash
# Check for violations
pnpm validate:root-markdown

# Automatically move violations to docs/root/
pnpm validate:root-markdown --fix
```

---

## Examples

### ✅ Allowed in Root

```
README.md
AGENT.md
AGENT_HANDOFF.md
INFRASTRUCTURE.md
ARCHITECTURE.md
SKILLS.md
```

### ❌ Must Be in docs/

```
CONTRIBUTING.md          -> docs/CONTRIBUTING.md
CHANGELOG.md             -> docs/CHANGELOG.md
SECURITY.md              -> docs/SECURITY.md
DEVELOPER_EXPERIENCE_COHESION_ANALYSIS.md  -> docs/DEVELOPER_EXPERIENCE_COHESION_ANALYSIS.md
PROMPT_FOR_NEXT_AGENT.md -> docs/PROMPT_FOR_NEXT_AGENT.md
```

---

## Rationale

1. **Clean Root Directory**: Keeps project root uncluttered
2. **Better Organization**: Documentation is organized in dedicated folders
3. **Easy Navigation**: Clear distinction between root files and documentation
4. **Consistent Structure**: Enforces consistent project structure
5. **Easy to Validate**: Can automatically check and enforce policy

---

## Migration

When migrating existing files:

1. **Run validation**:
   ```bash
   pnpm validate:root-markdown
   ```

2. **Review violations**:
   - Identify which files need to be moved
   - Decide on appropriate `docs/` subfolder

3. **Move files**:
   ```bash
   # Automatic (moves to docs/root/)
   pnpm validate:root-markdown --fix
   
   # Or manually move to appropriate location
   mv CONTRIBUTING.md docs/CONTRIBUTING.md
   ```

4. **Update references**:
   - Update links in documentation
   - Update references in code
   - Update README.md if needed

---

## CI/CD Integration

Add to CI/CD pipeline to enforce policy:

```yaml
- name: Validate Root Markdown Files
  run: pnpm validate:root-markdown
```

---

## Future Considerations

- **Expand allowed files**: If needed, add more patterns to `ALLOWED_PATTERNS`
- **Custom subfolders**: Files could be moved to specific subfolders based on content
- **Automatic categorization**: Could analyze content to suggest appropriate subfolder

---

**Status**: ✅ Policy Active  
**Validation Script**: `scripts/validation/validate-root-markdown.ts`  
**Command**: `pnpm validate:root-markdown`

---
## Documentation Management Strategy

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
- `docs/DRIZZLE_GUIDE.md` - Correct database guide (even if from 2024)
- `docs/DEPLOYMENT-RUNBOOK.md` - Correct deployment guide
- `docs/KNOWN-LIMITATIONS.md` - Accurate limitations (valuable reference)

### Move to Roadmap (Future plans)
- "Planned feature: Multi-tenant improvements"
- "Upcoming: Advanced caching system"

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
