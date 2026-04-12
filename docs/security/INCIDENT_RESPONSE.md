---
title: Incident Response Plan
description: Procedures for detecting, responding to, and recovering from security incidents in the RevealUI project.
last-updated: 2026-04-12
---

# Incident Response Plan

## 1. Purpose

This document defines how RevealUI detects, responds to, and recovers from security incidents. It covers the production infrastructure (Vercel, NeonDB, Supabase, Stripe) and the open-source supply chain (npm, GitHub).

## 2. Contacts

| Role | Contact | Method |
|------|---------|--------|
| Security Lead | RevealUI Studio | security@revealui.com |
| Founder (primary) | RevealUI Studio | founder@revealui.com |
| GitHub Security | GitHub | Security advisories on repo |
| External reporters | Community | security@revealui.com |

As the team grows, an on-call rotation will be established. Currently, the founder handles all incident response.

## 3. Severity Levels

| Level | Definition | Examples | Target Response | Target Resolution |
|-------|-----------|----------|----------------|-------------------|
| **P0 - Critical** | Active exploitation or data breach. User data at risk. | Database credentials leaked publicly. Active unauthorized access to production. User PII exposed to unauthorized parties. | 1 hour | 4 hours |
| **P1 - High** | Exploitable vulnerability, no evidence of active exploitation. | Critical CVE in production dependency. Auth bypass discovered in testing. Stripe webhook signing key compromised. | 4 hours | 24 hours |
| **P2 - Medium** | Vulnerability with limited impact or significant mitigating controls. | Medium-severity dependency CVE. CORS misconfiguration. Rate limiting bypass on non-auth endpoint. | 24 hours | 1 week |
| **P3 - Low** | Minor issue, no immediate user impact. | Low-severity dependency CVE. Informational security header missing. Audit finding with no exploit path. | 1 week | Next release cycle |

## 4. Detection Methods

### Automated

| Tool | What It Detects | Frequency |
|------|----------------|-----------|
| **CodeQL** | Code-level vulnerabilities (injection, XSS, auth issues) | Every push to `test`/`main` |
| **Gitleaks** | Secrets accidentally committed to source | Every push (CI) |
| **Dependabot** | Known CVEs in dependencies | Daily |
| **pnpm audit** | npm advisory database matches | Every CI gate run |
| **Vercel analytics** | Traffic anomalies, error rate spikes | Continuous |
| **Stripe webhooks** | Failed payment anomalies, disputed charges | Continuous |
| **NeonDB monitoring** | Connection anomalies, query performance | Continuous |

### Manual

- **User reports**: Submitted to security@revealui.com per [SECURITY.md](/SECURITY.md).
- **Code review**: Security-focused review of auth, crypto, and payment changes.
- **Periodic audits**: `pnpm preflight` (15-point checklist), `pnpm audit:any`, `pnpm audit:console`.

## 5. Response Procedures

### Phase 1: Triage (all severities)

1. **Confirm the incident.** Reproduce or verify the report. Distinguish false positives from real issues.
2. **Assign severity.** Use the table in Section 3. When in doubt, escalate (treat as higher severity).
3. **Create a private tracking issue.** Use GitHub Security Advisories for P0/P1. Use a private issue or local notes for P2/P3.
4. **Preserve evidence.** Screenshot dashboards, save logs, note timestamps. Do not modify production state before documenting the current state.

### Phase 2: Containment

**P0/P1:**
- Rotate any compromised credentials immediately (see runbooks below).
- If active exploitation is confirmed, consider taking the affected service offline via Vercel.
- Revoke affected sessions by rotating the session signing key.
- Block attacking IPs via Vercel firewall rules if applicable.

**P2/P3:**
- Apply mitigations (WAF rules, config changes) if available.
- Schedule fix in the next release cycle.

### Phase 3: Remediation

1. **Develop the fix** on a private branch (for P0/P1) or a standard feature branch (P2/P3).
2. **Run the full CI gate**: `pnpm gate` (lint, typecheck, 20,000+ tests, build).
3. **Deploy via the standard pipeline**: feature branch, PR to `test`, verify on staging, PR to `main`, production deploy.
4. **For P0**: Skip the `test` branch soak. Merge directly to `main` after CI passes.

### Phase 4: Recovery

1. Verify the fix is live in production.
2. Monitor Vercel analytics and logs for recurrence.
3. Re-enable any services taken offline during containment.
4. Notify affected users if required (see Section 6).

### Phase 5: Post-Incident Review

Conduct within 72 hours of resolution. Document:

- **Timeline**: When was the vulnerability introduced? When was it detected? When was it fixed?
- **Root cause**: What allowed this to happen?
- **Detection gap**: Why did automated tooling miss it (if applicable)?
- **Improvements**: What changes to code, process, or tooling would prevent recurrence?
- **Action items**: Specific tasks with owners and deadlines.

Store post-incident reports in `docs/security/incidents/` (private repo) or as GitHub Security Advisories.

## 6. Communication Plan

### Internal (P0/P1)

1. Founder becomes aware (alert, report, or automated notification).
2. Begin response immediately. Log all actions with timestamps.
3. If the incident involves contributor-accessible resources, notify affected contributors directly.

### External Notification

| Audience | When to Notify | Method | Timeline |
|----------|---------------|--------|----------|
| Affected users | PII breach, account compromise | Email to affected accounts | Within 72 hours (GDPR requirement) |
| All users | Service outage, forced password reset | Status page, email, GitHub Discussions | As soon as containment is in place |
| Security reporters | Their reported vulnerability is fixed | Direct email reply | Upon fix deployment |
| npm consumers | Compromised package published | GitHub Advisory + npm advisory | Immediately upon discovery |
| Regulatory bodies | GDPR-qualifying breach (EU user data) | Formal notification | Within 72 hours |

### Disclosure

- P0/P1 vulnerabilities: Coordinate disclosure with the reporter (per [SECURITY.md](/SECURITY.md) safe harbor policy). Publish a GitHub Security Advisory after the fix is deployed.
- Dependency vulnerabilities: Reference the upstream CVE. Document any RevealUI-specific impact.

## 7. Incident Runbooks

### 7.1 Compromised Database Credentials

**Indicators**: Unauthorized queries in NeonDB logs, credential found in public repo, Gitleaks alert.

1. **Rotate immediately**:
   - NeonDB: Generate new connection string in the Neon console. Update Vercel environment variables.
   - Supabase: Rotate service role key and anon key in Supabase dashboard. Update Vercel environment variables.
2. **Redeploy**: Trigger production deploy from `main` to pick up new environment variables.
3. **Audit**: Review NeonDB and Supabase query logs for unauthorized access during the exposure window.
4. **Check for data exfiltration**: Compare row counts, check for bulk SELECT queries, review access patterns.
5. **If data was accessed**: Escalate to data breach runbook (7.3).

### 7.2 Compromised API Keys (Stripe, Third-Party)

**Indicators**: Unexpected Stripe charges, API key found in logs or public repo, Gitleaks alert.

1. **Revoke the key immediately** in the provider's dashboard (Stripe, GitHub, etc.).
2. **Generate a new key** and update Vercel environment variables.
3. **Redeploy** production to pick up the new key.
4. **Stripe-specific**:
   - Review recent charges and refund any unauthorized transactions.
   - Rotate the webhook signing secret. Update the endpoint configuration.
   - Check for unauthorized Connected Accounts or API activity.
5. **Audit**: Review the provider's API logs for unauthorized usage during the exposure window.
6. **If RevVault was the source**: Rotate the RevVault master key and re-encrypt all stored secrets.

### 7.3 Data Breach (User PII Exposed)

**Indicators**: Unauthorized database access confirmed, PII found in public logs, user report of account compromise.

1. **Contain**: Rotate all database credentials (runbook 7.1). Revoke all active sessions by rotating the session signing key.
2. **Assess scope**: Identify which users and what data types were exposed. Check both NeonDB and Supabase.
3. **Notify affected users** within 72 hours with:
   - What data was exposed
   - What actions RevealUI has taken
   - What actions the user should take (password reset, MFA review)
4. **Force password reset** for affected accounts if passwords or hashes were exposed.
5. **Regulatory notification**: If EU user data was involved, file GDPR breach notification within 72 hours.
6. **GDPR tooling**: Use `@revealui/security` GDPR framework for data subject notifications and audit trail.

### 7.4 Critical Dependency Vulnerability

**Indicators**: Dependabot alert, npm advisory, CVE announcement for a production dependency.

1. **Assess impact**: Is the vulnerable code path reachable in RevealUI's usage? Check with CodeQL and manual review.
2. **If exploitable in our usage**:
   - Add a pnpm override to force the patched version: `pnpm.overrides` in root `package.json`.
   - Run `pnpm install` and verify with `pnpm ls <package>`.
   - Run `pnpm gate` to confirm nothing breaks.
   - Deploy via expedited pipeline (P1 process).
3. **If not exploitable**: Document the accepted risk (like the `@tootallnate/once` low-severity issue). Track for future resolution.
4. **If no patch exists**: Evaluate workarounds, alternative packages, or code-level mitigations.

### 7.5 DDoS or Service Outage

**Indicators**: Vercel error rate spike, 5xx responses, deployment health check failures, user reports.

1. **Confirm scope**: Check Vercel dashboard for deployment status, error rates, and regional availability.
2. **If DDoS**:
   - Enable Vercel's DDoS protection features (if not already active).
   - Identify attack patterns (IP ranges, request patterns) from Vercel analytics.
   - Apply IP blocking via Vercel firewall rules.
   - If Vercel-level mitigation is insufficient, contact Vercel support.
3. **If application error**:
   - Check recent deployments. Roll back via Vercel dashboard if a recent deploy caused the issue.
   - Check NeonDB and Supabase status pages for upstream outages.
   - Check Stripe status for payment-related failures.
4. **Communicate**: Post status update if outage exceeds 30 minutes.

### 7.6 Unauthorized Access (Admin Account Compromise)

**Indicators**: Unexpected admin actions in audit logs, user reports of unauthorized changes, session anomalies.

1. **Revoke the compromised session**: Rotate the session signing key to invalidate all active sessions.
2. **Force password reset** for the compromised account.
3. **Review audit logs**: Identify all actions taken by the compromised session.
4. **Check for persistence**: Look for new admin accounts, modified access control rules, or changed OAuth configurations.
5. **Undo malicious changes**: Revert any unauthorized content, user, or configuration changes.
6. **Strengthen defenses**: Require MFA for all admin accounts. Review and tighten RBAC policies.

## 8. Tooling Quick Reference

| Action | Command / Location |
|--------|-------------------|
| Run full security gate | `pnpm gate` |
| Check for leaked secrets | `pnpm exec gitleaks detect` |
| Audit dependencies | `pnpm audit` |
| Check type safety | `pnpm audit:any` |
| Check for console leaks | `pnpm audit:console` |
| Pre-launch checklist | `pnpm preflight` |
| Rotate Vercel env vars | Vercel Dashboard > Settings > Environment Variables |
| Rotate NeonDB credentials | Neon Console > Connection Details > Reset Password |
| Rotate Supabase keys | Supabase Dashboard > Settings > API |
| Rotate Stripe keys | Stripe Dashboard > Developers > API Keys > Roll Key |
| Invalidate sessions | Rotate `SESSION_SECRET` in Vercel env vars + redeploy |
| View Vercel deployment logs | Vercel Dashboard > Deployments > Functions |

## 9. Plan Maintenance

This plan is reviewed and updated:

- After every P0 or P1 incident.
- When infrastructure or tooling changes significantly.
- At minimum, every 6 months.

Last reviewed: 2026-04-12.

For vulnerability reporting procedures, see [SECURITY.md](/SECURITY.md).
For security policies and standards, see [INFORMATION_SECURITY_POLICY.md](./INFORMATION_SECURITY_POLICY.md).
