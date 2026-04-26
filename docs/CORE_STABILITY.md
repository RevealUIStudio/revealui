---
title: "Core API Stability"
description: "API stability guarantees, versioning policy, and breaking change process for @revealui/core"
category: reference
audience: developer
---

# @revealui/core  -  API Stability Reference

**Version:** 0.6.x
**Last Updated:** 2026-04-26
**Status:** Pre-1.0 (breaking changes possible with minor bumps; see [Version Policy](#version-policy))

---

## Overview

`@revealui/core` is the runtime engine at the centre of RevealUI. It is MIT-licensed and published to npm. This document classifies every public subpath export by stability tier, documents what has been verified in production, and explains what to expect from breaking changes before the 1.0 release.

---

## Stability Tiers

| Tier | Meaning |
|------|---------|
| **Stable** | Production-tested. API will not change without a semver major bump. Safe for production use now. |
| **Beta** | Functional and tested. API design is mostly settled but minor ergonomic changes may land before 1.0. |
| **Experimental** | Built but not production-verified. API may change significantly or be removed. Opt-in only. |

---

## Export Stability

### Stable  -  Production-ready

These exports are the load-bearing core of RevealUI. They are covered by unit and integration tests, have been deployed and verified in production (admin.revealui.com, revealui-api.vercel.app), and will not break without a major version bump.

#### Setup & Instance

| Import | Stability | Notes |
|--------|-----------|-------|
| `import { buildConfig } from '@revealui/core'` | **Stable** | Validates config, merges defaults. Throws `ConfigValidationError` on invalid input. |
| `import { createRevealUI } from '@revealui/core'` | **Stable** | Creates a RevealUI instance. |
| `import { getRevealUI } from '@revealui/core'` | **Stable** | Singleton pattern  -  safe in serverless cold starts. |
| `import { withRevealUI } from '@revealui/core/nextjs'` | **Stable** | Next.js config wrapper. |

#### Collections & Fields

| Import | Stability | Notes |
|--------|-----------|-------|
| `defineCollection` | **Stable** | Collection definition helper. |
| `defineGlobal` | **Stable** | Global singleton definition. |
| `defineField` | **Stable** | Field definition helper. |
| `CollectionConfig`, `GlobalConfig`, `Field` types | **Stable** | TypeScript interfaces. |

#### Instance Methods (CRUD)

| Method | Stability | Notes |
|--------|-----------|-------|
| `revealui.find(options)` | **Stable** | Query with pagination, sorting, filtering, depth population. |
| `revealui.findByID(options)` | **Stable** | Single-document fetch with depth population. |
| `revealui.create(options)` | **Stable** | Create with hooks, validation, and access control. |
| `revealui.update(options)` | **Stable** | Update with hooks and access control. |
| `revealui.delete(options)` | **Stable** | Soft-delete aware. |
| `revealui.login(options)` | **Stable** | Auth-aware login  -  delegates to `@revealui/auth`. |

#### Access Control

| Import | Stability | Notes |
|--------|-----------|-------|
| `anyone` | **Stable** | Always returns `true`. |
| `authenticated` | **Stable** | Returns `true` if request has valid session. |
| `isAdmin({ req })` | **Stable** | Checks `admin` role. |
| `isSuperAdmin({ req })` | **Stable** | Checks `super-admin` role. |
| `hasRole(role)` | **Stable** | Single-role check. |
| `hasAnyRole(roles[])` | **Stable** | Multi-role check. |

#### License & Feature Flags

| Import | Stability | Notes |
|--------|-----------|-------|
| `initializeLicense()` | **Stable** | Validates license key against RSA public key. Fails safe to `free` tier. |
| `isLicensed(tier)` | **Stable** | Gate check  -  `free \| pro \| max \| enterprise`. |
| `getCurrentTier()` | **Stable** | Returns active tier. |
| `isFeatureEnabled(feature)` | **Stable** | Feature flag check per tier. |
| `getFeatures()` | **Stable** | Full feature map for current tier. |
| `getFeaturesForTier(tier)` | **Stable** | Hypothetical feature map (e.g. for upgrade prompts). |

Imports: `@revealui/core/license`, `@revealui/core/features`

#### Logging

| Import | Stability | Notes |
|--------|-----------|-------|
| `createLogger(context?)` | **Stable** | Structured logger with context tagging. |
| `logger` | **Stable** | Default global logger instance. |

Imports: `@revealui/core/observability/logger`, `@revealui/core/utils/logger`, `@revealui/core/utils/logger/server`, `@revealui/core/utils/logger/client`

**Do not use `console.*` directly**  -  all production logging should go through `createLogger`. The `audit:console` script enforces this.

#### Next.js Utilities

| Import | Stability | Notes |
|--------|-----------|-------|
| `@revealui/core/nextjs` | **Stable** | `withRevealUI`, `getServerRevealUI`. |

---

### Beta  -  Mostly settled, minor changes possible

These exports are fully functional and tested but their API surface may see ergonomic tweaks before the 1.0 release. They are safe to use in production with awareness of potential minor changes.

#### REST API Handlers

| Import | Stability | Notes |
|--------|-----------|-------|
| `createRESTHandlers(config)` | **Beta** | Generates Hono-compatible handlers. |
| `handleRESTRequest(req, config)` | **Beta** | Single-request handler. |
| `@revealui/core/api/rest` | **Beta** | The handler shape may gain optional middleware hooks before 1.0. |

**Note:** The REST API surface itself (paths, HTTP verbs, response shapes) follows the OpenAPI spec at `/v1/openapi.json` and is **Stable**. Only the TypeScript handler factory API is Beta.

#### Rate Limiting

| Import | Stability | Notes |
|--------|-----------|-------|
| `checkRateLimit(request, config)` | **Beta** | Sliding window + token bucket, DB-backed. |
| `createRateLimitMiddleware(config)` | **Beta** | Hono middleware factory. |
| `RATE_LIMIT_PRESETS` | **Beta** | Named presets (`api`, `auth`, `strict`). |

Import: `@revealui/core/server`

The security model (IP-based limits, brute force lockout) is hardened and not changing. The configuration API shape may gain additional options.

#### Rich Text (Lexical)

| Import | Stability | Notes |
|--------|-----------|-------|
| `@revealui/core/richtext` | **Beta** | Server-side rich text operations. |
| `@revealui/core/richtext/html` | **Beta** | Serialize Lexical JSON → HTML. |
| `@revealui/core/richtext/react` | **Beta** | React renderer for Lexical JSON. |
| `@revealui/core/richtext/rsc` | **Beta** | RSC renderer (Next.js App Router). |
| `@revealui/core/richtext/client` | **Beta** | Client-side Lexical editor components. |
| `@revealui/core/richtext/lexical` | **Beta** | Direct Lexical node exports. |

Lexical itself (the underlying editor) is at v0.40.x and may introduce node API changes. RevealUI tracks Lexical semver  -  the `HeadingFeature` and node APIs exposed here follow Lexical's own stability guarantees.

#### Collection Hooks

The hook interface (`afterChange`, `beforeChange`, `afterRead`, `beforeValidate`) is **Beta**  -  the shape is established but additional lifecycle events may be added before 1.0.

#### Plugins

| Import | Stability | Notes |
|--------|-----------|-------|
| `formBuilderPlugin(config?)` | **Beta** | Form builder collection plugin. |
| `nestedDocsPlugin(config?)` | **Beta** | Hierarchical document plugin. |
| `redirectsPlugin(config?)` | **Beta** | URL redirect management. |

Import: `@revealui/core/plugins`

Plugin API shape is stable. The set of bundled plugins may expand.

#### Storage

| Import | Stability | Notes |
|--------|-----------|-------|
| `@revealui/core/storage` | **Beta** | File/media upload handlers, Vercel Blob adapter. |

Vercel Blob integration is the primary adapter. The storage adapter interface is designed for extensibility but is not yet fully documented.

#### Authentication Helpers

| Import | Stability | Notes |
|--------|-----------|-------|
| `@revealui/core/auth` | **Beta** | Auth checks, session inspection. |

Full auth implementation lives in `@revealui/auth`. The `@revealui/core/auth` subpath re-exports the access-control surface only.

---

### Experimental  -  Use with caution

These exports are built and included in the package but have not been verified in production and may change significantly before 1.0. They are documented here for transparency, not recommendation.

> **Do not use Experimental exports in production** until they are promoted to Beta.

#### Monitoring

```ts
import { ... } from '@revealui/core/monitoring'
```

`HealthMonitor`, `QueryMonitor`, `ProcessRegistry`, `CleanupManager`, `ZombieDetector`, `AlertManager`. Built and unit-tested but not connected to a production alerting pipeline. API shape may change when the production observability integration is designed.

#### Observability (metrics + tracing)

```ts
import { metrics } from '@revealui/core/observability'
```

`metrics`, `tracing` utilities from `@revealui/core` are scaffolded. The `createLogger` from this path is **Stable**; the `metrics` and `tracing` exports are **Experimental**.

#### Build Optimization

The `@revealui/core` package includes internal optimization utilities (`bundle-analyzer`, `build-optimizer`, `asset-optimizer`) used by the admin build pipeline. These are **not public API** and may be moved to `@revealui/dev` before 1.0. Do not import from subpaths not listed in the package's `exports` map.

#### Error Reporting

```ts
import { ErrorReporter } from '@revealui/core/error-handling/error-reporter'
```

Scaffolded integration for external error reporting. Not connected to a provider in the default setup. Experimental.

#### Security Audit Log

```ts
import { ... } from '@revealui/core/security'
```

`AuditLogger` and `AuthorizationPolicyEngine` are built but the audit log storage and query API is not finalized. The access control helpers (`isAdmin`, etc.) from the main entry point are **Stable** and independent of this.

---

## Production Verification Status

This table reflects what has been exercised against production infrastructure (admin.revealui.com, revealui-api.vercel.app, NeonDB production, Electric on Railway).

| Feature | Verified in Production | Notes |
|---------|----------------------|-------|
| Config validation (`buildConfig`) | ✅ Yes | admin startup on every Vercel deploy |
| Collection CRUD operations | ✅ Yes | admin admin dashboard operations |
| Session auth (login, logout, session) | ✅ Yes | Full flow verified manually + E2E |
| Password reset (email via Gmail) | ✅ Yes | Real email delivery verified |
| Rate limiting (IP + brute force) | ✅ Yes | Confirmed: 5 attempts → 429, brute force lockout |
| License validation | ✅ Yes | Stripe checkout → license key → tier resolution |
| ElectricSQL real-time sync | ✅ Yes | All 3 shape endpoints + row-level auth |
| Webhook idempotency | ✅ Yes | Stripe webhook double-processing prevented (idempotency key) |
| REST API (Hono, `/v1/`) | ✅ Yes | API deployed and serving |
| Rich text (Lexical) | ⚠️ Partial | Integration tested, no production content authored yet |
| Storage (Vercel Blob) | ⚠️ Partial | Code deployed, no production uploads yet |
| Monitoring / health checks | ⚠️ Partial | Health endpoints return live data; alert pipeline not wired |
| AI agents | ❌ Not yet | Pro-only; no production traffic yet |

---

## Security Model

The following security properties are enforced in `@revealui/core` and its dependencies:

### Authentication
- Session tokens are random 32-byte hex (via `crypto.getRandomValues`)  -  not guessable
- Sessions expire after 7 days; short-lived tokens (API keys) after 24 hours
- Password hashing: bcrypt with cost factor 12
- Password reset tokens: hashed with SHA-256 before DB storage (no plaintext tokens in DB)

### Authorisation
- RBAC (`free → pro → max → enterprise`) enforced at the `isLicensed()` and `isFeatureEnabled()` gates
- Collection-level access control via `access` field  -  evaluated on every CRUD operation, not just at the route level
- A2A (agent-to-agent) API requires a signed bearer token; A2A endpoints are separate from user-facing endpoints

### Rate Limiting
- Auth endpoints: 5 attempts per 15 min per IP (sliding window, DB-backed  -  survives cold starts)
- Brute force: email-based lockout after failed attempts
- Rate limit counters are stored in the database  -  not in-memory. Cold starts do not reset them.

### Input Validation
- All public API inputs validated with Zod before processing
- Rich text content sanitised server-side before persistence
- SSR injection prevention: Lexical state is validated before render

### HTTP Security Headers
CSP, CORS, HSTS, and `X-Frame-Options` are managed by `@revealui/core`'s security middleware. See `AUTH.md` for the full security policy.

---

## Version Policy

`@revealui/core` follows [Semantic Versioning](https://semver.org).

### Pre-1.0 (current: 0.x.y)

- **Patch** (0.x.**y**): Bug fixes and security patches only. Safe to upgrade.
- **Minor** (0.**x**.y): May include breaking changes to **Experimental** or **Beta** exports. Stable exports will not break. Upgrade with changelog review.
- **Major** (impossible pre-1.0): No 1.0 until the project exits Phase 3.

### What counts as a breaking change

Breaking changes affect **Stable** exports only. The following are breaking:

- Renaming or removing an exported function or type
- Adding a required parameter to an existing function
- Changing the return type of a function in a way that breaks existing callers
- Removing a subpath export from the `exports` map

The following are **not** breaking:

- Adding new optional parameters
- Adding new exports or subpaths
- Adding new fields to returned objects (additive)
- Internal implementation changes that preserve the observable API
- Changes to **Experimental** or **Beta** exports (these may change at any minor version)

### Upgrade path

Changelogs are published via [Changesets](https://github.com/changesets/changesets) and available in the GitHub release for each version. When a minor version includes Beta export changes, migration notes are included.

---

## Dependency Stability

| Dependency | Version | Notes |
|-----------|---------|-------|
| `lexical` | `^0.40.x` | Tracks Lexical semver. Rich text API stability follows Lexical's own. |
| `zod` | `^4.x` | Schema validation. Zod 4 is a major revision; no Zod 3 compatibility. |
| `jose` | `^6.x` | JWT/JOSE. API stable. |
| `bcryptjs` | `^3.x` | Password hashing. API stable. |
| `@vercel/blob` | `^2.x` | Vercel Blob storage SDK. |
| `yjs` | `^13.x` | CRDT for collaborative editing. Peer dep for real-time use cases. |
| `pg` | `^8.x` | PostgreSQL client. Used internally; not re-exported. |

Peer dependencies: React 18/19 and Next.js 14/15/16 are both supported.

---

## Related

- [Package Reference](./REFERENCE.md)  -  full API documentation for all @revealui/* packages
- [Auth & Security](./AUTH.md)  -  authentication system, RBAC, security policy
- [Architecture](./ARCHITECTURE.md)  -  system design, dual-database, multi-tenant patterns
- [Admin Guide](./ADMIN_GUIDE.md)  -  collections, content management, admin dashboard
