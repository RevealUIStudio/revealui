---
title: Security Training Program
description: Employee and contributor security training curriculum, completion tracking, and renewal requirements for SOC 2 compliance.
last-updated: 2026-04-12
review-cadence: annually
owner: RevealUI Studio <founder@revealui.com>
classification: internal
---

# Security Training Program

## 1. Purpose

This document defines the security training program for all individuals with access to RevealUI systems, code, or data. It ensures that team members understand security policies, recognize threats, and follow secure development practices.

## 2. Scope

This program applies to:

- **Founder/maintainer**: Full curriculum, all modules
- **Core contributors**: Modules 1-5 (secure development focus)
- **Community contributors**: Module 1 (onboarding) required before first PR merge
- **Third-party contractors**: Modules 1-3 as applicable to their engagement scope

## 3. Training Curriculum

### Module 1: Security Foundations (Required for all)

| Topic | Content | Duration |
|-------|---------|----------|
| Security policy overview | Information Security Policy, acceptable use, data classification | 30 min |
| Secret handling | Never commit secrets, use env vars, RevVault workflow, .env files | 20 min |
| Incident reporting | How to report security issues, security@revealui.com, SECURITY.md | 10 min |
| Access management | MFA requirements, password policy, account hygiene | 15 min |

**Assessment:** Acknowledge Information Security Policy. Demonstrate ability to use `revvault export-env` for local development.

### Module 2: Secure Development Practices (Required for contributors)

| Topic | Content | Duration |
|-------|---------|----------|
| OWASP Top 10 | Injection, XSS, CSRF, broken auth, security misconfiguration, SSRF | 45 min |
| Input validation | Zod schemas from @revealui/contracts, parameterized queries (Drizzle), URL sanitization | 30 min |
| Authentication patterns | Session-based auth, bcrypt, rate limiting, MFA enforcement middleware | 30 min |
| Authorization patterns | RBAC/ABAC policy engine, collection-level access control, overrideAccess stripping | 30 min |
| Dependency management | Dependabot alerts, pnpm audit, version pinning, pnpm overrides for CVE patches | 20 min |

**Assessment:** Code review exercise identifying 3 vulnerability types in sample code. Demonstrate Zod schema validation for user input.

### Module 3: CI/CD and Infrastructure Security (Required for deployers)

| Topic | Content | Duration |
|-------|---------|----------|
| CI gate architecture | 3-phase gate (quality, typecheck, test+build), Biome, CodeQL, Gitleaks | 20 min |
| Branch pipeline | Feature branches, test branch, main branch, protection rules | 15 min |
| Deployment security | Vercel deploy workflow, environment isolation, rollback procedures | 20 min |
| Secret rotation | Credential lifecycle, rotation schedule, RevVault sync, zero-downtime rotation | 20 min |

**Assessment:** Walk through a production deployment, identifying each security checkpoint. Demonstrate `pnpm gate` execution.

### Module 4: Data Protection and Privacy (Required for data handlers)

| Topic | Content | Duration |
|-------|---------|----------|
| Data classification | Critical, Sensitive, Internal, Public levels per Information Security Policy | 15 min |
| GDPR framework | Consent management, data deletion, anonymization, cross-DB cleanup | 30 min |
| Encryption standards | AES-256-GCM at rest, TLS in transit, non-extractable keys, HMAC signing | 20 min |
| PII handling | Identification, minimization, logging restrictions, retention policies | 20 min |

**Assessment:** Classify 5 data types by security level. Demonstrate GDPR deletion workflow.

### Module 5: Incident Response (Required for on-call personnel)

| Topic | Content | Duration |
|-------|---------|----------|
| Incident Response Plan | Detection, triage, containment, remediation, recovery phases | 30 min |
| Runbook walkthroughs | Key rotation, database access breach, webhook signing, session key rotation | 45 min |
| Communication protocol | Internal escalation, external disclosure timeline, status page updates | 15 min |
| Post-incident review | Root cause analysis, remediation tracking, policy updates | 15 min |

**Assessment:** Tabletop exercise simulating a credential exposure incident. Execute the key rotation runbook in a test environment.

## 4. Training Schedule

### Initial Training

| Audience | Required Modules | Deadline |
|----------|-----------------|----------|
| New team members | Modules 1-5 | Within 14 days of access grant |
| New core contributors | Modules 1-2 | Before first PR merge to `test` or `main` |
| New community contributors | Module 1 | Before first PR merge |
| New contractors | Modules 1-3 | Before access to production systems |

### Renewal Training

| Training Type | Frequency | Scope |
|--------------|-----------|-------|
| Full curriculum refresh | Annually | All modules applicable to role |
| Policy update briefing | On significant policy change | Affected modules only |
| Incident-driven refresher | After security incident | Relevant modules based on incident type |
| OWASP Top 10 update | When OWASP publishes new version | Module 2 |

### Annual Training Calendar

| Month | Activity |
|-------|---------|
| January | Annual curriculum review and update |
| April | Q2 training cycle (full refresh for existing team) |
| July | Mid-year check: completion status audit |
| October | New contributor onboarding review, material updates |

## 5. Automated Enforcement

RevealUI uses tooling as a continuous training reinforcement mechanism:

| Tool | Training Reinforcement | Module |
|------|----------------------|--------|
| Gitleaks (pre-commit) | Prevents secret commits, teaches secret hygiene | Module 1 |
| Biome lint | Enforces code quality and security patterns | Module 2 |
| CodeQL | Detects vulnerability patterns, provides remediation guidance | Module 2 |
| pnpm audit | Surfaces dependency vulnerabilities with fix suggestions | Module 2 |
| Pre-push gate | Blocks unsafe code from reaching protected branches | Module 3 |
| Custom AST analyzer | Catches execSync injection, TOCTOU, ReDoS patterns | Module 2 |
| RBAC enforcement tests | 58 tests continuously verify role isolation | Module 2 |

These tools serve as both security controls and training aids. When a tool blocks a commit or PR, the error message includes remediation guidance that reinforces the training material.

## 6. Completion Records

### Record Template

```markdown
# Training Completion Record

**Trainee:** [Name] ([email])
**Role:** [Founder / Core Contributor / Community Contributor / Contractor]
**Training type:** [Initial / Annual Renewal / Incident Refresh]
**Date completed:** [YYYY-MM-DD]

## Modules Completed

| Module | Status | Assessment Result | Date |
|--------|--------|-------------------|------|
| 1. Security Foundations | | | |
| 2. Secure Development | | | |
| 3. CI/CD & Infrastructure | | | |
| 4. Data Protection | | | |
| 5. Incident Response | | | |

## Notes
[Any exceptions, deferred modules, or follow-up items]

## Sign-off
Trainee: [Name] on [Date]
Reviewer: [Name] on [Date]
```

### Current Completion Status

| Trainee | Role | Modules Completed | Last Completed | Next Due |
|---------|------|-------------------|----------------|----------|
| RevealUI Studio (Founder) | Founder/Security Lead | 1, 2, 3, 4, 5 | 2026-04-12 (initial) | 2027-04-12 |

### Founder Initial Completion Record

**Trainee:** RevealUI Studio (founder@revealui.com)
**Role:** Founder / Security Lead / Sole Maintainer
**Training type:** Initial (self-directed, based on implemented controls)
**Date completed:** 2026-04-12

| Module | Status | Assessment Result | Date |
|--------|--------|-------------------|------|
| 1. Security Foundations | Complete | Policy authored, RevVault implemented | 2026-04-12 |
| 2. Secure Development | Complete | All OWASP controls implemented and tested (20,000+ tests) | 2026-04-12 |
| 3. CI/CD & Infrastructure | Complete | CI gate designed and operational, deployments automated | 2026-04-12 |
| 4. Data Protection | Complete | GDPR framework implemented, encryption standards in production | 2026-04-12 |
| 5. Incident Response | Complete | Incident response plan authored, 6 runbooks documented | 2026-04-12 |

**Notes:** As the sole developer, the founder demonstrates competency through the design and implementation of all security controls documented in the Information Security Policy, CI gate architecture, and the `@revealui/security` package. Formal training materials will be created when the team expands.

## 7. Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Training completion rate | 100% within deadline | 100% (1/1) |
| Annual renewal completion | 100% by renewal date | N/A (first cycle) |
| Mean time to complete initial training | Within 14 days | Day 0 (founder) |
| Assessment pass rate | 100% | 100% |

## 8. Related Documents

- [Information Security Policy](./INFORMATION_SECURITY_POLICY.md): Policies covered in Module 1.
- [Incident Response Plan](./INCIDENT_RESPONSE.md): Procedures covered in Module 5.
- [Asset Inventory](./ASSET_INVENTORY.md): Systems and data stores referenced across all modules.
- [SECURITY.md](/SECURITY.md): Vulnerability reporting process (Module 1).

## 9. Change Log

| Date | Author | Change |
|------|--------|--------|
| 2026-04-12 | RevealUI Studio | Initial security training program and founder completion record. |
