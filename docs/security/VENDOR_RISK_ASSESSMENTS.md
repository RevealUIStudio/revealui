---
title: Vendor Risk Assessments
description: Third-party vendor risk assessments for Neon, Supabase, Vercel, Stripe, and GitHub covering SOC 2 compliance, data handling, and business continuity.
last-updated: 2026-04-12
review-cadence: quarterly
owner: RevealUI Studio <founder@revealui.com>
classification: internal
---

# Vendor Risk Assessments

## 1. Purpose

This document provides formal risk assessments for all third-party vendors that process, store, or transmit RevealUI data. Each assessment evaluates the vendor's security posture, compliance certifications, data handling practices, and business continuity capabilities.

These assessments support SOC 2 Type II compliance under the Common Criteria (CC6.1 through CC6.8) by demonstrating due diligence in vendor selection and ongoing monitoring.

## 2. Assessment Methodology

Each vendor is evaluated against the following criteria:

| Category | Weight | Criteria |
|----------|--------|----------|
| Security certifications | High | SOC 2 Type II, ISO 27001, PCI DSS (where applicable) |
| Data Processing Agreement | High | DPA in effect, GDPR-compliant terms, subprocessor transparency |
| Encryption | High | Encryption at rest (AES-256), encryption in transit (TLS 1.2+) |
| Access controls | Medium | RBAC, MFA support, audit logging, SSO |
| Incident response | Medium | Documented IR process, breach notification SLA |
| Business continuity | Medium | SLA uptime, disaster recovery, data portability |
| Data residency | Low | Data center locations, jurisdictional considerations |
| Vendor lock-in risk | Low | Data export capabilities, API openness, migration difficulty |

### Risk Rating Scale

| Rating | Definition |
|--------|-----------|
| Low | Vendor meets or exceeds all requirements. No material concerns. |
| Medium | Vendor meets core requirements with minor gaps. Compensating controls in place. |
| High | Material gaps exist. Remediation plan required. |
| Critical | Unacceptable risk. Vendor replacement or significant mitigation required. |

## 3. Vendor Assessments

### 3.1 Neon (Primary Database)

**Vendor:** Neon Inc.
**Service:** Managed PostgreSQL (serverless)
**Asset ID:** DS-001, TP-005 (see Asset Inventory)
**Data classification:** Confidential (user PII, session tokens, payment metadata)

| Category | Assessment | Notes |
|----------|-----------|-------|
| SOC 2 Type II | Certified | [VERIFY: Confirm current report date on Neon trust page] |
| ISO 27001 | Certified | [VERIFY: Confirm current certificate date] |
| DPA | In effect | Signed via Neon's standard DPA terms |
| Encryption at rest | AES-256 (provider-managed) | Meets requirements |
| Encryption in transit | TLS 1.2+ | Connection strings enforce SSL mode |
| Access controls | Project-level RBAC, API key scoping | Meets requirements |
| MFA | Supported | Enabled for RevealUI account |
| Audit logging | Available | Connection and query logging available |
| Incident response | Documented | Status page at status.neon.tech |
| Breach notification | Per DPA terms | Timely notification committed |
| SLA uptime | 99.95% | Meets requirements for production workload |
| Data portability | Standard PostgreSQL | pg_dump export, standard SQL migration |
| Backup/Recovery | Continuous PITR (Point-in-Time Recovery) | RPO: near-zero, RTO: minutes |

**Data shared with Neon:**
- All relational data across 86 tables (users, content, products, sessions, payments metadata)
- Connection metadata and query execution logs

**Compensating controls:**
- Application-level AES-256-GCM encryption for sensitive fields via `@revealui/security`
- Database credentials stored in Vercel environment variables, never in source
- IP allowlisting configured where supported

**Risk rating:** Low
**Next review:** 2026-07-12

---

### 3.2 Supabase (Secondary Database)

**Vendor:** Supabase Inc.
**Service:** Managed PostgreSQL + pgvector, Auth
**Asset ID:** DS-002, TP-006 (see Asset Inventory)
**Data classification:** Confidential (vector embeddings, OAuth linkage)

| Category | Assessment | Notes |
|----------|-----------|-------|
| SOC 2 Type II | Certified | [VERIFY: Confirm current report date on Supabase trust page] |
| DPA | In effect | Signed via Supabase's standard DPA terms |
| Encryption at rest | AES-256 (provider-managed) | Meets requirements |
| Encryption in transit | TLS 1.2+ | Enforced on all connections |
| Access controls | Project-level RBAC, Row Level Security (RLS) | RLS enforced for anon key access |
| MFA | Supported | Enabled for RevealUI account |
| Audit logging | Available | API and auth event logging |
| Incident response | Documented | Status page at status.supabase.com |
| Breach notification | Per DPA terms | Timely notification committed |
| SLA uptime | 99.9% | Meets requirements for secondary workload |
| Data portability | Standard PostgreSQL + pg_dump | Standard migration path |
| Backup/Recovery | Daily snapshots (provider-managed) | RPO: 24 hours, RTO: hours |

**Data shared with Supabase:**
- Vector embeddings for RAG functionality
- OAuth account linkage records
- Auth session data (where Supabase Auth is used)

**Compensating controls:**
- Service role keys restricted to server-side use only
- Anon keys have RLS policies enforced
- Cross-DB cleanup (`@revealui/db/cleanup`) handles orphaned data after site deletion
- Supabase imports restricted to permitted paths via `supabase-boundary.js` hook

**Risk rating:** Low
**Next review:** 2026-07-12

---

### 3.3 Vercel (Hosting and CDN)

**Vendor:** Vercel Inc.
**Service:** Hosting, CDN, serverless compute, environment variable management
**Asset ID:** TP-001 (see Asset Inventory)
**Data classification:** Internal (application code, build artifacts, environment variables, request logs)

| Category | Assessment | Notes |
|----------|-----------|-------|
| SOC 2 Type II | Certified | [VERIFY: Confirm current report date on Vercel trust page] |
| ISO 27001 | Certified | [VERIFY: Confirm current certificate date] |
| DPA | In effect | Covered by Vercel DPA |
| Encryption at rest | Provider-managed | Build artifacts and environment variables encrypted |
| Encryption in transit | TLS 1.2+ (enforced on all traffic) | HSTS enabled with includeSubDomains |
| Access controls | Team-level RBAC, SSO via GitHub | Meets requirements |
| MFA | Via GitHub SSO | Enforced through GitHub 2FA requirement |
| Audit logging | Deployment logs, access logs | Available in dashboard |
| Incident response | Documented | Status page at vercel-status.com |
| Breach notification | Per DPA terms | Timely notification committed |
| SLA uptime | 99.99% (Enterprise) | Exceeds requirements |
| Data portability | Standard web deployment | No vendor lock-in for application code |
| Backup/Recovery | Deployment rollback, instant revert | Previous deployments always available |

**Data shared with Vercel:**
- Application source code (at build time)
- Environment variables (encrypted at rest)
- Request/response logs
- Build artifacts and static assets

**Compensating controls:**
- Production deployments only from `main` branch via CI (no manual deploys)
- Git Integration disabled; deploys are CI-triggered via `deploy.yml`
- Environment variables managed via RevVault sync
- Preview deployments on `test` branch only (manual trigger)

**Risk rating:** Low
**Next review:** 2026-07-12

---

### 3.4 Stripe (Payment Processing)

**Vendor:** Stripe Inc.
**Service:** Payment processing, billing, subscriptions
**Asset ID:** TP-002 (see Asset Inventory)
**Data classification:** Confidential (payment metadata; no cardholder data stored by RevealUI)

| Category | Assessment | Notes |
|----------|-----------|-------|
| SOC 2 Type II | Certified | [VERIFY: Confirm current report date on Stripe trust page] |
| PCI DSS Level 1 | Certified | Highest level of PCI compliance |
| DPA | In effect | Stripe DPA covers GDPR requirements |
| Encryption at rest | AES-256 | PCI DSS requirement |
| Encryption in transit | TLS 1.2+ | PCI DSS requirement |
| Access controls | Dashboard RBAC, restricted API keys | Meets requirements |
| MFA | Supported and recommended | Enabled for RevealUI account |
| Audit logging | Full event logging, webhook event history | Comprehensive |
| Incident response | Documented | Status page at status.stripe.com |
| Breach notification | Per DPA and PCI DSS requirements | Regulatory-driven timelines |
| SLA uptime | 99.99%+ | Exceeds requirements |
| Data portability | Full data export via API | Customer, subscription, and event data exportable |

**Data shared with Stripe:**
- Customer email addresses (for receipt delivery)
- Subscription and billing plan selections
- Webhook event metadata

**Data NOT shared with Stripe by RevealUI:**
- RevealUI does not store credit card numbers, CVVs, or payment method details
- All card processing happens entirely within Stripe's PCI-compliant environment

**Compensating controls:**
- Secret keys stored in Vercel environment variables, never in source
- Webhook endpoints verify Stripe signatures before processing
- Webhook rate limiting: 100 requests/minute on `/api/webhooks`
- Currently in test mode; live mode switch requires explicit owner action

**Risk rating:** Low
**Next review:** 2026-07-12

---

### 3.5 GitHub (Source Code and CI/CD)

**Vendor:** GitHub Inc. (Microsoft)
**Service:** Source code hosting, CI/CD (GitHub Actions), package registry (npm), security scanning
**Asset ID:** TP-003, TP-004 (see Asset Inventory)
**Data classification:** Internal (source code, CI logs, encrypted secrets)

| Category | Assessment | Notes |
|----------|-----------|-------|
| SOC 2 Type II | Certified | [VERIFY: Confirm current report date on GitHub trust page] |
| ISO 27001 | Certified (via Microsoft) | [VERIFY: Confirm current certificate date] |
| DPA | In effect | GitHub DPA covers npm (TP-004) as well |
| Encryption at rest | AES-256 | Repository data, secrets encrypted |
| Encryption in transit | TLS 1.2+ | All GitHub traffic encrypted |
| Access controls | Organization RBAC, branch protection, CODEOWNERS | Meets requirements |
| MFA | Required for all org members | Enforced at organization level |
| Audit logging | Organization audit log | Available for security events |
| Incident response | Documented | Status page at githubstatus.com |
| Breach notification | Per DPA terms | Timely notification committed |
| SLA uptime | 99.9% | Meets requirements |
| Data portability | Full git history export | Standard git clone, API export |
| Secret scanning | Built-in (push protection, alerts) | Active on RevealUI repos |
| Security advisories | Dependabot, CodeQL, secret scanning | All enabled |

**Data shared with GitHub:**
- Source code (public OSS packages and private Pro packages)
- CI/CD pipeline definitions and execution logs
- Encrypted secrets (VERCEL_TOKEN, TURBO_TOKEN)
- Package registry data (published npm packages)
- Security scanning results (CodeQL, Dependabot, Gitleaks)

**Compensating controls:**
- Two-factor authentication required for organization membership
- Branch protection on `main` and `test` (require CI pass before merge)
- npm publishing uses OIDC trusted publishing (no long-lived NPM_TOKEN)
- SLSA Build Level 2 provenance attestations on published packages
- Gitleaks runs in CI to catch secrets before they reach the repository

**Risk rating:** Low
**Next review:** 2026-07-12

## 4. Risk Summary

| Vendor | Asset IDs | Risk Rating | Key Strengths | Watchlist Items |
|--------|-----------|-------------|---------------|-----------------|
| Neon | DS-001, TP-005 | Low | SOC 2 Type II, PITR, standard PostgreSQL | Monitor for pricing changes, verify DPA annually |
| Supabase | DS-002, TP-006 | Low | SOC 2 Type II, RLS, pgvector | Monitor RLS configuration drift, verify DPA annually |
| Vercel | TP-001 | Low | SOC 2 Type II, 99.99% SLA, instant rollback | Monitor for env var handling changes |
| Stripe | TP-002 | Low | PCI DSS L1, SOC 2 Type II, no card data exposure | Monitor test-to-live mode transition readiness |
| GitHub | TP-003, TP-004 | Low | SOC 2 Type II, OIDC publishing, secret scanning | Monitor for Actions pricing changes, audit log retention |

**Overall vendor risk posture:** Low. All vendors maintain SOC 2 Type II certification and offer encryption at rest and in transit. No material gaps identified.

## 5. Contingency Planning

### Vendor Replacement Readiness

| Vendor | Replacement Options | Migration Difficulty | Data Portability |
|--------|-------------------|---------------------|-----------------|
| Neon | Any managed PostgreSQL (Supabase, AWS RDS, Railway) | Low (standard pg_dump) | Full SQL export |
| Supabase | Any PostgreSQL with pgvector (Neon, self-hosted) | Low (standard pg_dump) | Full SQL export |
| Vercel | Netlify, Cloudflare Pages, AWS Amplify, self-hosted | Medium (redeploy config) | Application code is portable |
| Stripe | Paddle, LemonSqueezy | Medium (customer migration) | Full data export via API |
| GitHub | GitLab, Bitbucket, self-hosted Gitea | Medium (CI/CD migration) | Full git history portable |

### Exit Criteria

A vendor replacement is triggered if:

1. Vendor loses SOC 2 certification and does not remediate within 90 days.
2. Vendor suffers a data breach affecting RevealUI data.
3. Vendor discontinues the service or makes prohibitive pricing changes.
4. Vendor DPA is terminated or becomes non-compliant with GDPR requirements.

## 6. Review Schedule

| Quarter | Review Window | Scope |
|---------|---------------|-------|
| Q2 2026 | April 1-15 | Initial assessment (this document) |
| Q3 2026 | July 1-15 | Verify SOC 2 report dates, DPA status, SLA metrics |
| Q4 2026 | October 1-15 | Full reassessment, pricing review |
| Q1 2027 | January 1-15 | Annual comprehensive review |

## 7. Related Documents

- [Asset Inventory](./ASSET_INVENTORY.md): Complete third-party processor inventory (Section 4).
- [Information Security Policy](./INFORMATION_SECURITY_POLICY.md): Data classification and encryption standards.
- [Change Management Policy](./CHANGE_MANAGEMENT_POLICY.md): Vendor change procedures.

## 8. Change Log

| Date | Author | Change |
|------|--------|--------|
| 2026-04-12 | RevealUI Studio | Initial vendor risk assessments for all five vendors. |
