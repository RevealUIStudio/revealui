---
title: SOC2 Type II Audit Track
status: planning
owner: RevealUI Studio
last-updated: 2026-04-15
---

# SOC2 Type II Audit Track

## Overview

This document tracks progress toward SOC2 Type II certification covering the Common Criteria (Security) Trust Service Criteria. Required for enterprise (Forge) customers.

## Prerequisites (Complete)

| Phase | Status | Evidence |
|-------|--------|----------|
| 6.1 Policy & Documentation | Complete | 8 policy docs in `docs/security/` |
| 6.2 Technical Controls | Complete | Tamper-evident audit log, security alerts, MFA enforcement, asset inventory, uptime monitoring, backup verification |

## Phase 6.3 Audit Track

### Step 1: Annual Penetration Test

**Status:** Not started
**Budget:** TBD
**Target:** Q3 2026

**Vendor Selection Criteria:**

- CREST or OSCP certified testers
- Experience with TypeScript/Node.js SaaS platforms
- Covers OWASP Top 10, API security, auth bypass, privilege escalation
- Delivers actionable report (not just vulnerability scanner output)
- Provides retest after remediation

**Scope:**

| Target | Method | Notes |
|--------|--------|-------|
| `api.revealui.com` | Black-box + gray-box | Full REST API, auth flows, Stripe webhooks |
| `admin.revealui.com` | Authenticated testing | RBAC bypass, XSS, CSRF, privilege escalation |
| `revealui.com` | Light scan | Marketing site, minimal attack surface |
| Infrastructure | Config review | Vercel, NeonDB, Supabase security settings |
| Dependencies | SCA | npm audit, CodeQL, Gitleaks (already in CI) |

**Vendor Shortlist (evaluate before engaging):**

1. HackerOne pentest — marketplace model, pay per finding
2. Cure53 — strong reputation for OSS/security library audits
3. Trail of Bits — if budget allows, top-tier for TypeScript/crypto
4. Cobalt — pentest-as-a-service, SOC2-focused offering
5. Local/boutique firm — lower cost, personal attention

**RFP Template:** See `docs/security/templates/pentest-rfp.md`

### Step 2: SOC2 Type I Readiness Assessment

**Status:** Not started
**Target:** Q4 2026 (after pentest remediation)

**What this involves:**

1. Engage a CPA firm experienced in SOC2 for technology companies
2. Gap analysis against Trust Service Criteria (Common Criteria: Security)
3. Review of all policy documents, technical controls, and evidence
4. Identification of remaining gaps before formal audit
5. Remediation of gaps

**Auditor Selection Criteria:**

- Licensed CPA firm with SOC2 specialization
- Experience with small/solo-founder SaaS companies
- Familiar with cloud-native infrastructure (Vercel, Neon, Supabase)
- Reasonable cost for Type I (budget: $15k-$30k range)

### Step 3: Evidence Collection Period (6-12 months)

**Status:** Not started
**Target:** Q1-Q3 2027

**Automated evidence sources (already producing):**

| Evidence | Source | Frequency | Location |
|----------|--------|-----------|----------|
| Code reviews | GitHub PR reviews | Every PR | GitHub API |
| CI/CD pipeline | GitHub Actions logs | Every push | GitHub API |
| Dependency audits | CodeQL, Dependabot | Weekly | GitHub Security tab |
| Secret scanning | Gitleaks | Every commit | CI logs |
| Access reviews | Manual process | Quarterly | `docs/security/drill-records/` |
| Incident response drills | Manual process | Quarterly | `docs/security/drill-records/` |
| Backup verification | Manual process | Quarterly | `docs/security/drill-records/` |
| Uptime monitoring | Cron health checks | Daily | Audit log DB |
| Change management | Git history + PR descriptions | Every change | GitHub API |

**Evidence that needs new automation:**

| Evidence | What's needed | Priority |
|----------|---------------|----------|
| Login audit trail | Query audit_log for auth events, export monthly | High |
| Failed login attempts | Query security alerts, export monthly | High |
| Permission changes | Query audit_log for role changes, export monthly | Medium |
| Vendor review updates | Annual renewal of vendor risk assessments | Low |

### Step 4: SOC2 Type II Report

**Status:** Not started
**Target:** Q4 2027

**Deliverables:**

- SOC2 Type II report from CPA firm
- Trust page on revealui.com with report availability
- Badge/seal for marketing materials
- Customer-facing security documentation

## Evidence Collection Script

A script to export evidence snapshots is at `scripts/security/collect-soc2-evidence.ts`. It queries GitHub API and the audit log database to produce a monthly evidence package.

## Cost Estimates

| Item | Estimated Cost | Timing |
|------|---------------|--------|
| Penetration test | $5k-$15k | Q3 2026 |
| SOC2 Type I readiness | $15k-$30k | Q4 2026 |
| SOC2 Type II audit | $20k-$50k | Q4 2027 |
| Annual maintenance | $10k-$20k/year | Ongoing |

**Total first-year:** ~$40k-$95k

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-15 | Start with pentest before auditor engagement | Remediate findings first, present cleaner picture to auditor |
| 2026-04-15 | Target Common Criteria (Security) only for first report | Smallest useful scope, covers enterprise requirements |
