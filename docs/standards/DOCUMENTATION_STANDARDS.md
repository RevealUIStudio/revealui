# Documentation Standards & Structure

This document defines the standards, structure, and best practices for RevealUI Framework documentation.

---

## Table of Contents

- [Directory Structure](#directory-structure)
- [Documentation Standards](#documentation-standards)
- [File Naming Conventions](#file-naming-conventions)
- [Content Guidelines](#content-guidelines)
- [Verification Process](#verification-process)
- [Maintenance](#maintenance)

---

## Directory Structure

### Organization

```
docs/
├── api/                  # Auto-generated API documentation
│   ├── README.md         # API documentation index
│   └── [package-name]/   # Package-specific API docs
├── guides/              # User-facing guides and tutorials
│   ├── getting-started/ # Getting started guides
│   ├── deployment/      # Deployment guides
│   └── usage/          # Usage guides
├── reference/          # Reference documentation
│   ├── configuration/  # Configuration reference
│   ├── api/           # API reference (links to api/)
│   └── types/         # Type definitions
├── development/        # Developer documentation
│   ├── contributing/  # Contribution guides
│   ├── architecture/  # Architecture docs
│   └── testing/       # Testing documentation
├── archive/           # Archived documentation
├── content/          # Processed content for website
└── [root files]      # Main documentation index files
```

### Directory Purposes

#### `api/`
Auto-generated API documentation from TypeScript source files. Contains:
- Package-level API documentation
- Function, class, and interface documentation
- Type definitions
- Usage examples extracted from JSDoc

**Note**: Files in this directory are auto-generated. Do not edit manually.

#### `guides/`
User-facing guides and tutorials:
- Getting started guides
- Step-by-step tutorials
- How-to guides
- Best practices
- Common use cases

#### `reference/`
Reference documentation for developers:
- Configuration options
- API reference (links to `api/`)
- Type definitions
- Schema references
- Technical specifications

#### `development/`
Documentation for contributors and maintainers:
- Contributing guidelines
- Architecture documentation
- Development setup
- Testing strategies
- Internal processes

#### `archive/`
Historical documentation that is no longer actively maintained but kept for reference.

#### `content/`
Processed content files used by the documentation website. This directory is auto-generated.

---

## Documentation Standards

### Truth & Accuracy
- All claims must be verifiable against current code/system state
- No status inflation or completion overstatement
- Metrics must come from automated audits, not manual counts
- Future dates only in planning documents, not status docs

### Organization
- Single source of truth for each topic type
- Clear navigation and discoverability
- Consistent file naming and structure
- Regular cleanup of outdated content

### Quality
- Concise but comprehensive
- Clear language, no jargon
- Current examples and code snippets
- Working links and references

### Metrics & KPIs

#### Quality Metrics
- Claim accuracy rate (>95%)
- Documentation freshness (<30 days stale)
- Navigation success rate (>90%)
- User satisfaction scores

#### Maintenance Metrics
- Monthly audit completion rate
- Average time to fix false claims
- Documentation update frequency
- Archive cleanup completion rate

---

## File Naming Conventions

- Use kebab-case for file names: `getting-started.md`
- Use descriptive names: `deployment-vercel.md` not `deploy.md`
- Group related files in subdirectories
- Use `README.md` for directory indexes

### Documentation Types

**Guides**
- Written for end users
- Step-by-step instructions
- Practical examples
- Clear, beginner-friendly language

**Reference**
- Written for developers
- Complete API documentation
- Technical specifications
- Type definitions

**Development**
- Written for contributors
- Internal processes
- Architecture decisions
- Development workflows

---

## Content Guidelines

### Status Documents
- Must include "Last Updated" date
- Must reference verifiable metrics
- Must distinguish between planning and reality
- Must be reviewed monthly

### Technical Documentation
- Must include working code examples
- Must specify framework versions
- Must include prerequisites clearly
- Must link to related documentation

### Assessment Documents
- Must include methodology used
- Must specify date ranges covered
- Must include confidence levels
- Must be archived after 30 days

---

## Verification Process

### Automated Verification
- Monthly documentation audits using `scripts/audit-docs.ts`
- Claim verification against system state
- Link validation and reference checking
- Quality metric collection

### Manual Review
- Quarterly comprehensive content review
- Stakeholder feedback collection
- Usage analytics analysis
- Freshness and relevance assessment

### CI/CD Integration
- Documentation verification in CI pipeline
- Automated claim checking on PRs
- Quality gate enforcement
- Audit result reporting

### Team Processes
- Documentation ownership assignment
- Review checklists for new content
- Update procedures for existing content
- Escalation process for outdated content

---

## Maintenance

### Regular Tasks
- Keep documentation up to date with code changes
- Run `pnpm docs:manage` regularly to detect stale content
- Archive outdated documentation to `docs/archive/`
- Monthly review of status documents
- Quarterly comprehensive audit

### Tools & Automation

#### Verification Tools
- `scripts/audit-docs.ts` - False claim detection
- `scripts/verify-claims.ts` - Claim verification
- `scripts/consolidate-docs.ts` - Consolidation planning

#### Maintenance Tools
- Automated archive cleanup
- Link validation scripts
- Freshness monitoring
- Usage analytics

---

## Compliance Checklist

All documentation must pass these checks:
- [ ] Contains "Last Updated" date within 30 days
- [ ] All claims are verifiable against current system state
- [ ] No future dates in current documentation
- [ ] Working links and valid references
- [ ] Consistent formatting and structure
- [ ] Clear navigation and discoverability
- [ ] Appropriate audience and technical level

---

## Root-Level Documentation Policy

This section defines the policy for which documentation files should be kept at the project root versus moved to the `docs/` directory.

### Essential Root Files

The following files **must** remain at the project root:

- `README.md` - Project overview and quick start guide
- `CHANGELOG.md` - Version history and release notes
- `CONTRIBUTING.md` - Contribution guidelines
- `LICENSE.md` - License information
- `SECURITY.md` - Security policy and vulnerability reporting (GitHub recognizes)
- `CODE_OF_CONDUCT.md` - Code of conduct and community guidelines (GitHub recognizes)

### Additional Allowed Root Files

The following markdown files are allowed in the project root:

- `AGENT.md` - Agent handoff, instructions, or agent-related documentation (exact match only)
- `INFRASTRUCTURE.md` / `ARCHITECTURE.md` - Infrastructure or architecture documentation
- `SKILLS.md` - Skills, capabilities, or competency documentation

### Files That Should Be Moved to docs/

#### Assessment Files
Files containing assessments, evaluations, or analysis should be moved to `docs/archive/assessments/`:
- `BRUTAL_*_ASSESSMENT.md`
- `AGENT_WORK_ASSESSMENT.md`
- `TYPE_SYSTEM_*.md`
- Any file with "ASSESSMENT" in the name

#### Status Files
Files containing status updates, completion reports, or fix summaries should be moved to `docs/archive/status/`:
- `*_COMPLETE.md`
- `*_FIXES_*.md`
- `*_STATUS.md`
- `*_VERIFICATION_*.md`
- Any file documenting a completed task or fix

#### Documentation Files
All other documentation should be organized in the `docs/` directory:
- User guides → `docs/guides/`
- Reference docs → `docs/reference/`
- Developer docs → `docs/development/`
- API docs → `docs/api/` (auto-generated)

### Rationale

**Why Keep Some Files at Root:**
1. **Visibility**: Root-level files are immediately visible when viewing the repository
2. **Conventions**: Industry standard to have README, CHANGELOG, CONTRIBUTING, LICENSE at root
3. **Tooling**: Many tools (GitHub, npm, etc.) expect these files at root
4. **GitHub Recognition**: Files like SECURITY.md and CODE_OF_CONDUCT.md are recognized by GitHub

**Why Move Other Files:**
1. **Organization**: Keeps root directory clean and focused
2. **Discoverability**: Organized structure makes it easier to find documentation
3. **Maintenance**: Easier to maintain and update when organized
4. **Archive**: Status and assessment files are historical and belong in archive

### Documentation Management Strategy

**Core Principle**: Documentation should be managed by correctness, not age.

- ✅ **Keep** correct documentation (regardless of age)
- ✅ **Delete** incorrect/outdated documentation (via validation)
- ✅ **Organize** future plans in dedicated directory

#### Documentation Organization

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

### Validation

Use the consolidation script to enforce this policy:

```bash
# Check what would be moved (dry run)
pnpm docs:consolidate --dry-run

# Actually move files
pnpm docs:consolidate
```

**Note**: `validate:root-markdown` script not yet implemented.

### CI/CD Integration

Add to CI/CD pipeline to enforce policy:

```yaml
- name: Validate Root Markdown Files
  run: pnpm validate:root-markdown
```

### Migration Process

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

## Related Documentation

- [Contributing Docs](./CONTRIBUTING_DOCS.md) - How to contribute documentation
- [API Docs Guide](./API_DOCS_GUIDE.md) - How to write API documentation
- [CODE_STYLE.md](./CODE_STYLE.md) - Code style and formatting standards
- [OBSERVABILITY.md](./OBSERVABILITY.md) - Error handling and logging standards
