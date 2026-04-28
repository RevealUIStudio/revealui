---
title: Asset Inventory
description: Formal inventory of all services, data stores, third-party processors, and security tooling for SOC 2 compliance.
last-updated: 2026-04-12
review-cadence: quarterly
owner: RevealUI Studio <founder@revealui.com>
classification: internal
---

# Asset Inventory

## 1. Purpose

This document provides a comprehensive inventory of all assets managed under the RevealUI project, including deployed services, data stores, third-party processors, and security tooling. It supports SOC 2 Type II compliance by establishing a baseline for change management, risk assessment, and access reviews.

This inventory covers the RevealUI open-core monorepo (MIT core packages + Fair Source Pro packages) and all associated infrastructure.

## 2. Service Inventory

### 2.1 Deployed Applications

| ID | Service | Type | Framework | Port (dev) | Hosting | Environment | Owner | Data Classification | Status |
|----|---------|------|-----------|------------|---------|-------------|-------|---------------------|--------|
| SVC-001 | api | REST API | Hono (Node 24) | 3004 | Vercel Serverless | Production | Founder | Internal | Active |
| SVC-002 | admin | Web Application | Next.js 16 | 4000 | Vercel | Production | Founder | Internal | Active |
| SVC-003 | marketing | Marketing Site | Next.js | 3000 | Vercel | Production | Founder | Public | Active |
| SVC-004 | docs | Documentation | Vite + React | 3002 | Vercel | Production | Founder | Public | Active |
| SVC-005 | studio | Desktop Application | Tauri 2 + React 19 | N/A | Local distribution | User device | Founder | Internal | Active |
| SVC-006 | terminal | CLI Tool | Go (Bubble Tea) | N/A | Local distribution | User device | Founder | Internal | Active |
| SVC-007 | revealcoin | Token Service | N/A | N/A | TBD | N/A | Founder | Internal | Active |

### 2.2 OSS Packages (MIT License)

| ID | Package | Purpose | Registry | Data Classification |
|----|---------|---------|----------|---------------------|
| PKG-001 | @revealui/core | Admin engine, REST API, auth, rich text, plugins | npm | Public |
| PKG-002 | @revealui/contracts | Zod schemas + TypeScript types (single source of truth) | npm | Public |
| PKG-003 | @revealui/db | Drizzle ORM schema (86 tables), dual-DB support | npm | Public |
| PKG-004 | @revealui/auth | Session auth, password reset, rate limiting | npm | Public |
| PKG-005 | @revealui/presentation | 57 native UI components (Tailwind v4) | npm | Public |
| PKG-006 | @revealui/router | Lightweight file-based router with SSR | npm | Public |
| PKG-007 | @revealui/config | Type-safe env config (Zod + lazy Proxy) | npm | Public |
| PKG-008 | @revealui/utils | Logger, DB helpers, validation | npm | Public |
| PKG-009 | @revealui/cli | `create-revealui` scaffolding tool | npm | Public |
| PKG-010 | @revealui/setup | Environment setup utilities | npm | Public |
| PKG-011 | @revealui/sync | ElectricSQL real-time sync | npm | Public |
| PKG-012 | @revealui/cache | CDN config, edge cache, ISR presets, revalidation | npm | Public |
| PKG-013 | @revealui/resilience | Circuit breaker, retry, bulkhead patterns | npm | Public |
| PKG-014 | @revealui/security | Headers, CORS, RBAC/ABAC, encryption, audit, GDPR | npm | Public |
| PKG-015 | @revealui/dev | Shared configs (Biome, TS, Tailwind) | npm | Public |
| PKG-016 | @revealui/test | E2E specs, integration tests, fixtures, mocks | npm | Public |
| PKG-017 | @revealui/editors | Editor config sync (Zed, VS Code, Cursor) | npm | Public |
| PKG-018 | @revealui/mcp | MCP hypervisor, adapter framework, tool discovery | npm | Public |
| PKG-019 | @revealui/services | Stripe + Supabase integrations | npm | Public |
| PKG-020 | create-revealui | `npm create revealui` initializer | npm | Public |

### 2.3 Pro Packages (Fair Source, FSL-1.1-MIT)

| ID | Package | Purpose | Registry | Data Classification |
|----|---------|---------|----------|---------------------|
| PRO-001 | @revealui/ai | AI agents, CRDT memory, LLM providers, orchestration | npm | Internal |
| PRO-002 | @revealui/harnesses | AI harness adapters, workboard coordination, JSON-RPC | npm | Internal |

## 3. Data Store Inventory

| ID | Store | Type | Provider | Location | Data Classification | Encryption at Rest | Encryption in Transit | Backup Policy | Recovery Objective |
|----|-------|------|----------|----------|---------------------|--------------------|-----------------------|---------------|-------------------|
| DS-001 | NeonDB (Primary) | Managed PostgreSQL | Neon | Cloud (provider-managed) | Confidential | AES-256 (provider-managed) | TLS 1.2+ | Continuous (provider PITR) | RPO: near-zero; RTO: minutes |
| DS-002 | Supabase (Secondary) | Managed PostgreSQL + pgvector | Supabase | Cloud (provider-managed) | Confidential | AES-256 (provider-managed) | TLS 1.2+ | Daily snapshots (provider) | RPO: 24 hours; RTO: hours |
| DS-003 | ElectricSQL Proxy | Real-time sync proxy | Railway | Cloud (Railway) | Internal | Provider-managed | TLS 1.2+ | N/A (stateless proxy) | N/A |
| DS-004 | PGlite (Browser/Test) | In-memory PostgreSQL | Local | Browser or CI runner | Internal | N/A (ephemeral) | N/A (local) | N/A (ephemeral) | N/A |

### 3.1 Data Categories by Store

**NeonDB (DS-001):** Primary relational data across 86 tables.
- User accounts, profiles, and PII (email, name)
- Session tokens and password hashes (bcrypt, 12 rounds)
- Content (pages, products, collections)
- Payment metadata (Stripe customer IDs, subscription IDs; no card numbers)
- Audit logs, API keys, rate limit records
- License and feature gate records
- GDPR consent and anonymization records
- AI agent coordination data, CRDT operations

**Supabase (DS-002):** Vector embeddings, secondary auth, and specialized workloads.
- Vector embeddings for RAG (pgvector)
- OAuth account linkage
- Supabase Auth sessions (where used)
- Cross-DB cleanup targets after site deletion

**ElectricSQL (DS-003):** Stateless sync proxy only. No persistent data storage.

**PGlite (DS-004):** Ephemeral only. Used for browser caching (offline mutation queue) and CI test isolation. No production data.

## 4. Third-Party Processor Inventory

| ID | Processor | Purpose | Data Shared | DPA Status | SOC 2 Status | Last Review | Next Review |
|----|-----------|---------|-------------|------------|--------------|-------------|-------------|
| TP-001 | Vercel | Hosting, CDN, serverless compute, CI deployment | Application code, build artifacts, environment variables, request logs | Covered by Vercel DPA | SOC 2 Type II | 2026-04-12 | 2026-07-12 |
| TP-002 | Stripe | Payment processing, billing | Customer IDs, subscription metadata, webhook events (no card data) | Stripe DPA in effect | SOC 2 Type II, PCI DSS Level 1 | 2026-04-12 | 2026-07-12 |
| TP-003 | GitHub | Source code hosting, CI/CD, package registry, security advisories | Source code, CI logs, secrets (encrypted), security alerts | GitHub DPA in effect | SOC 2 Type II | 2026-04-12 | 2026-07-12 |
| TP-004 | npm (GitHub) | Package distribution (public OSS packages) | Published package source, package metadata | Covered by GitHub DPA | SOC 2 Type II | 2026-04-12 | 2026-07-12 |
| TP-005 | Neon | Managed PostgreSQL (primary database) | All relational data (users, content, payments metadata, sessions) | Neon DPA in effect | SOC 2 Type II | 2026-04-12 | 2026-07-12 |
| TP-006 | Supabase | Managed PostgreSQL + vectors, secondary auth | Vector embeddings, OAuth linkage, secondary auth sessions | Supabase DPA in effect | SOC 2 Type II | 2026-04-12 | 2026-07-12 |
| TP-007 | Railway | ElectricSQL proxy hosting | Sync protocol traffic (encrypted in transit, no persistent storage) | Railway ToS | Review pending | 2026-04-12 | 2026-07-12 |
| TP-008 | Google Workspace | Email (Gmail API for transactional email) | Recipient email addresses, email content | Google Workspace DPA | SOC 2 Type II | 2026-04-12 | 2026-07-12 |

### 4.1 Subprocessor Notes

- **Stripe** is a PCI DSS Level 1 service provider. RevealUI never stores, processes, or transmits cardholder data. Only Stripe customer IDs, subscription IDs, and webhook event metadata are persisted in NeonDB.
- **npm** provenance attestations (SLSA Build Level 2) are generated via OIDC trusted publishing in the release workflow. No long-lived NPM_TOKEN is required.
- **Railway** hosts the ElectricSQL sync proxy, which is stateless. Data passes through encrypted in transit but is not persisted on Railway infrastructure.

## 5. Security Tooling Inventory

### 5.1 CI/CD Pipeline

| ID | Tool | Type | Trigger | Workflow File | Purpose |
|----|------|------|---------|---------------|---------|
| SEC-001 | GitHub Actions (CI) | CI/CD Orchestration | Push/PR to test, main | `ci.yml` | Quality gate: lint, typecheck, test, build |
| SEC-002 | GitHub Actions (Deploy) | Deployment | Push to main, manual dispatch | `deploy.yml` | Production deployment to Vercel |
| SEC-003 | GitHub Actions (Deploy Test) | Deployment | Manual dispatch | `deploy-test.yml` | Staging preview deployments |
| SEC-004 | GitHub Actions (Release) | Package Publishing | Manual dispatch | `release.yml` | npm OIDC publish with SLSA B2 provenance |
| SEC-005 | GitHub Actions (Release Canary) | Canary Publishing | Push to test | `release-canary.yml` | npm snapshot versions for testing |
| SEC-006 | GitHub Actions (Security) | Security Scanning | Push/PR to test, main; weekly cron | `security.yml` | Consolidated security scanning |
| SEC-007 | GitHub Actions (Docker) | Container Build | As configured | `docker.yml` | Docker image builds |

### 5.2 Static Analysis and Scanning

| ID | Tool | Type | Frequency | Scope | Purpose |
|----|------|------|-----------|-------|---------|
| SEC-008 | CodeQL | SAST (Static Application Security Testing) | Every push to test/main | JavaScript, TypeScript | Code-level vulnerability detection (injection, XSS, auth) |
| SEC-009 | Gitleaks | Secret Scanning | Every push (CI) | Full repository history | Detect accidentally committed secrets |
| SEC-010 | Dependabot | Dependency Vulnerability Scanning | Daily | All dependencies | Known CVE detection in dependencies |
| SEC-011 | pnpm audit | Dependency Advisory Check | Every CI gate run | npm advisory database | Advisory database matching |
| SEC-012 | Biome | Linter/Formatter | Every CI gate run, pre-commit | All TypeScript/JavaScript | Code quality, consistency, security lint rules |
| SEC-013 | Custom AST Analyzer | Code Pattern Analysis | CI gate (security phase) | Monorepo source | execSync injection, TOCTOU, ReDoS detection |

### 5.3 Secret Management

| ID | Tool | Type | Owner | Purpose |
|----|------|------|-------|---------|
| SEC-014 | RevVault | Secret Manager (Rust CLI) | Founder | Local secret management, env export |
| SEC-015 | Vercel Environment Variables | Cloud Secret Store | Founder | Production/preview environment secrets |
| SEC-016 | GitHub Secrets | CI Secret Store | Founder | CI/CD pipeline secrets (VERCEL_TOKEN, TURBO_TOKEN) |

### 5.4 Runtime Security Controls

| ID | Control | Package | Purpose |
|----|---------|---------|---------|
| SEC-017 | RBAC + ABAC Policy Engine | @revealui/core | Role-based and attribute-based access control (58 enforcement tests) |
| SEC-018 | Rate Limiting | @revealui/auth | Brute force protection, webhook rate limiting (100 req/min) |
| SEC-019 | Session Auth | @revealui/auth | httpOnly, secure, sameSite=lax cookies; no JWTs |
| SEC-020 | CSP/CORS/HSTS Headers | @revealui/security | Transport and browser security headers |
| SEC-021 | AES-256-GCM Encryption | @revealui/security | Application-layer encryption (non-extractable keys by default) |
| SEC-022 | GDPR Compliance Framework | @revealui/security | Consent, deletion, anonymization |
| SEC-023 | Circuit Breaker | @revealui/resilience | Fault isolation for external service calls |
| SEC-024 | URL Sanitizer | @revealui/core (Lexical) | Blocks javascript:/vbscript:/data: schemes in rich text |
| SEC-025 | Proxy Gate | admin (proxy.ts) | Admin route access control, overrideAccess stripping |
| SEC-026 | License Enforcement | @revealui/core | 5-min DB status check, requireFeature middleware on Pro routes |

## 6. Data Flow Diagram

```
                                    INTERNET
                                       |
                                       v
                              +------------------+
                              |   Vercel CDN     |
                              |   (TP-001)       |
                              +--------+---------+
                                       |
                     +-----------------+------------------+
                     |                 |                  |
                     v                 v                  v
              +-----------+    +------------+    +-------------+
              | marketing |    |   admin    |    |    api      |
              | (SVC-003) |    |  (SVC-002) |    |  (SVC-001)  |
              | Next.js   |    |  Next.js   |    |   Hono      |
              | Public    |    |  Internal  |    |  Internal   |
              +-----------+    +-----+------+    +------+------+
                                     |                  |
                                     +--------+---------+
                                              |
                    +------------+------------+------------+
                    |            |            |            |
                    v            v            v            v
              +---------+  +---------+  +---------+  +---------+
              | NeonDB  |  |Supabase |  |Electric |  | Stripe  |
              |(DS-001) |  |(DS-002) |  |SQL Proxy|  |(TP-002) |
              |Primary  |  |Vectors  |  |(DS-003) |  |Payments |
              |Confid.  |  |Confid.  |  |Internal |  |PCI L1   |
              +---------+  +---------+  +----+----+  +---------+
                                             |
                                             v
                                     +---------------+
                                     | Railway       |
                                     | (TP-007)      |
                                     | Sync Hosting  |
                                     +---------------+

              +------------------+    +------------------+
              | studio (SVC-005) |    | terminal         |
              | Tauri 2 Desktop  |    | (SVC-006)        |
              | Local Device     |    | Go CLI           |
              +--------+---------+    | Local Device     |
                       |              +--------+---------+
                       |                       |
                       +-----------+-----------+
                                   |
                                   v
                            +------+------+
                            |  api        |
                            | (SVC-001)   |
                            | via HTTPS   |
                            +-------------+

              +------------------+
              | docs (SVC-004)   |
              | Vite + React     |
              | Vercel, Public   |
              +------------------+

  CI/CD FLOW:

  Developer --> GitHub (TP-003) --> GitHub Actions --> Vercel (TP-001)
                    |                    |                   |
                    |                    v                   v
                    |              +------------+    +--------------+
                    |              | Security   |    | Production   |
                    |              | Scanning   |    | Deployment   |
                    |              | (CodeQL,   |    +--------------+
                    |              |  Gitleaks, |
                    |              |  pnpm      |
                    |              |  audit)    |
                    |              +------------+
                    |
                    +---> npm (TP-004) [OIDC publish, SLSA B2 provenance]

  SECRET FLOW:

  RevVault (SEC-014) --> Vercel Env Vars (SEC-015) --> Runtime Services
                    \
                     +-> GitHub Secrets (SEC-016) --> CI/CD Pipelines
```

## 7. Data Classification Summary

| Level | Definition | Examples | Controls |
|-------|-----------|----------|----------|
| **Restricted** | Compromise causes critical business or security impact | REVEALUI_KEK (encryption key envelope), Stripe secret keys, database master credentials, session signing keys | RevVault or Vercel env vars only. Never committed to source. Rotated on suspected compromise. Access restricted to founder. |
| **Confidential** | Contains user PII or sensitive business data | User PII (email, name), password hashes, session tokens, TOTP secrets, payment metadata, API keys | Encrypted at rest (AES-256-GCM). TLS in transit. Access logged. GDPR retention policies apply. |
| **Internal** | Operational data not intended for public access | Admin dashboard, API responses, application logs, error traces, CI/CD configurations, Pro package source | Authenticated access required. PII scrubbed before external sharing. |
| **Public** | Intended for open access | Marketing site, documentation, OSS package source, published npm packages | Reviewed before publish to prevent accidental secret inclusion. Gitleaks scanning on all commits. |

## 8. Review Cadence and Ownership

### 8.1 Review Schedule

| Review | Frequency | Owner | Scope | Output |
|--------|-----------|-------|-------|--------|
| Asset Inventory Review | Quarterly | Founder | All sections of this document | Updated ASSET_INVENTORY.md, change log entry |
| Third-Party Processor Review | Quarterly | Founder | Section 4 (DPA status, SOC 2 reports, data shared) | Updated processor table, risk notes |
| Access Control Audit | Quarterly | Founder | GitHub org, Vercel, NeonDB, Supabase, Stripe access | Access review log, revocations if needed |
| Dependency Vulnerability Review | Weekly (automated), monthly (manual) | Founder | Dependabot alerts, pnpm audit, CodeQL findings | Remediation PRs, risk acceptance notes |
| Security Tooling Effectiveness | Semi-annually | Founder | Sections 5.1 through 5.4 | Tool coverage report, gap analysis |
| Data Flow Review | Semi-annually | Founder | Section 6 | Updated diagrams, new integration assessment |
| Backup and Recovery Test | Semi-annually | Founder | DS-001, DS-002 | Recovery test results, RTO/RPO validation |
| Incident Response Drill | Annually | Founder | INCIDENT_RESPONSE.md procedures | Drill report, procedure updates |

### 8.2 Change Management

Any changes to this inventory (new services, new processors, data store additions, classification changes) must be:

1. Documented in a PR with the `security` label.
2. Reviewed against the Information Security Policy (`docs/security/INFORMATION_SECURITY_POLICY.md`).
3. Approved by the Security Lead (currently Founder).
4. Reflected in this document before or at the next quarterly review.

### 8.3 Ownership Matrix

| Area | Primary Owner | Backup | Escalation |
|------|--------------|--------|------------|
| All services (SVC-*) | Founder | N/A (solo project) | security@revealui.com |
| All data stores (DS-*) | Founder | N/A | security@revealui.com |
| All third-party processors (TP-*) | Founder | N/A | security@revealui.com |
| All security tooling (SEC-*) | Founder | N/A | security@revealui.com |
| This document | Founder | N/A | founder@revealui.com |

As the project grows and contributors join, this matrix will be expanded to include delegated ownership for non-sensitive areas. Security-sensitive areas (auth, crypto, payments, infrastructure access) will require founder approval for all changes.

## 9. Related Documents

- [Information Security Policy](./INFORMATION_SECURITY_POLICY.md): Data classification definitions, access control policies, encryption standards.
- [Incident Response Plan](./INCIDENT_RESPONSE.md): Detection, response, and recovery procedures.
- [SECURITY.md](/SECURITY.md): Public vulnerability disclosure policy.

## 10. Change Log

| Date | Author | Change |
|------|--------|--------|
| 2026-04-12 | RevealUI Studio | Initial asset inventory created for SOC 2 compliance. |
