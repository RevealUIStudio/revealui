---
title: Change Management Policy
description: Formal change management procedures covering code review, deployment approvals, rollback, and emergency changes for SOC 2 compliance.
last-updated: 2026-04-12
review-cadence: annually
owner: RevealUI Studio <founder@revealui.com>
classification: internal
---

# Change Management Policy

## 1. Purpose

This policy formalizes the change management procedures for all modifications to RevealUI source code, infrastructure, and configuration. It ensures that changes are reviewed, tested, approved, and deployed in a controlled manner with appropriate rollback capabilities.

## 2. Scope

This policy covers:

- **Source code changes**: All modifications to the RevealUI monorepo (packages and apps)
- **Infrastructure changes**: Vercel configuration, database schema migrations, DNS and domain changes
- **Configuration changes**: Environment variables, CI/CD workflows, security policies
- **Dependency changes**: Package additions, updates, and removals

## 3. Change Categories

| Category | Definition | Approval | Testing | Examples |
|----------|-----------|----------|---------|----------|
| Standard | Planned changes following the normal pipeline | CI gate pass | Full gate (lint, typecheck, test, build) | Feature PRs, bug fixes, dependency updates |
| Expedited | Urgent changes for high-severity issues | Security Lead approval | Abbreviated gate (affected tests only) | High CVE patches, critical bug fixes |
| Emergency | Changes required during active incidents | Post-hoc review within 48 hours | Minimum viable validation | Incident response hotfixes, credential rotation |
| Documentation | Changes to docs, policies, or non-code assets | CI gate pass | Lint check only | Policy updates, README changes, doc fixes |

## 4. Standard Change Process

### 4.1 Branch Pipeline

All standard changes follow the branch pipeline:

```
feature/* ──PR──> test ──PR──> main
                   |            |
             CI + canary    production deploy
```

| Branch | Environment | CI Gate | Deploy |
|--------|------------|---------|--------|
| `feature/*` | Local development | PR-level: affected typecheck + build, unit tests | None |
| `test` | QA/staging | Full gate: lint, typecheck, tests, build | Manual only (preview URLs) |
| `main` | Production | Full gate + integration + E2E | Automatic (push triggers `deploy.yml`) |

### 4.2 Pull Request Requirements

Every code change must be submitted as a pull request. PRs must satisfy:

1. **CI gate pass**: All three phases must pass (quality, typecheck, test+build).
2. **Conventional commit messages**: Format `type(scope): description` (e.g., `feat(auth): add MFA enforcement`).
3. **Description**: Clear summary of what changed and why. PRs that fix GitHub issues must include `Closes #N`.
4. **Scope**: PRs should be focused. Avoid bundling unrelated changes unless explicitly justified.

### 4.3 Security-Sensitive Changes

Changes to the following areas require additional scrutiny:

| Area | Packages/Files | Additional Requirements |
|------|---------------|----------------------|
| Authentication | `@revealui/auth`, `apps/api/src/routes/auth*` | Review for bypass vulnerabilities, timing attacks |
| Authorization | `@revealui/core` (RBAC/ABAC), `proxy.ts` | Verify role isolation tests pass (58 tests) |
| Cryptography | `@revealui/security` (encryption, signing) | Review algorithm choices, key management |
| Payments | `@revealui/services` (Stripe), webhook routes | Verify signature validation, rate limiting |
| Database schema | `@revealui/db` (migrations) | Verify backward compatibility, data preservation |
| CI/CD | `.github/workflows/*` | Review for secret exposure, permission escalation |
| Dependencies | `package.json`, `pnpm-lock.yaml` | Check for known vulnerabilities, license compatibility |

### 4.4 Code Review Checklist

Reviewers must verify:

- [ ] No secrets, credentials, or API keys in the diff
- [ ] Input validation present for all external data (Zod schemas from `@revealui/contracts`)
- [ ] No SQL injection risks (parameterized queries via Drizzle ORM)
- [ ] No XSS vulnerabilities (URL sanitization, CSP compliance)
- [ ] No authentication or authorization bypasses
- [ ] Error handling does not leak sensitive information
- [ ] Tests cover the change (unit, integration, or E2E as appropriate)
- [ ] No `any` types introduced without justification
- [ ] No `console.log` statements in production code paths
- [ ] Dependency additions are justified and free of known vulnerabilities

## 5. CI Gate Architecture

The CI gate (`pnpm gate`) enforces quality standards automatically:

### Phase 1: Quality (parallel)

| Check | Type | Failure Mode |
|-------|------|-------------|
| Biome lint | Code quality and security patterns | Hard fail (blocks merge) |
| `pnpm audit:any` | Avoidable `any` type detection | Warn only |
| `pnpm audit:console` | Production console statements | Warn only |
| Structure validation | Package structure checks | Warn only |
| Security audit | AST-based pattern analysis (execSync injection, TOCTOU, ReDoS) | Warn only |

### Phase 2: Type Checking (serial)

| Check | Type | Failure Mode |
|-------|------|-------------|
| `pnpm -r typecheck` | TypeScript strict mode across all workspaces | Hard fail (blocks merge) |

### Phase 3: Test + Build (parallel)

| Check | Type | Failure Mode |
|-------|------|-------------|
| Vitest | 20,000+ tests across 1,704 test files | Hard fail (blocks merge) |
| Turborepo build | Full build across all workspaces | Hard fail (blocks merge) |

### Pre-Push Gate

Protected branches (`main`, `test`) run the full gate before push is accepted. Feature branches run quality-only (Phase 1) checks.

## 6. Deployment Process

### 6.1 Production Deployment

Production deployments are fully automated and triggered only by pushes to `main`:

1. **PR to `main`**: Created from `test` branch after staging validation.
2. **CI gate**: Full gate must pass on the PR.
3. **Merge**: PR is merged to `main`.
4. **Automatic deploy**: `deploy.yml` workflow triggers Vercel production deployment.
5. **Verification**: Post-deploy health checks validate the deployment.

**Controls:**
- Vercel Git Integration is disabled. Deploys are CI-triggered only.
- No manual production deployments permitted.
- Branch protection prevents direct pushes to `main`.

### 6.2 Staging Deployment

Staging (preview) deployments are manually triggered for the `test` branch:

1. **PR to `test`**: Created from feature branch.
2. **CI gate**: Full gate must pass on the PR.
3. **Merge**: PR is merged to `test`.
4. **Manual deploy**: `deploy-test.yml` triggered via `workflow_dispatch`.
5. **Preview URL**: Vercel generates a preview URL for validation.

### 6.3 Canary Releases

npm canary releases are automatically published on pushes to `test`:

1. Push to `test` triggers `release-canary.yml`.
2. Snapshot versions are published (e.g., `0.0.0-canary-20260412T1234`).
3. Canary packages can be tested by early adopters before production release.

## 7. Rollback Procedures

### 7.1 Application Rollback

| Method | Speed | Scope | When to Use |
|--------|-------|-------|-------------|
| Vercel instant rollback | Seconds | Full deployment | Broken deploy, visible user impact |
| Git revert + deploy | Minutes | Specific changes | Isolated regression, need to preserve history |
| Previous deployment promotion | Seconds | Full deployment | Known-good deployment available |

**Rollback decision criteria:**
- User-facing error rate > 1%: Immediate rollback
- Performance degradation > 50%: Immediate rollback
- Non-critical regression: Evaluate fix-forward vs. rollback based on complexity

### 7.2 Database Rollback

| Scenario | Method | RPO | RTO |
|----------|--------|-----|-----|
| Schema migration failure | Reverse migration script | Zero (pre-deploy) | Minutes |
| Data corruption | NeonDB PITR (Point-in-Time Recovery) | Near-zero | Minutes |
| Full database failure | NeonDB automated recovery | Near-zero | Minutes |
| Supabase data issue | Supabase daily snapshot restore | Up to 24 hours | Hours |

### 7.3 Configuration Rollback

Environment variable and configuration changes are tracked via RevVault and Vercel:

1. RevVault maintains version history of all secret values.
2. Vercel environment variables can be rolled back via dashboard or CLI.
3. CI/CD workflow changes are tracked in git history and can be reverted.

## 8. Emergency Change Process

Emergency changes bypass the standard pipeline when required during active incidents:

### 8.1 Authorization

- Emergency changes require Security Lead (Founder) authorization.
- Authorization can be verbal or written, documented post-hoc.

### 8.2 Process

1. **Assess**: Determine if an emergency change is necessary (standard process too slow for incident severity).
2. **Implement**: Make the minimum change required to resolve the incident.
3. **Deploy**: Use expedited deployment (direct Vercel CLI deploy if CI is blocked).
4. **Validate**: Verify the change resolves the incident.
5. **Document**: Within 48 hours, create a post-hoc PR with:
   - Description of the emergency change
   - Justification for bypassing standard process
   - Tests covering the change
   - Link to the incident record

### 8.3 Post-Emergency Review

All emergency changes are reviewed in the next quarterly access review:

- Was the emergency justified?
- Could the standard process have been used with acceptable delay?
- Are process improvements needed to prevent similar emergencies?

## 9. Version Management

### 9.1 Semantic Versioning

All packages follow semantic versioning (SemVer):

- **Major**: Breaking API changes
- **Minor**: New features, backward-compatible
- **Patch**: Bug fixes, backward-compatible

### 9.2 Changeset Workflow

Version bumps use the changeset workflow:

1. `pnpm changeset`: Create a changeset describing the change.
2. `pnpm changeset:version`: Apply version bumps across affected packages.
3. `pnpm changeset:publish`: Publish to npm with OIDC provenance attestation.

### 9.3 Package Version Protection

The `package.json` `version` field is protected by pre-tool-use hooks. Direct version edits are blocked. All version changes must go through `pnpm changeset`.

## 10. Audit Trail

All changes are tracked through multiple mechanisms:

| Mechanism | What It Tracks | Retention |
|-----------|---------------|-----------|
| Git history | All source code changes, commit messages, authors | Permanent |
| GitHub PR history | Review comments, approval status, CI results | Permanent |
| Vercel deployment log | Deploy timestamps, commit SHAs, deploy status | Per Vercel retention policy |
| RevVault history | Environment variable changes | Per RevVault retention |
| Audit log (application) | Runtime configuration changes, admin actions | Per database retention policy |

## 11. Policy Review

This policy is reviewed and updated:

- Annually, or more frequently if significant process changes occur.
- After any incident where the change management process failed or was insufficient.
- When new team members join and the approval workflow needs to expand.

Last reviewed: 2026-04-12.

## 12. Related Documents

- [Information Security Policy](./INFORMATION_SECURITY_POLICY.md): Security standards that changes must comply with.
- [Incident Response Plan](./INCIDENT_RESPONSE.md): Emergency procedures that may trigger emergency changes.
- [Asset Inventory](./ASSET_INVENTORY.md): Systems affected by changes.
- [Access Review Policy](./ACCESS_REVIEW_POLICY.md): Access controls governing who can make changes.
- [Vendor Risk Assessments](./VENDOR_RISK_ASSESSMENTS.md): Third-party systems affected by infrastructure changes.

## 13. Change Log

| Date | Author | Change |
|------|--------|--------|
| 2026-04-12 | RevealUI Studio | Initial change management policy formalizing existing branch pipeline and CI gate. |
