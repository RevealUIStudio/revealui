# Agent-First Feature Lifecycle — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the three-layer feature lifecycle system (roadmap/reality/gaps) with agent rule, remove phantom feature flags, and seed all files from the codebase audit.

**Architecture:** Structured YAML files across two repos — roadmap targets and gap files in private `revealui-jv`, reality docs in public `RevealUI`. An agent rule in `revealui-jv/.claude/rules/` teaches agents how to read, work, and update these files. One code change removes phantom feature flags from `features.ts`.

**Tech Stack:** YAML files, markdown agent rule, TypeScript (features.ts edit)

**Spec:** `docs/superpowers/specs/2026-03-11-agent-first-feature-lifecycle-design.md`

---

## Chunk 1: Code Changes + Directory Scaffolding

### Task 1: Remove phantom feature flags from features.ts

**Files:**
- Modify: `~/projects/RevealUI/packages/core/src/features.ts`

- [ ] **Step 1: Read features.ts and locate phantom flags**

Read the file. Search for `editors` and `harnesses` in both the `FeatureFlags` interface and `featureTierMap`. Note their actual line numbers (may have shifted from the audit snapshot).

- [ ] **Step 2: Remove editors and harnesses from FeatureFlags interface**

Remove these two lines from the interface:
```typescript
  /** Editor integration daemon */
  editors: boolean;
  /** AI harness integration (Claude Code, Cursor, Copilot coordination) */
  harnesses: boolean;
```

- [ ] **Step 3: Remove editors and harnesses from featureTierMap**

Remove these two lines from the map:
```typescript
  editors: 'pro',
  harnesses: 'pro',
```

- [ ] **Step 4: Verify typecheck passes**

Run: `pnpm --filter @revealui/core typecheck`
Expected: PASS (no consumers reference these flags in the public repo)

- [ ] **Step 5: Run gate:quick to confirm no breakage**

Run: `pnpm gate:quick`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
cd ~/projects/RevealUI
git add packages/core/src/features.ts
git commit -m "feat(core): remove editors/harnesses phantom feature flags

These features are not implemented. Flags moved to roadmap YAML
in the private repo. Will return when implementations ship.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

### Task 2: Remove harnesses reference from PRO.md

**Files:**
- Modify: `~/projects/revealui-jv/docs/PRO.md`

- [ ] **Step 1: Search PRO.md for the harnesses reference**

Search the file for `isFeatureEnabled('harnesses')`. Read ±5 lines of surrounding context to ensure removing just that line doesn't break document structure.

- [ ] **Step 2: Remove the line**

Remove the line containing `isFeatureEnabled('harnesses')`.

- [ ] **Step 3: Commit**

```bash
cd ~/projects/revealui-jv
git add docs/PRO.md
git commit -m "chore(docs): remove harnesses feature flag reference

Feature not implemented. Roadmap target at docs/roadmap/harnesses.yml.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

### Task 3: Create ADR for agent-first principle

**Files:**
- Create: `~/projects/RevealUI/docs/architecture/ADR-001-agent-first.md`

- [ ] **Step 1: Create directory**

```bash
mkdir -p ~/projects/RevealUI/docs/architecture
```

- [ ] **Step 2: Write ADR**

```markdown
# ADR-001: Agent-First, Human-Readable

**Date:** 2026-03-11
**Status:** Accepted

## Context

The codebase audit revealed a strong API layer (A-) alongside a skeletal admin UI. No explicit decision existed about which interface is primary.

## Decision

Every system in RevealUI has two interfaces:

1. **Programmatic surface:** Structured data (YAML, JSON, OpenAPI, Zod schemas) that agents and automated tools parse deterministically. This is the primary interface.

2. **Human surface:** Rendered views produced on demand when a human requests information. Browser-based UIs, dashboards, and documentation sites are renderers — projections of the programmatic surface.

The programmatic surface is built first. The human surface is built on top of it.

### Two distinct programmatic surfaces

- **Product programmatic surface:** End-user agents and integrations consume the REST API via OpenAPI.
- **Development programmatic surface:** Development agents consume roadmap/reality/gap YAML files to manage feature lifecycle.

### Priority implication

When triaging work, programmatic surface gaps outrank human surface gaps at the same severity level.

## Consequences

- Admin UI work is deprioritized relative to API completeness
- All new features must have an API/structured interface before any UI
- Feature flags only exist for implemented features; aspirational features live in roadmap YAML
- Absence of a reality doc signals a feature is not implemented — no placeholder files for planned features
```

- [ ] **Step 3: Commit**

```bash
cd ~/projects/RevealUI
git add docs/architecture/ADR-001-agent-first.md
git commit -m "docs(architecture): add ADR-001 agent-first principle

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

### Task 4: Scaffold directories

- [ ] **Step 1: Create directories in both repos**

```bash
mkdir -p ~/projects/RevealUI/docs/features
mkdir -p ~/projects/revealui-jv/docs/roadmap
mkdir -p ~/projects/revealui-jv/docs/gaps
```

- [ ] **Step 2: Add .gitkeep to empty directories**

```bash
touch ~/projects/RevealUI/docs/features/.gitkeep
touch ~/projects/revealui-jv/docs/roadmap/.gitkeep
touch ~/projects/revealui-jv/docs/gaps/.gitkeep
```

- [ ] **Step 3: Commit scaffolding in both repos**

```bash
cd ~/projects/RevealUI
git add docs/features/.gitkeep
git commit -m "chore: scaffold docs/features for reality docs

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"

cd ~/projects/revealui-jv
git add docs/roadmap/.gitkeep docs/gaps/.gitkeep
git commit -m "chore: scaffold roadmap and gaps directories

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Chunk 2: Reality Docs (public repo — RevealUI)

Seed 15 reality docs in `~/projects/RevealUI/docs/features/`. Each follows the Reality Doc YAML Schema from the spec.

### Task 5: Write auth.yml reality doc

**Files:**
- Create: `~/projects/RevealUI/docs/features/auth.yml`

- [ ] **Step 1: Write auth.yml**

```yaml
feature: auth
name: Authentication & Security
status: production
tier: free
last-verified: 2026-03-11

api-surface:
  sign-in:
    endpoint: "POST /api/auth/sign-in"
    openapi: true
    input-validation: zod
    tested: true
  sign-up:
    endpoint: "POST /api/auth/sign-up"
    openapi: true
    input-validation: zod
    tested: true
  sign-out:
    endpoint: "POST /api/auth/sign-out"
    openapi: true
    tested: true
  verify-email:
    endpoint: "POST /api/auth/verify-email"
    openapi: true
    input-validation: zod
    tested: true
  password-reset-request:
    endpoint: "POST /api/auth/password-reset"
    openapi: true
    input-validation: zod
    tested: true
  password-reset-confirm:
    endpoint: "POST /api/auth/password-reset/confirm"
    openapi: true
    input-validation: zod
    tested: true
  oauth-callback:
    endpoint: "GET /api/auth/oauth/:provider/callback"
    openapi: true
    tested: true
  session-validate:
    endpoint: "GET /api/auth/session"
    openapi: true
    tested: true

ui-surface:
  sign-in-page:
    location: "apps/cms/src/app/(auth)/sign-in/page.tsx"
    status: functional
  sign-up-page:
    location: "apps/cms/src/app/(auth)/sign-up/page.tsx"
    status: functional
  password-reset-page:
    location: "apps/cms/src/app/(auth)/password-reset/page.tsx"
    status: functional
  verify-email-page:
    location: "apps/cms/src/app/(auth)/verify-email/page.tsx"
    status: functional

limitations:
  - id: no-2fa
    surface: api
    summary: "TOTP 2FA class exists but is not wired into sign-in flow"
  - id: no-session-binding
    surface: api
    summary: "Sessions not bound to IP/UA — stolen cookie works from any client"
  - id: no-admin-revoke
    surface: api
    summary: "No admin endpoint to force-logout (revoke) another user's session"
```

### Task 6: Write billing.yml reality doc

**Files:**
- Create: `~/projects/RevealUI/docs/features/billing.yml`

- [ ] **Step 1: Write billing.yml**

```yaml
feature: billing
name: Stripe Billing & Payments
status: production
tier: pro
last-verified: 2026-03-11

api-surface:
  checkout:
    endpoint: "POST /api/billing/checkout"
    openapi: true
    input-validation: zod
    tested: true
  webhooks:
    endpoint: "POST /api/webhooks"
    openapi: true
    input-validation: stripe-signature
    tested: true
  subscription-status:
    endpoint: "GET /api/billing/subscription"
    openapi: true
    tested: true
  upgrade:
    endpoint: "POST /api/billing/upgrade"
    openapi: true
    tested: true
  downgrade:
    endpoint: "POST /api/billing/downgrade"
    openapi: true
    tested: true
  usage:
    endpoint: "POST /api/billing/usage"
    openapi: true
    tested: true
  license-verify:
    endpoint: "POST /api/license/verify"
    openapi: true
    tested: true
  license-generate:
    endpoint: "POST /api/license/generate"
    openapi: true
    tested: true

ui-surface:
  upgrade-dialog:
    location: "apps/cms/src/app/(backend)/admin/upgrade/page.tsx"
    status: functional
  account-billing:
    location: "apps/cms/src/app/(backend)/admin/settings/account/page.tsx"
    status: basic

limitations:
  - id: email-silent-fail
    surface: api
    summary: "RESEND_API_KEY missing in production causes silent email skip"
  - id: billing-meter
    surface: api
    summary: "Usage overage tracked in DB but not reported to Stripe Billing Meter"
  - id: key-rotation
    surface: api
    summary: "No kid claim in license JWTs — key rotation breaks verification"
  - id: github-provisioning
    surface: api
    summary: "Perpetual license GitHub team add is fire-and-forget, no retry"
```

### Task 7: Write api.yml reality doc

**Files:**
- Create: `~/projects/RevealUI/docs/features/api.yml`

- [ ] **Step 1: Write api.yml**

```yaml
feature: api
name: REST API (Hono + OpenAPI)
status: production
tier: free
last-verified: 2026-03-11

api-surface:
  health:
    endpoint: "GET /health, /health/live, /health/ready, /health/metrics"
    openapi: true
    tested: true
  content-posts:
    endpoint: "GET|POST /posts, GET|PATCH|DELETE /posts/:id"
    openapi: true
    input-validation: zod
    tested: true
  content-pages:
    endpoint: "GET|POST /sites/:siteId/pages, GET|PATCH|DELETE /pages/:id"
    openapi: true
    input-validation: zod
    tested: true
  content-media:
    endpoint: "GET|PATCH|DELETE /media/:id"
    openapi: true
    tested: true
  content-sites:
    endpoint: "GET|POST|PATCH|DELETE /sites/:id"
    openapi: true
    input-validation: zod
    tested: true
  tickets:
    endpoint: "GET|POST /tickets, GET|PATCH|DELETE /tickets/:id"
    openapi: true
    input-validation: zod
    tested: true
  pricing:
    endpoint: "GET /api/pricing"
    openapi: true
    tested: true
  gdpr:
    endpoint: "POST /api/gdpr/consent, POST /api/gdpr/delete, POST /api/gdpr/anonymize"
    openapi: true
    input-validation: none
    tested: true
  errors:
    endpoint: "POST /api/errors"
    openapi: true
    tested: true
  logs:
    endpoint: "POST /api/logs"
    openapi: true
    tested: true
  api-keys:
    endpoint: "GET|POST|DELETE /api/api-keys"
    openapi: true
    tested: true
  marketplace:
    endpoint: "POST /api/marketplace/publish, /invoke, /connect"
    openapi: true
    tested: true
  rag-index:
    endpoint: "GET|POST|DELETE /api/rag-index"
    openapi: true
    tested: true
  agent-tasks:
    endpoint: "POST /api/agent-tasks/*"
    openapi: true
    tested: true
  agent-stream:
    endpoint: "POST /api/agent-stream"
    openapi: true
    tested: true
  collab:
    endpoint: "WebSocket /api/collab/*"
    openapi: false
    tested: true
  agent-collab:
    endpoint: "POST /api/agent-collab/*"
    openapi: false
    tested: true
  code-provenance:
    endpoint: "GET|POST /api/code-provenance"
    openapi: true
    tested: true
  terminal-auth:
    endpoint: "POST /api/terminal-auth"
    openapi: true
    tested: true
  a2a:
    endpoint: "GET /.well-known/a2a"
    openapi: true
    tested: true

ui-surface:
  swagger-docs:
    location: "/docs (Swagger UI)"
    status: functional

limitations:
  - id: gdpr-no-validation
    surface: api
    summary: "GDPR endpoints use raw c.req.json() without Zod validation"
  - id: collab-no-openapi
    surface: api
    summary: "collab.ts and agent-collab.ts routes not in OpenAPI spec"
```

### Task 8: Write database.yml reality doc

**Files:**
- Create: `~/projects/RevealUI/docs/features/database.yml`

- [ ] **Step 1: Write database.yml**

```yaml
feature: database
name: Database Schema (Drizzle ORM)
status: production
tier: free
last-verified: 2026-03-11

api-surface:
  schema:
    endpoint: "packages/db/src/schema/ (27 schema files, ~50 tables)"
    openapi: false
    tested: true
  dual-db:
    endpoint: "NeonDB (REST content) + Supabase (vectors/auth)"
    openapi: false
    tested: true
  drizzle-orm:
    endpoint: "Code-first schema with Drizzle ORM"
    openapi: false
    tested: true

limitations:
  - id: pages-parent-fk
    surface: api
    summary: "pages.parentId has no FK constraint — orphaned child pages possible"
  - id: tickets-parent-fk
    surface: api
    summary: "tickets.parentTicketId has no FK constraint — orphaned subtasks possible"
  - id: pages-slug-unique
    surface: api
    summary: "No composite unique on pages(slug, siteId) — duplicate slugs per site possible"
  - id: collab-edits-index
    surface: api
    summary: "collab_edits.documentId has no index — slow lookups on large tables"
  - id: page-count-denorm
    surface: api
    summary: "sites.pageCount denormalized without DB trigger — count can drift"
  - id: cross-db-fk
    surface: api
    summary: "No runtime FK validation between Supabase and NeonDB references"
  - id: no-soft-delete
    surface: api
    summary: "No soft-delete pattern — users and sites are hard-deleted"
  - id: ticket-race
    surface: api
    summary: "Ticket number uses MAX()+1 app-level increment — race condition under concurrency"
```

### Task 9: Write remaining 11 reality docs

**Files:**
- Create: `~/projects/RevealUI/docs/features/cms-engine.yml`
- Create: `~/projects/RevealUI/docs/features/cms-admin.yml`
- Create: `~/projects/RevealUI/docs/features/presentation.yml`
- Create: `~/projects/RevealUI/docs/features/config-build.yml`
- Create: `~/projects/RevealUI/docs/features/ci.yml`
- Create: `~/projects/RevealUI/docs/features/ai.yml`
- Create: `~/projects/RevealUI/docs/features/mcp.yml`
- Create: `~/projects/RevealUI/docs/features/services.yml`
- Create: `~/projects/RevealUI/docs/features/sync.yml`
- Create: `~/projects/RevealUI/docs/features/router.yml`
- Create: `~/projects/RevealUI/docs/features/marketing.yml`

- [ ] **Step 1: Write cms-engine.yml**

```yaml
feature: cms-engine
name: CMS Engine (Collections + REST)
status: beta
tier: free
last-verified: 2026-03-11

api-surface:
  collections:
    endpoint: "20 collection definitions in apps/cms/src/lib/collections/"
    openapi: true
    tested: true
  access-control:
    endpoint: "Per-collection RBAC with role-based read/write/delete"
    openapi: false
    tested: true
  hooks:
    endpoint: "beforeChange/afterChange hooks on all collections"
    openapi: false
    tested: true
  rich-text:
    endpoint: "Lexical rich text editor integration"
    openapi: false
    tested: true

ui-surface:
  document-form:
    location: "apps/cms/src/components/DocumentForm.tsx"
    status: basic

limitations:
  - id: field-renderers
    surface: ui
    summary: "Not all 14 field types render correct controls (blocks, relationships, uploads, arrays incomplete)"
  - id: version-history-ui
    surface: ui
    summary: "Page revisions stored in DB but no UI to view/restore them"
```

- [ ] **Step 2: Write cms-admin.yml**

```yaml
feature: cms-admin
name: CMS Admin Dashboard
status: alpha
tier: free
last-verified: 2026-03-11

api-surface:
  admin-routes:
    endpoint: "apps/cms/src/app/(backend)/admin/ catch-all router"
    openapi: false
    tested: false

ui-surface:
  agents-page:
    location: "apps/cms/src/app/(backend)/admin/agents/page.tsx"
    status: functional
  settings-page:
    location: "apps/cms/src/app/(backend)/admin/settings/page.tsx"
    status: functional
  api-keys-page:
    location: "apps/cms/src/app/(backend)/admin/settings/api-keys/page.tsx"
    status: functional
  account-page:
    location: "apps/cms/src/app/(backend)/admin/settings/account/page.tsx"
    status: basic
  logs-page:
    location: "apps/cms/src/app/(backend)/admin/logs/page.tsx"
    status: functional
  errors-page:
    location: "apps/cms/src/app/(backend)/admin/errors/page.tsx"
    status: functional
  monitoring-page:
    location: "apps/cms/src/app/(backend)/admin/monitoring/page.tsx"
    status: functional
  chat-page:
    location: "apps/cms/src/app/(backend)/admin/chat/page.tsx"
    status: basic
  upgrade-page:
    location: "apps/cms/src/app/(backend)/admin/upgrade/page.tsx"
    status: functional

limitations:
  - id: no-collection-nav
    surface: ui
    summary: "No collection list views with pagination in admin dashboard"
  - id: no-content-search
    surface: ui
    summary: "No search bar to filter collection documents"
  - id: incomplete-field-renderers
    surface: ui
    summary: "DocumentForm missing renderers for blocks, relationships, uploads, arrays"
  - id: no-form-validation
    surface: ui
    summary: "Form validation errors not displayed inline next to fields"
```

- [ ] **Step 3: Write presentation.yml**

```yaml
feature: presentation
name: UI Component Library
status: production
tier: free
last-verified: 2026-03-11

api-surface:
  components:
    endpoint: "55 React components in packages/presentation/src/components/"
    openapi: false
    tested: true
  exports:
    endpoint: "@revealui/presentation package with subpath exports"
    openapi: false
    tested: true

ui-surface:
  component-library:
    location: "packages/presentation/src/components/"
    status: functional

limitations:
  - id: no-storybook
    surface: ui
    summary: "No Storybook or visual component documentation"
```

- [ ] **Step 4: Write config-build.yml**

```yaml
feature: config-build
name: Configuration & Build System
status: production
tier: free
last-verified: 2026-03-11

api-surface:
  env-config:
    endpoint: "@revealui/config — type-safe Zod env validation with lazy Proxy"
    openapi: false
    tested: true
  turborepo:
    endpoint: "turbo.json pipeline — build, dev, test, lint, typecheck"
    openapi: false
    tested: true
  tsup:
    endpoint: "tsup bundling for all packages → dist/"
    openapi: false
    tested: true
  biome:
    endpoint: "Biome 2 lint + format (sole linter)"
    openapi: false
    tested: true
  dockerfiles:
    endpoint: "Dockerfiles for api, cms, marketing, docs, terminal"
    openapi: false
    tested: false

limitations:
  - id: no-docker-compose
    surface: api
    summary: "No Docker Compose for local infrastructure (Postgres, etc.)"
  - id: no-env-production-example
    surface: api
    summary: "No .env.production.example for self-hosted deployments"
```

- [ ] **Step 5: Write ci.yml**

```yaml
feature: ci
name: CI/CD Pipeline
status: beta
tier: free
last-verified: 2026-03-11

api-surface:
  ci-pipeline:
    endpoint: ".github/workflows/ci.yml — 3-phase gate"
    openapi: false
    tested: true
  security-scan:
    endpoint: ".github/workflows/security.yml — CodeQL + Gitleaks + dep audit"
    openapi: false
    tested: true
  release:
    endpoint: ".github/workflows/release.yml — OIDC + npm provenance"
    openapi: false
    tested: true
  release-pro:
    endpoint: ".github/workflows/release-pro.yml — Pro dist-only publishing"
    openapi: false
    tested: true

limitations:
  - id: tests-warn-only
    surface: api
    summary: "CI tests are warn-only — failures don't block merges"
  - id: no-sbom
    surface: api
    summary: "No SBOM generation in release pipeline"
```

- [ ] **Step 6: Write ai.yml**

```yaml
feature: ai
name: AI Agents & Memory
status: beta
tier: pro
last-verified: 2026-03-11

api-surface:
  agent-tasks:
    endpoint: "POST /api/agent-tasks/* (gated by isFeatureEnabled('ai'))"
    openapi: true
    tested: true
  agent-stream:
    endpoint: "POST /api/agent-stream (SSE, gated by 'ai')"
    openapi: true
    tested: true
  rag-index:
    endpoint: "GET|POST|DELETE /api/rag-index (admin writes, gated by 'ai')"
    openapi: true
    tested: true

limitations:
  - id: dist-only
    surface: api
    summary: "@revealui/ai is dist-only in public repo — source opaque, integration layer verified"
  - id: llm-providers
    surface: api
    summary: "GROQ for chat/completions, Ollama for embeddings — no OpenAI until paying customers"
```

- [ ] **Step 7: Write mcp.yml**

```yaml
feature: mcp
name: MCP Servers
status: beta
tier: pro
last-verified: 2026-03-11

api-surface:
  mcp-servers:
    endpoint: "@revealui/mcp — Stripe, Supabase, Neon, Vercel, Playwright servers"
    openapi: false
    tested: true

limitations:
  - id: dist-only
    surface: api
    summary: "@revealui/mcp is dist-only in public repo — source opaque"
  - id: neon-mcp-vuln
    surface: api
    summary: "@neondatabase/mcp-server-neon pulls vulnerable oauth2-server (accepted risk, dev-only)"
```

- [ ] **Step 8: Write services.yml**

```yaml
feature: services
name: Stripe + Supabase Integrations
status: beta
tier: pro
last-verified: 2026-03-11

api-surface:
  stripe-integration:
    endpoint: "@revealui/services/stripe — checkout, webhooks, subscriptions"
    openapi: false
    tested: true
  supabase-integration:
    endpoint: "@revealui/services/supabase — auth, vectors, real-time"
    openapi: false
    tested: true

limitations:
  - id: dist-only
    surface: api
    summary: "@revealui/services is dist-only in public repo"
  - id: payload-vulns
    surface: api
    summary: "Transitive payload IDOR + SSRF vulns (mitigated by CSP/CORS, upgrade when 3.75+ compatible)"
```

- [ ] **Step 9: Write sync.yml**

```yaml
feature: sync
name: ElectricSQL Real-Time Sync
status: alpha
tier: pro
last-verified: 2026-03-11

api-surface:
  sync-module:
    endpoint: "@revealui/sync — mutations.ts, CRDT operations"
    openapi: false
    tested: true

limitations:
  - id: minimal-surface
    surface: api
    summary: "Minimal implementation — mutations tracking and test setup only"
  - id: no-conflict-resolution
    surface: api
    summary: "Full conflict resolution not yet implemented"
```

- [ ] **Step 10: Write router.yml**

```yaml
feature: router
name: File-Based Router
status: beta
tier: free
last-verified: 2026-03-11

api-surface:
  router-module:
    endpoint: "@revealui/router — file-based routing with SSR support"
    openapi: false
    tested: true

limitations:
  - id: no-nested-routes
    surface: api
    summary: "Nested route support not yet implemented"
  - id: no-middleware
    surface: api
    summary: "Route-level middleware not yet supported"
```

- [ ] **Step 11: Write marketing.yml**

```yaml
feature: marketing
name: Marketing Site
status: alpha
tier: free
last-verified: 2026-03-11

api-surface:
  waitlist:
    endpoint: "POST /api/waitlist"
    openapi: false
    tested: true
  health:
    endpoint: "GET /api/health"
    openapi: false
    tested: true

ui-surface:
  landing:
    location: "apps/marketing/src/app/page.tsx"
    status: basic
  pricing:
    location: "apps/marketing/src/app/pricing/page.tsx"
    status: basic
  privacy:
    location: "apps/marketing/src/app/privacy/page.tsx"
    status: functional
  terms:
    location: "apps/marketing/src/app/terms/page.tsx"
    status: functional
  sponsor:
    location: "apps/marketing/src/app/sponsor/page.tsx"
    status: basic

limitations:
  - id: no-presentation-components
    surface: ui
    summary: "Marketing site doesn't use @revealui/presentation components"
  - id: basic-landing
    surface: ui
    summary: "Landing page is minimal — no feature showcases or demos"
```

- [ ] **Step 12: Remove .gitkeep**

```bash
rm ~/projects/RevealUI/docs/features/.gitkeep
```

- [ ] **Step 13: Spot-check YAML validity**

```bash
cd ~/projects/RevealUI
node -e "
const fs = require('fs');
const files = fs.readdirSync('docs/features').filter(f => f.endsWith('.yml'));
let ok = 0, bad = 0;
for (const f of files) {
  try {
    const content = fs.readFileSync('docs/features/' + f, 'utf8');
    if (!content.includes('feature:') || !content.includes('status:')) throw new Error('missing required fields');
    ok++;
  } catch(e) { bad++; console.error(f + ': ' + e.message); }
}
console.log(ok + ' valid, ' + bad + ' invalid, ' + files.length + ' total');
"
```

Expected: `15 valid, 0 invalid, 15 total`

- [ ] **Step 14: Commit all reality docs**

```bash
cd ~/projects/RevealUI
git add docs/features/
git commit -m "docs(features): seed 15 reality docs from codebase audit

Agent-first structured YAML describing what each feature actually
does today. Part of the three-layer feature lifecycle system.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Chunk 3: Roadmap Targets (private repo — revealui-jv)

Seed 18 roadmap target files. Each describes the target state with verifiable acceptance criteria.

### Feature Dependency Table

| Feature | depends-on |
|---------|-----------|
| auth | [] |
| billing | [auth] |
| api | [auth, database] |
| database | [] |
| presentation | [] |
| config-build | [] |
| cms-engine | [database, auth] |
| cms-admin | [cms-engine, presentation] |
| ci | [] |
| ai | [database] |
| mcp | [ai] |
| services | [billing] |
| sync | [database] |
| router | [] |
| marketing | [presentation] |
| editors | [ai, mcp] |
| harnesses | [ai, mcp] |
| studio | [cms-engine] |

### Task 10: Write roadmap files for production features

**Files:**
- Create: `~/projects/revealui-jv/docs/roadmap/auth.yml`
- Create: `~/projects/revealui-jv/docs/roadmap/billing.yml`
- Create: `~/projects/revealui-jv/docs/roadmap/api.yml`
- Create: `~/projects/revealui-jv/docs/roadmap/database.yml`
- Create: `~/projects/revealui-jv/docs/roadmap/presentation.yml`
- Create: `~/projects/revealui-jv/docs/roadmap/config-build.yml`

- [ ] **Step 1: Write auth.yml**

```yaml
feature: auth
name: Authentication & Security
tier: free
depends-on: []
acceptance:
  - id: session-auth
    done: "Session-based auth with bcrypt 12 rounds and SHA-256 token hashing"
    owner: agent
  - id: oauth-providers
    done: "GitHub, Google, Vercel OAuth with signed CSRF state tokens"
    owner: agent
  - id: brute-force
    done: "5 attempts → 30min lock with atomic DB operations"
    owner: agent
  - id: rate-limiting
    done: "Tiered rate limiting: free(60/min), pro(300/min), max(600/min), enterprise(1000/min)"
    owner: agent
  - id: 2fa
    done: "TOTP 2FA wired into sign-in flow, not just class definition"
    owner: agent
  - id: admin-session-revoke
    done: "Admin can force-logout any user via API endpoint"
    owner: agent
  - id: session-binding
    done: "Sessions bound to IP+UA fingerprint; mismatch forces re-auth"
    owner: agent
```

- [ ] **Step 2: Write billing.yml**

```yaml
feature: billing
name: Stripe Billing & Payments
tier: pro
depends-on: [auth]
acceptance:
  - id: checkout
    done: "POST /api/billing/checkout creates Stripe Checkout session with trial period"
    owner: agent
  - id: webhooks
    done: "POST /api/webhooks processes 12 event types with DB-backed idempotency"
    owner: agent
  - id: email-delivery
    done: "All customer lifecycle events send email; missing RESEND_API_KEY throws in production"
    owner: agent
  - id: billing-meter
    done: "Usage overage reported to Stripe Billing Meter monthly via cron"
    owner: human
  - id: key-rotation
    done: "License JWTs include kid claim; key rotation doesn't break verification"
    owner: agent
  - id: github-provisioning
    done: "Perpetual license GitHub team add has confirmation + exponential retry"
    owner: agent
  - id: env-vars
    done: "All 6 mandatory billing env vars set in Vercel production"
    owner: human
  - id: resend-key
    done: "RESEND_API_KEY configured in production environment"
    owner: human
```

- [ ] **Step 3: Write api.yml**

```yaml
feature: api
name: REST API (Hono + OpenAPI)
tier: free
depends-on: [auth, database]
acceptance:
  - id: full-openapi
    done: "All routes documented in OpenAPI spec including collab and agent-collab"
    owner: agent
  - id: gdpr-validation
    done: "GDPR endpoints use Zod schema validation for all request bodies"
    owner: agent
  - id: structured-errors
    done: "All error responses use structured error codes (not just status + message)"
    owner: agent
  - id: versioned-api
    done: "All routes available at /api/* and /api/v1/*"
    owner: agent
  - id: rate-limiting
    done: "Per-route rate limits configured for all sensitive endpoints"
    owner: agent
```

- [ ] **Step 4: Write database.yml**

```yaml
feature: database
name: Database Schema (Drizzle ORM)
tier: free
depends-on: []
acceptance:
  - id: fk-constraints
    done: "All parent references have FK constraints with appropriate ON DELETE"
    owner: agent
  - id: unique-constraints
    done: "pages(slug, siteId) has composite unique constraint"
    owner: agent
  - id: indexes
    done: "All frequently-queried columns have indexes (collab_edits.documentId, etc.)"
    owner: agent
  - id: atomic-sequences
    done: "Ticket numbers use PostgreSQL sequence, not app-level MAX+1"
    owner: agent
  - id: page-count-trigger
    done: "sites.pageCount maintained by DB trigger, not app code"
    owner: agent
  - id: cross-db-validation
    done: "Runtime FK validation between Supabase and NeonDB references"
    owner: agent
  - id: soft-delete
    done: "Users and sites support soft-delete with deletedAt column"
    owner: agent
```

- [ ] **Step 5: Write presentation.yml**

```yaml
feature: presentation
name: UI Component Library
tier: free
depends-on: []
acceptance:
  - id: component-library
    done: "55+ React components with zero external UI deps (clsx + CVA only)"
    owner: agent
  - id: tailwind-v4
    done: "All components use Tailwind CSS v4 patterns"
    owner: agent
  - id: documentation
    done: "Component documentation with props, variants, and usage examples"
    owner: agent
```

- [ ] **Step 6: Write config-build.yml**

```yaml
feature: config-build
name: Configuration & Build System
tier: free
depends-on: []
acceptance:
  - id: env-validation
    done: "Type-safe Zod env validation with lazy Proxy for all config"
    owner: agent
  - id: docker-compose
    done: "Docker Compose for local development with Postgres, Supabase, and Neon"
    owner: agent
  - id: env-production-example
    done: ".env.production.example with all required vars documented for self-hosted"
    owner: agent
  - id: turborepo
    done: "Turbo pipeline with correct task dependencies and caching"
    owner: agent
```

### Task 11: Write roadmap files for beta/alpha features

**Files:**
- Create: `~/projects/revealui-jv/docs/roadmap/cms-engine.yml`
- Create: `~/projects/revealui-jv/docs/roadmap/cms-admin.yml`
- Create: `~/projects/revealui-jv/docs/roadmap/ci.yml`
- Create: `~/projects/revealui-jv/docs/roadmap/ai.yml`
- Create: `~/projects/revealui-jv/docs/roadmap/mcp.yml`
- Create: `~/projects/revealui-jv/docs/roadmap/services.yml`
- Create: `~/projects/revealui-jv/docs/roadmap/sync.yml`
- Create: `~/projects/revealui-jv/docs/roadmap/router.yml`
- Create: `~/projects/revealui-jv/docs/roadmap/marketing.yml`

- [ ] **Step 1: Write cms-engine.yml**

```yaml
feature: cms-engine
name: CMS Engine (Collections + REST)
tier: free
depends-on: [database, auth]
acceptance:
  - id: collections
    done: "20 collection types with per-collection access control and hooks"
    owner: agent
  - id: rich-text
    done: "Lexical rich text with all block types rendering correctly"
    owner: agent
  - id: field-types
    done: "All 14 field types (text, number, richText, select, relationship, upload, array, blocks, checkbox, date, email, point, radio, textarea) render correct controls"
    owner: agent
  - id: version-history
    done: "Page revisions stored and viewable with restore capability"
    owner: agent
```

- [ ] **Step 2: Write cms-admin.yml**

```yaml
feature: cms-admin
name: CMS Admin Dashboard
tier: free
depends-on: [cms-engine, presentation]
acceptance:
  - id: field-renderers
    done: "All 14 field types render correct controls in DocumentForm"
    owner: agent
  - id: collection-navigation
    done: "Admin dashboard links to collection list views with pagination"
    owner: agent
  - id: content-search
    done: "Search bar filters collection documents by text content"
    owner: agent
  - id: version-history
    done: "Version history viewer shows revisions with restore capability"
    owner: agent
  - id: form-validation
    done: "Form validation errors displayed inline next to fields"
    owner: agent
```

- [ ] **Step 3: Write ci.yml**

```yaml
feature: ci
name: CI/CD Pipeline
tier: free
depends-on: []
acceptance:
  - id: tests-hard-fail
    done: "CI tests are hard-fail — failures block merges"
    owner: agent
  - id: sbom
    done: "SBOM generated in release pipeline for compliance"
    owner: agent
  - id: security-scan
    done: "CodeQL + Gitleaks + dependency audit on every PR"
    owner: agent
  - id: release-provenance
    done: "npm publish with OIDC provenance attestation"
    owner: agent
```

- [ ] **Step 4: Write ai.yml**

```yaml
feature: ai
name: AI Agents & Memory
tier: pro
depends-on: [database]
acceptance:
  - id: agent-tasks
    done: "Agent task CRUD with SSE streaming, gated by ai feature flag"
    owner: agent
  - id: rag
    done: "RAG index management with vector embeddings via Supabase"
    owner: agent
  - id: memory
    done: "Working + episodic + vector memory with CRDT operations"
    owner: agent
  - id: multi-provider
    done: "GROQ for chat, Ollama for embeddings, architecture supports BYOK"
    owner: agent
```

- [ ] **Step 5: Write mcp.yml**

```yaml
feature: mcp
name: MCP Servers
tier: pro
depends-on: [ai]
acceptance:
  - id: stripe-server
    done: "Stripe MCP server operational for billing queries"
    owner: agent
  - id: supabase-server
    done: "Supabase MCP server operational for vector/auth queries"
    owner: agent
  - id: neon-server
    done: "Neon MCP server operational for DB queries"
    owner: agent
  - id: vercel-server
    done: "Vercel MCP server operational for deployment management"
    owner: agent
  - id: playwright-server
    done: "Playwright MCP server operational for browser automation"
    owner: agent
```

- [ ] **Step 6: Write services.yml**

```yaml
feature: services
name: Stripe + Supabase Integrations
tier: pro
depends-on: [billing]
acceptance:
  - id: stripe-checkout
    done: "Full Stripe checkout flow with subscriptions and webhooks"
    owner: agent
  - id: supabase-auth
    done: "Supabase auth integration for vector/real-time features"
    owner: agent
  - id: payload-upgrade
    done: "Payload upgraded to >=3.75.0 when compatible (IDOR + SSRF fixes)"
    owner: agent
```

- [ ] **Step 7: Write sync.yml**

```yaml
feature: sync
name: ElectricSQL Real-Time Sync
tier: pro
depends-on: [database]
acceptance:
  - id: mutation-tracking
    done: "All content mutations tracked for sync"
    owner: agent
  - id: conflict-resolution
    done: "CRDT-based conflict resolution for concurrent edits"
    owner: agent
  - id: offline-support
    done: "Offline-first with automatic sync on reconnect"
    owner: agent
```

- [ ] **Step 8: Write router.yml**

```yaml
feature: router
name: File-Based Router
tier: free
depends-on: []
acceptance:
  - id: file-routing
    done: "File-based routing with SSR support"
    owner: agent
  - id: nested-routes
    done: "Nested route support with layout inheritance"
    owner: agent
  - id: middleware
    done: "Route-level middleware for auth, logging, etc."
    owner: agent
```

- [ ] **Step 9: Write marketing.yml**

```yaml
feature: marketing
name: Marketing Site
tier: free
depends-on: [presentation]
acceptance:
  - id: presentation-components
    done: "Marketing site uses @revealui/presentation components consistently"
    owner: agent
  - id: landing-page
    done: "Landing page with feature showcases, pricing, and CTA"
    owner: agent
  - id: waitlist
    done: "Waitlist signup with email validation"
    owner: agent
  - id: seo
    done: "SEO metadata, sitemap, and social sharing tags"
    owner: agent
```

### Task 12: Write roadmap files for planned features

**Files:**
- Create: `~/projects/revealui-jv/docs/roadmap/editors.yml`
- Create: `~/projects/revealui-jv/docs/roadmap/harnesses.yml`
- Create: `~/projects/revealui-jv/docs/roadmap/studio.yml`

- [ ] **Step 1: Write editors.yml**

```yaml
feature: editors
name: Editor Integration Daemon
tier: pro
depends-on: [ai, mcp]
acceptance:
  - id: zed-adapter
    done: "Zed editor adapter sends/receives context via daemon"
    owner: agent
  - id: vscode-adapter
    done: "VS Code extension communicates with daemon"
    owner: agent
  - id: neovim-adapter
    done: "Neovim plugin communicates with daemon"
    owner: agent
  - id: daemon
    done: "Editor daemon process coordinates between editor and AI agents"
    owner: agent
  - id: feature-flag
    done: "isFeatureEnabled('editors') gate added back to features.ts"
    owner: agent
```

- [ ] **Step 2: Write harnesses.yml**

```yaml
feature: harnesses
name: AI Harness Coordination
tier: pro
depends-on: [ai, mcp]
acceptance:
  - id: claude-code-adapter
    done: "Claude Code harness adapter with JSON-RPC communication"
    owner: agent
  - id: cursor-adapter
    done: "Cursor harness adapter"
    owner: agent
  - id: workboard-coordination
    done: "Multi-agent workboard coordination across harnesses"
    owner: agent
  - id: daemon
    done: "Harness daemon process manages agent lifecycle"
    owner: agent
  - id: feature-flag
    done: "isFeatureEnabled('harnesses') gate added back to features.ts"
    owner: agent
```

- [ ] **Step 3: Write studio.yml**

```yaml
feature: studio
name: Studio Desktop App (Tauri 2)
tier: free
depends-on: [cms-engine]
acceptance:
  - id: devpod-manager
    done: "DevPod manager UI for creating/managing development environments"
    owner: agent
  - id: app-launcher
    done: "App launcher for starting/stopping RevealUI services"
    owner: agent
  - id: first-run-wizard
    done: "First-run wizard for initial setup and configuration"
    owner: agent
  - id: system-tray
    done: "System tray integration with status indicators"
    owner: agent
  - id: tauri-build
    done: "Tauri 2 build pipeline producing installers for macOS, Windows, Linux"
    owner: agent
```

- [ ] **Step 4: Remove .gitkeep**

```bash
rm ~/projects/revealui-jv/docs/roadmap/.gitkeep
```

- [ ] **Step 5: Commit all roadmap files**

```bash
cd ~/projects/revealui-jv
git add docs/roadmap/
git commit -m "chore(roadmap): seed 18 roadmap target files

Per-feature target state with verifiable acceptance criteria.
Part of the three-layer feature lifecycle system.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Chunk 4: Gap Files (private repo — revealui-jv)

Seed all 26 gap files. Every gap file includes populated `work`, `acceptance`, and `verify` fields.

### Task 13: Write blocker gap files (agent-owned)

**Files:**
- Create: `~/projects/revealui-jv/docs/gaps/GAP-001.yml` through `GAP-006.yml`

- [ ] **Step 1: Write GAP-001.yml**

```yaml
id: GAP-001
feature: billing
name: Email notifications silently fail in production
priority: blocker
owner: agent
status: open
file: "apps/api/src/lib/email.ts:30-42"

work:
  - "Change email.ts to throw in production when RESEND_API_KEY is missing"
  - "Webhook returns 500 to Stripe which retries when key is configured"
  - "Add test: production mode without RESEND_API_KEY throws"

acceptance:
  - "email.ts throws Error when NODE_ENV=production and RESEND_API_KEY is unset"
  - "Existing email tests still pass"

verify: "pnpm --filter api test && pnpm gate:quick"
```

- [ ] **Step 2: Write GAP-002.yml**

```yaml
id: GAP-002
feature: database
name: Ticket number race condition (non-atomic increment)
priority: blocker
owner: agent
status: open
file: "packages/db/src/queries/tickets.ts:68-73"

work:
  - "Replace MAX(ticketNumber) + app-level increment with PostgreSQL SEQUENCE or advisory lock"
  - "Create next available migration adding ticket_number_seq sequence"
  - "Update ticket creation query to use nextval('ticket_number_seq')"
  - "Add test: concurrent ticket creation produces unique numbers"

acceptance:
  - "Ticket creation uses PostgreSQL sequence, not app-level MAX+1"
  - "Concurrent ticket creation test passes with no duplicate numbers"
  - "Existing ticket tests still pass"

verify: "pnpm --filter @revealui/db test && pnpm gate:quick"
```

- [ ] **Step 3: Write GAP-003.yml**

```yaml
id: GAP-003
feature: api
name: GDPR endpoints lack Zod validation
priority: blocker
owner: agent
status: open
file: "apps/api/src/routes/gdpr.ts:63,98,167"

work:
  - "Define Zod schemas for consent grant, consent revoke, and deletion request bodies"
  - "Replace raw c.req.json() calls with schema-validated parsing"
  - "Add tests for invalid consent types and malformed deletion requests"

acceptance:
  - "All three GDPR endpoints use Zod schema validation"
  - "Invalid consent type returns 400 with structured error"
  - "Existing GDPR tests still pass"

verify: "pnpm --filter api test && pnpm gate:quick"
```

- [ ] **Step 4: Write GAP-004.yml**

```yaml
id: GAP-004
feature: database
name: Missing FK constraints and indexes
priority: blocker
owner: agent
status: open
blocked-by: [GAP-002]
file:
  - "packages/db/src/schema/collections/pages.ts:29"
  - "packages/db/src/schema/collections/tickets.ts:127"
  - "packages/db/src/schema/collections/collab-edits.ts"

work:
  - "Create next available migration with 4 statements:"
  - "1. ALTER TABLE pages ADD CONSTRAINT pages_parent_id_fk FOREIGN KEY (parent_id) REFERENCES pages(id) ON DELETE CASCADE"
  - "2. ALTER TABLE tickets ADD CONSTRAINT tickets_parent_ticket_id_fk FOREIGN KEY (parent_ticket_id) REFERENCES tickets(id) ON DELETE CASCADE"
  - "3. CREATE UNIQUE INDEX pages_slug_site_id_idx ON pages(slug, site_id)"
  - "4. CREATE INDEX collab_edits_document_id_idx ON collab_edits(document_id)"
  - "Update Drizzle schema files to reflect new constraints"
  - "Run migration against test DB to verify"

acceptance:
  - "Migration applies cleanly"
  - "Deleting a parent page cascades to children"
  - "Deleting a parent ticket cascades to subtasks"
  - "Duplicate slug+siteId insert returns constraint violation"
  - "collab_edits queries use index"

verify: "pnpm --filter @revealui/db test && pnpm gate:quick"
```

- [ ] **Step 5: Write GAP-005.yml**

```yaml
id: GAP-005
feature: features
name: Remove editors/harnesses phantom feature flags
priority: blocker
owner: agent
status: closed
closed-date: 2026-03-11

work:
  - "Remove editors and harnesses from FeatureFlags interface in features.ts"
  - "Remove editors and harnesses from featureTierMap in features.ts"
  - "Remove isFeatureEnabled('harnesses') reference from docs/PRO.md"

acceptance:
  - "features.ts has no editors or harnesses entries"
  - "PRO.md has no isFeatureEnabled('harnesses') reference"
  - "pnpm gate:quick passes"

verify: "pnpm gate:quick"
```

Note: GAP-005 status is `closed` because Tasks 1-2 in this plan complete it.

- [ ] **Step 6: Write GAP-006.yml**

```yaml
id: GAP-006
feature: api
name: Collab routes missing from OpenAPI spec
priority: blocker
owner: agent
status: open
file:
  - "apps/api/src/routes/collab.ts"
  - "apps/api/src/routes/agent-collab.ts"

work:
  - "Wrap collab.ts endpoints with createRoute() from @hono/zod-openapi"
  - "Wrap agent-collab.ts endpoints with createRoute()"
  - "Define Zod request/response schemas for each endpoint"
  - "Verify endpoints appear in /openapi.json output"

acceptance:
  - "All collab endpoints appear in Swagger UI at /docs"
  - "OpenAPI spec includes request/response schemas for collab routes"
  - "Existing collab tests still pass"

verify: "pnpm --filter api test && pnpm gate:quick"
```

### Task 14: Write blocker gap files (human-owned)

**Files:**
- Create: `~/projects/revealui-jv/docs/gaps/GAP-007.yml`
- Create: `~/projects/revealui-jv/docs/gaps/GAP-008.yml`
- Create: `~/projects/revealui-jv/docs/gaps/GAP-009.yml`

- [ ] **Step 1: Write GAP-007.yml**

```yaml
id: GAP-007
feature: billing
name: Configure Stripe Billing Meter or disable overage UI
priority: blocker
owner: human
status: open

work:
  - "Option A: Create Stripe Billing Meter in dashboard, set STRIPE_AGENT_METER_EVENT_NAME env var, add cron calling /api/billing/report-agent-overage"
  - "Option B: Remove overage tracking from UI and disable /api/billing/report-agent-overage endpoint"

acceptance:
  - "Either: Stripe Billing Meter reports overage monthly OR overage UI is removed"

verify: "Manual: check Stripe dashboard or verify endpoint disabled"
```

- [ ] **Step 2: Write GAP-008.yml**

```yaml
id: GAP-008
feature: config
name: Verify all mandatory env vars set in Vercel production
priority: blocker
owner: human
status: open

work:
  - "Log into Vercel dashboard for revealui-api project"
  - "Verify these env vars are set: POSTGRES_URL, REVEALUI_SECRET, REVEALUI_KEK, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, REVEALUI_LICENSE_PRIVATE_KEY"
  - "Verify CORS_ORIGIN is set correctly for production domains"

acceptance:
  - "All 6 mandatory env vars confirmed set in Vercel production environment"
  - "API starts without missing-env-var errors"

verify: "Manual: deploy and confirm /health returns 200"
```

- [ ] **Step 3: Write GAP-009.yml**

```yaml
id: GAP-009
feature: billing
name: Set up RESEND_API_KEY in production
priority: blocker
owner: human
status: open
blocked-by: [GAP-008]

work:
  - "Create Resend account and generate API key"
  - "Add RESEND_API_KEY to Vercel production environment"
  - "Verify email sending works for a test billing event"

acceptance:
  - "RESEND_API_KEY is set in Vercel production"
  - "Test email sent successfully via Resend"

verify: "Manual: trigger a test event and check Resend dashboard for delivery"
```

### Task 15: Write high-priority gap files

**Files:**
- Create: `~/projects/revealui-jv/docs/gaps/GAP-010.yml` through `GAP-016.yml`

- [ ] **Step 1: Write GAP-010.yml**

```yaml
id: GAP-010
feature: billing
name: JWT license keys need kid claim for key rotation
priority: high
owner: agent
status: open
file: "apps/api/src/routes/license.ts"

work:
  - "Add kid (key ID) claim to JWT header when generating license tokens"
  - "Update license verification to read kid and select the correct public key"
  - "Add key registry (map of kid → public key) to config"
  - "Add test: token with kid verifies correctly"
  - "Add test: token without kid still verifies for backwards compat"

acceptance:
  - "Generated license JWTs include kid in header"
  - "Verification reads kid and selects correct key"
  - "Old tokens without kid still verify (backwards compatible)"
  - "Key rotation scenario test passes"

verify: "pnpm --filter api test && pnpm gate:quick"
```

- [ ] **Step 2: Write GAP-011.yml**

```yaml
id: GAP-011
feature: billing
name: GitHub team provisioning needs confirmation and retry
priority: high
owner: agent
status: open
file: "apps/api/src/routes/billing.ts"

work:
  - "Add confirmation check after GitHub team invitation API call"
  - "Implement exponential retry (3 attempts, 1s/2s/4s backoff) on failure"
  - "Log provisioning failures to app_logs table"
  - "Add test: successful provisioning"
  - "Add test: retry on transient failure"
  - "Add test: give up after 3 failures with logged error"

acceptance:
  - "GitHub team add confirms invitation was accepted or pending"
  - "Transient failures retry up to 3 times with exponential backoff"
  - "Permanent failures logged to app_logs"
  - "Existing billing tests still pass"

verify: "pnpm --filter api test && pnpm gate:quick"
```

- [ ] **Step 3: Write GAP-012.yml**

```yaml
id: GAP-012
feature: database
name: sites.pageCount denormalized without DB trigger
priority: high
owner: agent
status: open
file: "packages/db/src/schema/collections/sites.ts"

work:
  - "Create migration adding a trigger function that increments/decrements sites.pageCount on pages INSERT/DELETE"
  - "Add trigger: AFTER INSERT ON pages → increment pageCount for the site"
  - "Add trigger: AFTER DELETE ON pages → decrement pageCount for the site"
  - "Remove app-level pageCount updates from page creation/deletion code"
  - "Add test: creating a page increments site pageCount"
  - "Add test: deleting a page decrements site pageCount"

acceptance:
  - "sites.pageCount maintained by DB trigger"
  - "App code does not manually update pageCount"
  - "Page create/delete tests verify correct count"

verify: "pnpm --filter @revealui/db test && pnpm gate:quick"
```

- [ ] **Step 4: Write GAP-013.yml**

```yaml
id: GAP-013
feature: database
name: Cross-DB FK validation at runtime (Supabase to Neon)
priority: high
owner: agent
status: open
file: "packages/db/src/queries/"

work:
  - "Create a validation helper that checks cross-DB references exist before insert/update"
  - "Apply to any query that references a Supabase ID from a NeonDB table (or vice versa)"
  - "The helper should query the target DB to verify the referenced row exists"
  - "Add test: cross-DB reference to existing row succeeds"
  - "Add test: cross-DB reference to non-existent row returns error"

acceptance:
  - "Cross-DB references validated at runtime before writes"
  - "Invalid cross-DB references return structured error"
  - "Performance: validation adds <50ms per query"

verify: "pnpm --filter @revealui/db test && pnpm gate:quick"
```

- [ ] **Step 5: Write GAP-014.yml**

```yaml
id: GAP-014
feature: api
name: Ensure all API routes have OpenAPI documentation
priority: high
owner: agent
status: open
file: "apps/api/src/routes/"

work:
  - "Audit all route files in apps/api/src/routes/"
  - "For each route not using createRoute() from @hono/zod-openapi, convert it"
  - "Ensure request body, query params, and response schemas are defined"
  - "Verify all endpoints appear in /openapi.json"
  - "Priority: collab.ts and agent-collab.ts (covered by GAP-006), then any others found"

acceptance:
  - "Every route file uses createRoute() with Zod schemas"
  - "GET /openapi.json includes all endpoints"
  - "Swagger UI at /docs shows complete API documentation"

verify: "pnpm --filter api test && pnpm gate:quick"
```

- [ ] **Step 6: Write GAP-015.yml**

```yaml
id: GAP-015
feature: api
name: Structured error codes in all error responses
priority: high
owner: agent
status: open
file: "apps/api/src/middleware/"

work:
  - "Define an error code enum/union in @revealui/contracts (e.g., AUTH_INVALID, RATE_LIMITED, VALIDATION_FAILED)"
  - "Update the global error handler to include error code in all error responses"
  - "Format: { error: { code: string, message: string, details?: unknown } }"
  - "Update existing error responses across routes to use the new format"
  - "Add test: error responses include code field"

acceptance:
  - "All error responses include a structured error code"
  - "Error codes are documented in contracts package"
  - "Existing API tests updated to check error format"

verify: "pnpm --filter api test && pnpm gate:quick"
```

- [ ] **Step 7: Write GAP-016.yml**

```yaml
id: GAP-016
feature: billing
name: Cron secret rotation strategy
priority: high
owner: human
status: open

work:
  - "Document the cron secret rotation procedure"
  - "Set up scheduled rotation (quarterly) for CRON_SECRET env var"
  - "Ensure zero-downtime rotation (accept old + new secret during transition window)"

acceptance:
  - "Documented rotation procedure exists"
  - "Rotation can happen without downtime"

verify: "Manual: perform a test rotation and verify cron jobs still execute"
```

### Task 16: Write medium and low priority gap files

**Files:**
- Create: `~/projects/revealui-jv/docs/gaps/GAP-017.yml` through `GAP-026.yml`

- [ ] **Step 1: Write GAP-017.yml**

```yaml
id: GAP-017
feature: cms-admin
name: Admin UI field renderers (blocks, relationships, uploads, arrays)
priority: medium
owner: agent
status: open
file: "apps/cms/src/components/DocumentForm.tsx"

work:
  - "Implement BlocksFieldRenderer for block-based content editing"
  - "Implement RelationshipFieldRenderer with search + select for related documents"
  - "Implement UploadFieldRenderer with drag-drop file upload"
  - "Implement ArrayFieldRenderer with add/remove/reorder items"
  - "Add tests for each renderer with mock data"

acceptance:
  - "All 14 field types render correct controls in DocumentForm"
  - "Block editor supports add/remove/reorder blocks"
  - "Relationship field shows search results from related collection"
  - "Upload field handles drag-drop and file browser"
  - "Array field supports add/remove/reorder"

verify: "pnpm --filter cms test && pnpm gate:quick"
```

- [ ] **Step 2: Write GAP-018.yml**

```yaml
id: GAP-018
feature: marketing
name: Marketing site use presentation components
priority: medium
owner: agent
status: open
file: "apps/marketing/src/"

work:
  - "Replace custom marketing components with @revealui/presentation equivalents"
  - "Use Button, Card, Badge, etc. from presentation package"
  - "Ensure consistent design language between marketing and CMS"
  - "Update landing page to showcase product features"

acceptance:
  - "Marketing site imports from @revealui/presentation"
  - "No duplicate component implementations"
  - "Visual consistency with CMS admin"

verify: "pnpm --filter marketing build && pnpm gate:quick"
```

- [ ] **Step 3: Write GAP-019.yml**

```yaml
id: GAP-019
feature: config
name: Docker Compose missing infrastructure configs
priority: medium
owner: agent
status: open

work:
  - "Create docker-compose.yml at repo root with:"
  - "  - PostgreSQL (NeonDB-compatible) service"
  - "  - Supabase local service (or equivalent)"
  - "  - Volume mounts for persistent data"
  - "  - Environment variable templates"
  - "Add docker-compose.override.yml.example for local customization"
  - "Document in README how to start local infra"

acceptance:
  - "docker-compose up starts all infrastructure services"
  - "API can connect to local PostgreSQL"
  - "Data persists across restarts via volumes"

verify: "docker-compose config (validates compose file syntax)"
```

- [ ] **Step 4: Write GAP-020.yml**

```yaml
id: GAP-020
feature: config
name: .env.production.example for self-hosted deployments
priority: medium
owner: agent
status: open

work:
  - "Create .env.production.example at repo root"
  - "Include all required env vars with descriptions and example values"
  - "Group by service: Database, Auth, Stripe, Email, AI, etc."
  - "Include comments about which are optional vs required"
  - "Reference from deployment docs"

acceptance:
  - ".env.production.example exists with all required vars documented"
  - "Comments explain each variable's purpose"
  - "Copying and filling in values allows a fresh deployment to start"

verify: "test -f .env.production.example && grep -c '=' .env.production.example"
```

- [ ] **Step 5: Write GAP-021.yml**

```yaml
id: GAP-021
feature: ci
name: CI tests switch from warn-only to hard-fail
priority: medium
owner: agent
status: open
file: ".github/workflows/ci.yml"

work:
  - "Change CI test step from continue-on-error: true to continue-on-error: false"
  - "Ensure all existing tests pass in CI environment (may need PGlite setup)"
  - "Add database test setup step to CI if needed"
  - "Update CLAUDE.md CI documentation to reflect hard-fail"

acceptance:
  - "CI test failures block merges"
  - "All existing tests pass in CI"
  - "CI documentation updated"

verify: "Push a branch with a failing test and verify CI blocks merge"
```

- [ ] **Step 6: Write GAP-022.yml**

```yaml
id: GAP-022
feature: database
name: Soft-delete pattern for users and sites
priority: medium
owner: agent
status: open
file:
  - "packages/db/src/schema/users.ts"
  - "packages/db/src/schema/collections/sites.ts"

work:
  - "Add deletedAt column (nullable timestamp) to users and sites tables"
  - "Create migration for the new columns"
  - "Add default WHERE filter to all user/site queries: deletedAt IS NULL"
  - "Change delete operations to SET deletedAt = NOW()"
  - "Add admin endpoint to hard-delete (permanent removal)"
  - "Add test: soft-deleted records excluded from normal queries"
  - "Add test: admin can permanently delete"

acceptance:
  - "Users and sites have deletedAt column"
  - "DELETE operations set deletedAt instead of removing row"
  - "Normal queries exclude soft-deleted records"
  - "Admin can permanently delete"

verify: "pnpm --filter @revealui/db test && pnpm gate:quick"
```

- [ ] **Step 7: Write GAP-023.yml**

```yaml
id: GAP-023
feature: studio
name: Studio desktop app completion
priority: low
owner: agent
status: open

work:
  - "Complete DevPod manager UI"
  - "Complete app launcher for starting/stopping services"
  - "Complete first-run wizard"
  - "Add system tray integration"
  - "Set up Tauri 2 build pipeline"

acceptance:
  - "Studio launches and displays main window"
  - "DevPod manager lists available environments"
  - "App launcher can start/stop RevealUI services"
  - "System tray shows status"

verify: "pnpm --filter studio build"
```

- [ ] **Step 8: Write GAP-024.yml**

```yaml
id: GAP-024
feature: docs
name: Documentation site content
priority: low
owner: agent
status: open
file: "apps/docs/src/"

work:
  - "Write getting-started guide"
  - "Write API reference (generated from OpenAPI)"
  - "Write collection configuration guide"
  - "Write deployment guide (Vercel, Docker, self-hosted)"
  - "Write Pro features guide"

acceptance:
  - "Documentation site has content for all major features"
  - "API reference generated from OpenAPI spec"
  - "Getting-started guide works end-to-end"

verify: "pnpm --filter docs build"
```

- [ ] **Step 9: Write GAP-025.yml**

```yaml
id: GAP-025
feature: router
name: Router nested routes and middleware
priority: low
owner: agent
status: open
file: "packages/router/src/router.ts"

work:
  - "Implement nested route matching with layout inheritance"
  - "Implement route-level middleware support"
  - "Add test: nested routes resolve correctly"
  - "Add test: middleware runs in correct order"
  - "Add test: layout inheritance works across nesting levels"

acceptance:
  - "Nested routes supported with layout inheritance"
  - "Route-level middleware executes before handlers"
  - "All router tests pass"

verify: "pnpm --filter @revealui/router test && pnpm gate:quick"
```

- [ ] **Step 10: Write GAP-026.yml**

```yaml
id: GAP-026
feature: ci
name: SBOM generation in release pipeline
priority: low
owner: agent
status: open
file: ".github/workflows/release.yml"

work:
  - "Add SBOM generation step using @cyclonedx/bom or similar"
  - "Generate CycloneDX SBOM as part of release workflow"
  - "Upload SBOM as release artifact"
  - "Add SBOM verification step"

acceptance:
  - "Release pipeline generates CycloneDX SBOM"
  - "SBOM uploaded as release artifact"
  - "SBOM validates against CycloneDX schema"

verify: "Run release workflow in dry-run mode and check SBOM artifact"
```

- [ ] **Step 11: Remove .gitkeep**

```bash
rm ~/projects/revealui-jv/docs/gaps/.gitkeep
```

- [ ] **Step 12: Commit all gap files**

```bash
cd ~/projects/revealui-jv
git add docs/gaps/
git commit -m "chore(gaps): seed 26 gap files from codebase audit

Each gap has full work, acceptance, and verify fields.
Part of the three-layer feature lifecycle system.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Chunk 5: Agent Rule (private repo — revealui-jv)

### Task 17: Write the feature-gaps agent rule

**Files:**
- Create: `~/projects/revealui-jv/.claude/rules/feature-gaps.md`

- [ ] **Step 1: Write the rule**

```markdown
# Feature Lifecycle — Agent Rule

## File Locations

| Layer | Repo | Path | Format |
|-------|------|------|--------|
| Roadmap targets | revealui-jv | `docs/roadmap/<feature>.yml` | YAML |
| Gap files | revealui-jv | `docs/gaps/GAP-NNN.yml` | YAML |
| Reality docs | RevealUI | `docs/features/<feature>.yml` | YAML |

## Session Start

1. Glob `~/projects/revealui-jv/docs/gaps/GAP-*.yml`
2. Count open gaps by priority: `grep -l 'status: open' | xargs grep 'priority:' | sort | uniq -c`
3. Report: "N blockers, N high, N medium, N low gaps open"
4. If any `owner: human` blocker gaps exist, flag: "[gap name] needs human action"
5. Do NOT auto-claim gaps. Wait for user direction.

## Natural Language Intent

Recognize these intents from conversation and act accordingly:

**Status inquiry** — "what's left", "how's billing", "show me gaps", "what needs work"
→ Read gap files. Render priority-sorted table with id, name, owner, status.

**Work request** — "pick something", "work the gaps", "what's next", "just go"
→ Filter: `owner: agent`, `status: open`. Sort by priority (blocker > high > medium > low). Present top candidates or start working the highest-priority one.

**Target inquiry** — "where should auth be", "what's the plan for editors"
→ Read `roadmap/<feature>.yml`. Render acceptance criteria with done/owner.

**Feature detail** — "what works in billing", "is AI ready"
→ Read `features/<feature>.yml` from RevealUI. Render api-surface, ui-surface, limitations.

**Gap creation** — "there's a problem with X", "I found a bug in Y"
→ Create new gap file. ID: glob `gaps/GAP-*.yml`, parse max numeric suffix, add 1, zero-pad to 3 digits. Assign priority and owner. Continue current work.

## Working a Gap

1. Register gap on the workboard (existing coordination system)
2. Read gap file: `work`, `acceptance`, `verify` fields
3. Check `blocked-by` — if any listed gaps are still open, skip. Present next gap.
4. If more context needed, read `roadmap/<feature>.yml` and `features/<feature>.yml`
5. Do the work in `~/projects/RevealUI`
6. Run the `verify` command
7. Update `features/<feature>.yml` in RevealUI (add/modify api-surface, ui-surface, or limitations)
8. Set gap `status: closed` and `closed-date: YYYY-MM-DD`
9. Commit both repos (see below)
10. Remove from workboard
11. Present next available gap if user wants to continue

## Cross-Repo Commits

Two separate commits. Public repo does NOT reference gap IDs.

```
# 1. RevealUI (public) — code + reality doc
cd ~/projects/RevealUI
git add <changed-files> docs/features/<feature>.yml
git commit -m "fix(<scope>): <description>"

# 2. revealui-jv (private) — closed gap
cd ~/projects/revealui-jv
git add docs/gaps/<GAP-ID>.yml
git commit -m "chore(gaps): close <GAP-ID> — <gap name>"
```

## Discovering New Gaps

When work reveals a new issue:
1. Create `gaps/GAP-NNN.yml` with next available ID
2. Priority: blocker (breaks agent surface or immoral to charge) > high (degrades data integrity) > medium (human surface) > low (cosmetic/deferred)
3. Owner: `agent` if autonomous, `human` if manual action required
4. Continue current work — do not switch to the new gap

## Human Gaps

- Never claim `owner: human` gaps
- If a human gap blocks an agent gap: tell user "[gap] blocked by [human gap] — needs your action"
- Human gaps are visible in status queries but skipped in work requests
```

- [ ] **Step 2: Commit the rule**

```bash
cd ~/projects/revealui-jv
git add .claude/rules/feature-gaps.md
git commit -m "chore(rules): add feature-gaps agent rule

Teaches agents to read roadmap/reality/gap YAML files,
work gaps autonomously, and respond to natural language
queries about feature status.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Chunk 6: Verification

### Task 18: End-to-end verification

- [ ] **Step 1: Verify all files exist**

```bash
# Reality docs (public)
ls ~/projects/RevealUI/docs/features/*.yml | wc -l
# Expected: 15

# Roadmap targets (private)
ls ~/projects/revealui-jv/docs/roadmap/*.yml | wc -l
# Expected: 18

# Gap files (private)
ls ~/projects/revealui-jv/docs/gaps/GAP-*.yml | wc -l
# Expected: 26

# Agent rule
head -5 ~/projects/revealui-jv/.claude/rules/feature-gaps.md
# Expected: rule content starting with "# Feature Lifecycle"

# ADR
head -5 ~/projects/RevealUI/docs/architecture/ADR-001-agent-first.md
# Expected: "# ADR-001: Agent-First, Human-Readable"
```

- [ ] **Step 2: Verify features.ts is clean**

```bash
cd ~/projects/RevealUI
grep -c 'editors\|harnesses' packages/core/src/features.ts
# Expected: 0
```

- [ ] **Step 3: Verify PRO.md is clean**

```bash
grep -c "isFeatureEnabled('harnesses')" ~/projects/revealui-jv/docs/PRO.md
# Expected: 0
```

- [ ] **Step 4: Verify gate passes**

Run: `cd ~/projects/RevealUI && pnpm gate:quick`
Expected: PASS

- [ ] **Step 5: Verify YAML files parse correctly**

```bash
cd ~/projects/RevealUI
node -e "
const fs = require('fs');
const dir = 'docs/features';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.yml'));
let ok = 0, bad = 0;
for (const f of files) {
  try {
    const c = fs.readFileSync(dir + '/' + f, 'utf8');
    // Basic YAML structure check
    if (!c.includes('feature:')) throw new Error('missing feature field');
    if (!c.includes('status:')) throw new Error('missing status field');
    if (!c.includes('tier:')) throw new Error('missing tier field');
    if (!c.includes('last-verified:')) throw new Error('missing last-verified field');
    ok++;
  } catch(e) { bad++; console.error(f + ': ' + e.message); }
}
console.log(ok + '/' + files.length + ' reality docs valid');
"
# Expected: 15/15 reality docs valid

cd ~/projects/revealui-jv
node -e "
const fs = require('fs');
const dir = 'docs/gaps';
const files = fs.readdirSync(dir).filter(f => f.startsWith('GAP-') && f.endsWith('.yml'));
let ok = 0, bad = 0;
for (const f of files) {
  try {
    const c = fs.readFileSync(dir + '/' + f, 'utf8');
    if (!c.includes('id:')) throw new Error('missing id field');
    if (!c.includes('work:')) throw new Error('missing work field');
    if (!c.includes('acceptance:')) throw new Error('missing acceptance field');
    if (!c.includes('verify:')) throw new Error('missing verify field');
    ok++;
  } catch(e) { bad++; console.error(f + ': ' + e.message); }
}
console.log(ok + '/' + files.length + ' gap files valid');
"
# Expected: 26/26 gap files valid
```

- [ ] **Step 6: Test natural language intent (manual)**

Start a new Claude Code session in the RevealUI project. Say "what's left". Verify the agent reads gap files and presents a summary. This confirms the agent rule is loaded and working.
