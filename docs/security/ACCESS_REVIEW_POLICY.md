---
title: Access Review Policy
description: Quarterly access review cadence, review template, and audit records for SOC 2 compliance.
last-updated: 2026-04-12
review-cadence: quarterly
owner: RevealUI Studio <founder@revealui.com>
classification: internal
---

# Access Review Policy

## 1. Purpose

This policy establishes the cadence, process, and documentation requirements for periodic access reviews across all RevealUI systems and services. Access reviews ensure that permissions remain appropriate, accounts are active, and the principle of least privilege is maintained.

## 2. Scope

This policy covers access to:

- **Source code**: GitHub organization (`RevealUIStudio`), repository permissions, branch protections
- **Infrastructure**: Vercel team, NeonDB projects, Supabase organizations, Stripe dashboard
- **CI/CD**: GitHub Actions secrets, deployment tokens, npm publishing credentials
- **Secret management**: RevVault access, Vercel environment variables
- **Communication**: Security contact lists, incident response channels

## 3. Review Cadence

| Review Type | Frequency | Owner | Deadline |
|-------------|-----------|-------|----------|
| Full access review | Quarterly (Jan, Apr, Jul, Oct) | Security Lead (Founder) | 15th of the review month |
| Triggered review | On personnel change | Security Lead | Within 24 hours of change |
| Incident-driven review | After security incident | Security Lead | Within 48 hours of incident resolution |

### Quarterly Schedule

| Quarter | Review Window | Report Due |
|---------|---------------|------------|
| Q1 | January 1-15 | January 15 |
| Q2 | April 1-15 | April 15 |
| Q3 | July 1-15 | July 15 |
| Q4 | October 1-15 | October 15 |

## 4. Review Process

### 4.1 Pre-Review Preparation

1. Export current access lists from each system (GitHub members, Vercel team, NeonDB roles, Supabase members, Stripe users).
2. Retrieve the previous quarter's review record for comparison.
3. Collect any personnel changes, role changes, or access requests since the last review.

### 4.2 Review Checklist

For each system, verify:

- [ ] All accounts are associated with active team members
- [ ] Permission levels match current role requirements
- [ ] No orphaned accounts (departed contributors, expired integrations)
- [ ] Service accounts and API tokens are still in use and scoped minimally
- [ ] MFA is enabled where supported
- [ ] Branch protection rules are unchanged and appropriate
- [ ] Emergency access procedures are documented and current

### 4.3 Post-Review Actions

1. Revoke access for any accounts that fail the review.
2. Downgrade permissions where current level exceeds role requirements.
3. Document all changes in the review record.
4. Update the Asset Inventory if systems or accounts have changed.
5. File the completed review record in `docs/security/review-records/`.

## 5. Access Review Template

```markdown
# Access Review Record - [YYYY-QN]

**Review date:** [YYYY-MM-DD]
**Reviewer:** [Name]
**Review type:** Quarterly / Triggered / Incident-driven

## Systems Reviewed

### GitHub (RevealUIStudio org)
| Account | Role | MFA | Status | Action |
|---------|------|-----|--------|--------|
| | | | | |

### Vercel (RevealUI team)
| Account | Role | MFA | Status | Action |
|---------|------|-----|--------|--------|
| | | | | |

### NeonDB
| Account/Role | Access Level | Status | Action |
|-------------|-------------|--------|--------|
| | | | |

### Supabase
| Account/Role | Access Level | Status | Action |
|-------------|-------------|--------|--------|
| | | | |

### Stripe
| Account | Role | MFA | Status | Action |
|---------|------|-----|--------|--------|
| | | | | |

### CI/CD Secrets and Tokens
| Secret/Token | System | Last Rotated | Status | Action |
|-------------|--------|-------------|--------|--------|
| | | | | |

## Summary
- Accounts reviewed: [N]
- Access revoked: [N]
- Permissions downgraded: [N]
- Issues found: [description or "None"]
- Next review: [YYYY-QN]

## Sign-off
Reviewed by: [Name] ([email]) on [YYYY-MM-DD]
```

## 6. First Quarterly Review Record (2026-Q2)

**Review date:** 2026-04-12
**Reviewer:** RevealUI Studio (founder@revealui.com)
**Review type:** Quarterly (initial baseline)

### GitHub (RevealUIStudio org)

| Account | Role | MFA | Status | Action |
|---------|------|-----|--------|--------|
| RevealUI Studio | Owner | Enabled | Active, sole maintainer | None |

### Vercel (RevealUI team)

| Account | Role | MFA | Status | Action |
|---------|------|-----|--------|--------|
| RevealUI Studio | Owner | Via GitHub SSO | Active | None |

### NeonDB

| Account/Role | Access Level | Status | Action |
|-------------|-------------|--------|--------|
| Founder | Project owner | Active, sole accessor | None |

### Supabase

| Account/Role | Access Level | Status | Action |
|-------------|-------------|--------|--------|
| Founder | Organization owner | Active, sole accessor | None |
| Service role key | Server-side only | Active, RLS enforced for anon key | None |

### Stripe

| Account | Role | MFA | Status | Action |
|---------|------|-----|--------|--------|
| Founder | Account owner | Enabled | Active, test mode | None |

### CI/CD Secrets and Tokens

| Secret/Token | System | Last Rotated | Status | Action |
|-------------|--------|-------------|--------|--------|
| VERCEL_TOKEN | GitHub Secrets | 2026-03-15 | Active | None |
| TURBO_TOKEN | GitHub Secrets | 2026-03-15 | Active | None |
| NPM_TOKEN | OIDC (no long-lived token) | N/A | Tokenless publish | None |

### Summary

- Accounts reviewed: 6 systems, 1 human account each
- Access revoked: 0
- Permissions downgraded: 0
- Issues found: None. Solo-developer project with minimal attack surface.
- Next review: 2026-Q3 (July 1-15)

### Sign-off

Reviewed by: RevealUI Studio (founder@revealui.com) on 2026-04-12

## 7. Exceptions

Access review exceptions (e.g., temporary elevated access for incident response) must be:

1. Documented with justification and expected duration.
2. Approved by the Security Lead.
3. Automatically revoked at the end of the exception period.
4. Reviewed in the next quarterly access review.

## 8. Related Documents

- [Information Security Policy](./INFORMATION_SECURITY_POLICY.md): Access control policies and authentication standards.
- [Incident Response Plan](./INCIDENT_RESPONSE.md): Emergency access procedures during incidents.
- [Asset Inventory](./ASSET_INVENTORY.md): Complete list of systems subject to access review.

## 9. Change Log

| Date | Author | Change |
|------|--------|--------|
| 2026-04-12 | RevealUI Studio | Initial access review policy and first quarterly review. |
