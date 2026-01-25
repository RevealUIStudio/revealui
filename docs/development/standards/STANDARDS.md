# 📋 Documentation Standards

## Truth & Accuracy
- All claims must be verifiable against current code/system state
- No status inflation or completion overstatement
- Metrics must come from automated audits, not manual counts
- Future dates only in planning documents, not status docs

## Organization
- Single source of truth for each topic type
- Clear navigation and discoverability
- Consistent file naming and structure
- Regular cleanup of outdated content

## Maintenance
- Monthly review of status documents
- Quarterly comprehensive audit
- Automated verification where possible
- Clear ownership and update procedures

## Quality
- Concise but comprehensive
- Clear language, no jargon
- Current examples and code snippets
- Working links and references

## File Structure
```
docs/
├── getting-started/     # README, quick start, onboarding
├── core/               # Status, roadmap, architecture
├── development/        # Guides, automation, reference
├── assessments/        # Active assessments only
└── maintenance/        # Standards, navigation, tools
```

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

## Enforcement

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

## Metrics & KPIs

### Quality Metrics
- Claim accuracy rate (>95%)
- Documentation freshness (<30 days stale)
- Navigation success rate (>90%)
- User satisfaction scores

### Maintenance Metrics
- Monthly audit completion rate
- Average time to fix false claims
- Documentation update frequency
- Archive cleanup completion rate

## Tools & Automation

### Verification Tools
- `scripts/audit-docs.ts` - False claim detection
- `scripts/verify-claims.ts` - Claim verification
- `scripts/consolidate-docs.ts` - Consolidation planning

### Maintenance Tools
- Automated archive cleanup
- Link validation scripts
- Freshness monitoring
- Usage analytics

## Compliance Checking

All documentation must pass these checks:
- [ ] Contains "Last Updated" date within 30 days
- [ ] All claims are verifiable against current system state
- [ ] No future dates in current documentation
- [ ] Working links and valid references
- [ ] Consistent formatting and structure
- [ ] Clear navigation and discoverability
- [ ] Appropriate audience and technical level