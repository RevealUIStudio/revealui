---
title: Information Security Policy
description: Security policies governing the RevealUI open-source project, covering data protection, access control, encryption, and compliance.
last-updated: 2026-04-12
---

# Information Security Policy

## 1. Purpose

This policy defines how RevealUI protects user data, application secrets, and infrastructure across its open-core monorepo (MIT core + Fair Source Pro packages). It applies to all code, services, and data managed under the RevealUI project.

## 2. Scope

This policy covers:

- **Source code**: The RevealUI monorepo (all packages and apps)
- **Production infrastructure**: Vercel deployments, NeonDB databases, Supabase instances, Stripe payment processing
- **User data**: Account information, session tokens, content stored in RevealUI-powered applications
- **Secrets**: API keys, database credentials, encryption keys, webhook signing secrets
- **CI/CD**: GitHub Actions pipelines, automated testing, deployment workflows

This policy does not cover self-hosted instances of RevealUI. Self-hosters are responsible for their own security posture, though we provide guidance in the documentation.

## 3. Roles and Responsibilities

RevealUI is currently maintained by a solo developer (RevealUI Studio, founder@revealui.com). As the project grows, responsibilities will be distributed as follows:

| Role | Current Owner | Responsibilities |
|------|--------------|-----------------|
| Security Lead | Founder | Vulnerability triage, incident response, security reviews |
| Release Manager | Founder | Dependency updates, CI gate maintenance, publish workflow |
| Code Reviewer | Founder + community | PR security review, access control audits |
| Infrastructure | Founder | Vercel, NeonDB, Supabase, Stripe configuration |

**Growth plan**: As contributors join, security-sensitive areas (auth, crypto, payments) require founder approval for all changes. Community contributors may own non-sensitive packages after establishing trust through multiple accepted PRs.

## 4. Data Classification

| Classification | Examples | Handling |
|---------------|----------|----------|
| **Critical** | Database credentials, Stripe secret keys, encryption keys, signing secrets | Stored in RevVault or Vercel environment variables. Never committed to source. Rotated on suspected compromise. |
| **Sensitive** | User PII (email, name), session tokens, password hashes, TOTP secrets | Encrypted at rest (AES-256-GCM). Transmitted over TLS only. Access logged. Retained per GDPR policy. |
| **Internal** | API response data, application logs, error traces | Access restricted to authenticated admin users. Scrubbed of PII before external sharing. |
| **Public** | Documentation, marketing content, open-source code | No restrictions on access. Reviewed before publish to avoid accidental secret inclusion. |

### Payment Data

RevealUI does not store credit card numbers or payment method details. All payment processing is handled by Stripe. We store only Stripe customer IDs, subscription IDs, and webhook event metadata.

## 5. Access Control

### Authentication

- **Session-based auth**: httpOnly, secure, sameSite=lax cookies. No JWTs for user sessions.
- **Password hashing**: bcrypt with 12 salt rounds.
- **MFA**: TOTP-based multi-factor authentication available for all accounts.
- **OAuth**: GitHub, Google, and other providers via standardized OAuth flow.
- **Brute force protection**: Rate limiting on authentication endpoints with progressive lockout.

### Authorization

- **RBAC + ABAC**: Role-based access control combined with attribute-based policies. 58 enforcement tests verify role isolation.
- **Collection-level access**: Every database operation enforces `access.read`, `access.update`, and `access.delete` policies.
- **Admin gate**: Proxy middleware checks role cookies for /admin routes (defense-in-depth).
- **Feature gating**: Pro features require valid license checks via `isLicensed('pro')` and `isFeatureEnabled()`.
- **`overrideAccess` stripping**: External requests have `overrideAccess` params stripped at the proxy layer.

### Infrastructure Access

- **GitHub**: Two-factor authentication required. Branch protection on `main` and `test`.
- **Vercel**: SSO via GitHub. Production deployments only from `main` branch via CI.
- **NeonDB**: Connection strings stored in Vercel environment variables. IP allowlisting where supported.
- **Supabase**: Service role keys restricted to server-side use only. Anon keys have RLS policies.
- **Stripe**: Secret keys in Vercel environment variables. Webhook endpoints verify signatures.

## 6. Encryption Standards

### In Transit

- All production traffic served over TLS 1.2+ (enforced by Vercel).
- HSTS headers enabled with `includeSubDomains`.
- Internal service calls (API to database) use TLS-encrypted connections.

### At Rest

- **Application-level encryption**: AES-256-GCM for sensitive fields via `@revealui/security`.
- **Key management**: Non-extractable CryptoKey objects by default (configurable via `extractable` option).
- **Signing**: HMAC-SHA256 for webhook verification and signed cookies.
- **Timing-safe comparisons**: All secret comparisons use constant-time functions to prevent timing attacks.
- **Database encryption**: NeonDB and Supabase provide encryption at rest by default.

### Secrets Management

- Production secrets managed via Vercel environment variables and RevVault.
- Local development uses `.env` files (gitignored, never committed).
- CI secrets stored in GitHub Actions encrypted secrets.
- Pre-commit hooks (Gitleaks) scan for accidental secret commits.

## 7. Dependency Management

### Automated Scanning

- **Dependabot**: Automated PRs for dependency updates across the monorepo.
- **CodeQL**: Static analysis on every push to `test` and `main` branches.
- **Gitleaks**: Secret scanning in CI to catch accidental credential commits.
- **pnpm audit**: Run as part of the CI gate (warn-only, tracked).

### Version Pinning

- 36 pnpm overrides enforce minimum safe versions for transitive dependencies.
- Critical security patches (e.g., React 19.2.4 for CVE-2025-55182) are applied immediately.
- `pnpm deps:check` (syncpack) verifies version consistency across workspaces.

### Update Policy

| Severity | Response Time | Process |
|----------|--------------|---------|
| Critical CVE in production dep | Same day | Hotfix branch, expedited review, deploy |
| High CVE | Within 3 days | Standard PR, CI gate, deploy |
| Medium/Low CVE | Next release cycle | Batch with other updates |

## 8. Secure Development

### CI Gate (3-phase)

All changes pass through the CI gate before reaching `test` or `main`:

1. **Quality** (parallel): Biome lint (hard fail), security audits (warn), structure checks (warn)
2. **Type checking** (serial): TypeScript strict mode across all 31 workspaces
3. **Test + Build** (parallel): Vitest (full suite, hard fail), Turborepo build verification

### Branch Pipeline

```
feature/* --PR--> test --PR--> main
                   |            |
              CI + canary    production deploy
```

- Feature branches: PR-level checks (affected typecheck + build, unit tests)
- `test` branch: Full gate, canary npm releases, manual preview deploys
- `main` branch: Full gate + integration + E2E, automatic production deploy

### Code Review Requirements

- All PRs require CI gate pass before merge.
- Security-sensitive changes (auth, crypto, payments, access control) require explicit review of the diff for:
  - Injection vulnerabilities (SQL, XSS, command injection)
  - Authentication/authorization bypasses
  - Insecure cryptographic usage
  - Accidental secret exposure

### Input Validation

- All external input validated with Zod schemas from `@revealui/contracts`.
- Rich text sanitization: `isSafeUrl()` blocks `javascript:`, `vbscript:`, and `data:` URIs in Lexical rendering.
- SQL injection prevention via Drizzle ORM parameterized queries.
- Webhook rate limiting: 100 requests/minute on `/api/webhooks`.

## 9. Audit and Compliance

### GDPR Framework

RevealUI includes a GDPR compliance framework in `@revealui/security`:

- **Consent management**: Tracking and enforcement of user consent.
- **Data deletion**: Full user data deletion workflow across both databases.
- **Data anonymization**: PII anonymization for retained analytics.
- **Cross-DB cleanup**: `@revealui/db/cleanup` handles orphaned Supabase data after site deletion.

### Audit Logging

- Authentication events (sign-in, sign-out, failed attempts, MFA challenges) are logged.
- Admin actions (content changes, user management, configuration updates) are logged.
- API access patterns tracked via Vercel analytics.

### Compliance Audits

- `pnpm audit:any`: Tracks avoidable `any` types (type safety metric).
- `pnpm audit:console`: Finds production console statements (information leakage risk).
- `pnpm preflight`: 15-point pre-launch checklist covering security, performance, and correctness.

## 10. Acceptable Use

### For Contributors

- Do not commit secrets, credentials, or API keys. Use environment variables.
- Do not disable security features (CSP, rate limiting, access control) without explicit approval.
- Report security issues privately via security@revealui.com, not in public issues.
- Follow the vulnerability reporting process in [SECURITY.md](/SECURITY.md).

### For Self-Hosted Users

- Keep your RevealUI installation updated to receive security patches.
- Configure CSP, CORS, and HSTS headers for your deployment.
- Use HTTPS in production. Never serve authentication over HTTP.
- Rotate secrets periodically, especially after personnel changes.
- Enable rate limiting on all public-facing endpoints.
- Review and restrict database access to the minimum required permissions.

## 11. Policy Review

This policy is reviewed and updated:

- After any security incident.
- When significant infrastructure changes are made.
- At minimum, every 6 months.

Last reviewed: 2026-04-12.

For vulnerability reporting, see [SECURITY.md](/SECURITY.md).
For incident response procedures, see [INCIDENT_RESPONSE.md](./INCIDENT_RESPONSE.md).
