# Documentation Workflow Guide

**Quick Reference for Documentation Lifecycle Management**
**Updated**: 2026-02-02

---

## Quick Start

### Using the Workflow System

```bash
# Start a new documentation workflow
pnpm workflow:run documentation-lifecycle "Your Documentation Title"

# The workflow will guide you through 4 phases:
# 1. Planning (approval required)
# 2. Creation (approval required)
# 3. Implementation (approval required)
# 4. Reset (approval required)
```

### Using Individual Commands

```bash
# Validate all documentation
tsx scripts/workflows/manage-docs.ts validate

# Organize documentation structure
tsx scripts/workflows/manage-docs.ts organize

# Archive old files (>90 days)
tsx scripts/workflows/manage-docs.ts archive

# Manual workflow steps
tsx scripts/workflows/manage-docs.ts plan "My New Doc"
tsx scripts/workflows/manage-docs.ts create "My New Doc"
tsx scripts/workflows/manage-docs.ts implement "My New Doc"
tsx scripts/workflows/manage-docs.ts reset
```

---

## Documentation Structure

```
docs/
├── .drafts/              # Work in progress (not published)
├── api/                  # API documentation
├── guides/               # User guides and tutorials
├── development/          # Development documentation
├── testing/              # Testing documentation
├── deployment/           # Deployment documentation
├── architecture/         # Architecture documentation
├── archive/              # Archived documentation
│   └── phase-history/    # Historical phase files
└── PRODUCTION_READINESS.md  # Production status document
```

---

## Workflow Phases

### Phase 1: Planning (30 min timeout)

**Purpose**: Design documentation structure and content outline

**What Happens**:
1. Create planning document in `docs/.drafts/`
2. Template includes:
   - Objective
   - Scope (in/out)
   - Target audience
   - Document structure
   - Content outline
   - Success criteria
   - Review checklist

**Your Action**:
- Edit `docs/.drafts/{topic}-plan.md`
- Fill out all sections
- Approve to continue

**Example**:
```bash
tsx scripts/workflows/manage-docs.ts plan "API Authentication Guide"
# Edit: docs/.drafts/api-authentication-guide-plan.md
```

---

### Phase 2: Creation (1 hour timeout)

**Purpose**: Write documentation content using templates

**What Happens**:
1. Check for planning document
2. Create draft in `docs/.drafts/`
3. Run validation automatically
4. Template includes:
   - Overview
   - Prerequisites
   - Content sections
   - Examples
   - Best practices
   - Common issues
   - Related docs

**Your Action**:
- Edit `docs/.drafts/{topic}.md`
- Write actual content
- Approve to continue

**Example**:
```bash
tsx scripts/workflows/manage-docs.ts create "API Authentication Guide"
# Edit: docs/.drafts/api-authentication-guide.md
```

---

### Phase 3: Implementation (15 min timeout)

**Purpose**: Move documentation to final location

**What Happens**:
1. Analyze content to determine target directory
2. Move draft to appropriate location
3. Archive planning document
4. Run final validation
5. Prompt for CHANGELOG update

**Smart Routing**:
- Contains "api" or "endpoint" → `docs/api/`
- Contains "guide" or "tutorial" → `docs/guides/`
- Contains "test" or "testing" → `docs/testing/`
- Contains "deploy" or "deployment" → `docs/deployment/`
- Contains "architecture" or "design" → `docs/architecture/`
- Contains "develop" → `docs/development/`
- Default → `docs/`

**Your Action**:
- Review final location
- Update CHANGELOG.md if needed
- Approve to continue

**Example**:
```bash
tsx scripts/workflows/manage-docs.ts implement "API Authentication Guide"
# Moves to: docs/guides/api-authentication-guide.md (smart routing detected "guide")
```

---

### Phase 4: Reset (15 min timeout)

**Purpose**: Archive stale docs and cleanup

**What Happens**:
1. Archive files older than 90 days
2. Check for remaining drafts
3. Run final validation
4. Prompt for CHANGELOG update

**Your Action**:
- Review archived files
- Update CHANGELOG.md if needed
- Approve to complete

**Example**:
```bash
tsx scripts/workflows/manage-docs.ts reset
# Archives files >90 days old to docs/archive/
```

---

## Management Commands

### validate

**Purpose**: Run comprehensive documentation validation

**Usage**:
```bash
tsx scripts/workflows/manage-docs.ts validate
```

**Checks**:
- Documentation structure
- Broken links
- Missing files
- Broken symlinks

**Notes**:
- Uses comprehensive validator if available
- Falls back to basic validation
- Non-blocking (informational)

---

### organize

**Purpose**: Create standard folder structure

**Usage**:
```bash
tsx scripts/workflows/manage-docs.ts organize
```

**Creates**:
- `docs/api/`
- `docs/guides/`
- `docs/deployment/`
- `docs/architecture/`
- `docs/.drafts/`
- `.gitkeep` files in empty directories

**Notes**:
- Safe to run multiple times
- Does not move existing files
- Only creates missing directories

---

### archive

**Purpose**: Move old files to archive

**Usage**:
```bash
# Default: 90 days
tsx scripts/workflows/manage-docs.ts archive

# Custom age threshold
tsx scripts/workflows/manage-docs.ts archive --days 60
```

**Behavior**:
- Moves files older than threshold
- Preserves directory structure
- Skips `docs/archive/` and `docs/.drafts/`
- Creates parent directories as needed

**Safety**:
- Copy operation, not deletion
- Git history preserved
- Reversible with `git mv`

---

## Common Workflows

### Creating New Documentation

```bash
# 1. Start workflow
pnpm workflow:run documentation-lifecycle "Feature X Guide"

# 2. Planning phase
# Edit: docs/.drafts/feature-x-guide-plan.md
# Approve when ready

# 3. Creation phase
# Edit: docs/.drafts/feature-x-guide.md
# Write content
# Approve when ready

# 4. Implementation phase
# Review: Final location (auto-determined)
# Update CHANGELOG.md
# Approve to publish

# 5. Reset phase
# Approve to complete

# Done! Document is now published
```

### Updating Existing Documentation

```bash
# 1. Copy to drafts
cp docs/guides/existing-guide.md docs/.drafts/

# 2. Edit in drafts
# Edit: docs/.drafts/existing-guide.md

# 3. Run validation
tsx scripts/workflows/manage-docs.ts validate

# 4. Move back when ready
mv docs/.drafts/existing-guide.md docs/guides/

# 5. Update CHANGELOG.md
```

### Archiving Old Documentation

```bash
# Archive files older than 90 days
tsx scripts/workflows/manage-docs.ts archive

# Or custom threshold
tsx scripts/workflows/manage-docs.ts archive --days 120
```

### Reorganizing Documentation

```bash
# Create standard structure
tsx scripts/workflows/manage-docs.ts organize

# Manually move files to appropriate directories
# Based on content and purpose
```

---

## Approval Process

### What Requires Approval

All 4 workflow phases require human approval:
1. Planning
2. Creation
3. Implementation
4. Reset

### How to Approve

**Via CLI** (when prompted):
- Type `approve` or `yes` to approve
- Type `reject` or `no` to reject
- Type `pause` to pause workflow

**Via Approval File** (if workflow paused):
1. Edit `approval-{token}.txt`
2. Change response to approve/reject
3. Resume workflow

### Approval Expiration

- Approvals expire after 24 hours
- Expired approvals require manual resumption
- Workflow state persists (can resume later)

---

## Tips & Best Practices

### Planning Phase

- ✅ Be specific about scope
- ✅ Define target audience clearly
- ✅ Include success criteria
- ✅ List related documentation

### Creation Phase

- ✅ Follow template structure
- ✅ Include practical examples
- ✅ Add links to related docs
- ✅ Use clear, concise language
- ✅ Test all code examples

### Implementation Phase

- ✅ Review smart routing decision
- ✅ Check final file location
- ✅ Update CHANGELOG.md
- ✅ Verify links work

### Reset Phase

- ✅ Review archived files list
- ✅ Check for remaining drafts
- ✅ Update documentation index
- ✅ Document archival in CHANGELOG

### General Tips

- ✅ Keep drafts in `.drafts/` until ready
- ✅ Run validation frequently
- ✅ Use descriptive filenames
- ✅ Follow existing patterns
- ✅ Archive regularly (quarterly)

---

## Troubleshooting

### Workflow won't start

**Problem**: Prerequisites not met

**Solution**:
```bash
# Validate prerequisites
tsx scripts/workflows/doc-lifecycle-workflow.ts validate

# Create missing directories
tsx scripts/workflows/doc-lifecycle-workflow.ts setup
```

### Draft not found

**Problem**: Plan phase not completed

**Solution**:
```bash
# Run plan phase first
tsx scripts/workflows/manage-docs.ts plan "Your Topic"
```

### Wrong directory

**Problem**: Smart routing chose wrong location

**Solution**:
```bash
# Manually move file after implementation
mv docs/wrong-dir/file.md docs/correct-dir/

# Or edit content to match target directory keywords
```

### Validation fails

**Problem**: Broken links or missing files

**Solution**:
1. Fix broken links
2. Add missing files
3. Run validation again
4. Approve when passes

### Workflow paused unexpectedly

**Problem**: Approval timeout or system restart

**Solution**:
```bash
# List running workflows
pnpm workflow:list

# Resume workflow
pnpm workflow:resume <workflow-id>
```

---

## Getting Help

### Documentation

- **Full Guide**: `DOCUMENTATION_CONSOLIDATION_PHASE_2_COMPLETE.md`
- **Phase 1 Summary**: `DOCUMENTATION_CONSOLIDATION_PHASE_1_COMPLETE.md`
- **Quick Start**: `DOCUMENTATION_QUICK_START.md`
- **Production Status**: `docs/PRODUCTION_READINESS.md`

### Commands

```bash
# Workflow help
tsx scripts/workflows/doc-lifecycle-workflow.ts --help

# Management commands help
tsx scripts/workflows/manage-docs.ts --help

# List workflow templates
pnpm workflow:list

# Show workflow steps
tsx scripts/workflows/doc-lifecycle-workflow.ts steps
```

### Common Questions

**Q: Can I skip phases?**
A: No, phases must be completed in order (dependencies enforced)

**Q: Can I pause and resume?**
A: Yes, workflow state persists to database

**Q: Can I use commands without workflow?**
A: Yes, all manage-docs.ts commands work independently

**Q: How do I change smart routing?**
A: Edit content or manually move file after implementation

**Q: What if validation fails?**
A: Fix issues and approve again, workflow waits

**Q: Can multiple people use workflows simultaneously?**
A: Yes, each workflow has unique ID and isolated state

---

## Reference

### File Locations

| File | Purpose |
|------|---------|
| `scripts/workflows/doc-lifecycle-workflow.ts` | Workflow definition |
| `scripts/workflows/manage-docs.ts` | Management commands |
| `scripts/workflows/workflow-runner.ts` | Workflow orchestration |
| `scripts/lib/state/workflow-state.ts` | State machine |
| `scripts/validate/validate-docs-comprehensive.ts` | Comprehensive validator |

### Directory Structure

| Directory | Purpose |
|-----------|---------|
| `docs/.drafts/` | Work in progress |
| `docs/api/` | API documentation |
| `docs/guides/` | User guides |
| `docs/development/` | Development docs |
| `docs/testing/` | Testing docs |
| `docs/deployment/` | Deployment docs |
| `docs/architecture/` | Architecture docs |
| `docs/archive/` | Archived docs |

### Workflow States

| State | Description |
|-------|-------------|
| `pending` | Workflow created, not started |
| `running` | Workflow in progress |
| `paused` | Workflow waiting for approval |
| `completed` | Workflow finished successfully |
| `failed` | Workflow encountered error |
| `cancelled` | Workflow manually cancelled |

---

**Last Updated**: 2026-02-02
**Version**: 1.0 (Phase 2 Complete)
**Maintained By**: Engineering Team
