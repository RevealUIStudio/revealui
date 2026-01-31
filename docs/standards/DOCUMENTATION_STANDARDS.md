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

## Related Documentation

- [Contributing Docs](./CONTRIBUTING_DOCS.md) - How to contribute documentation
- [API Docs Guide](./API_DOCS_GUIDE.md) - How to write API documentation
- [ROOT_DOCS_POLICY.md](./ROOT_DOCS_POLICY.md) - Root-level documentation policy
