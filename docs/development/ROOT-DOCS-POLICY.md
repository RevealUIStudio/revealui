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
