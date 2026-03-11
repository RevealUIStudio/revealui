# Agent-First Feature Lifecycle System

**Date:** 2026-03-11
**Status:** Design
**Author:** RevealUI Studio + Claude Opus 4.6

---

## 1. Problem

RevealUI's codebase contains feature flags for features that don't exist (`editors`, `harnesses`). Documentation mixes aspirational targets with current reality. There is no structured system for agents to autonomously identify, prioritize, and close gaps between where features are and where they should be. Humans must manually direct every work session.

Separately, the product itself lacks a coherent philosophy about who the primary consumer is — agents or humans. The audit revealed a strong API layer (A-) alongside a skeletal admin UI, but no explicit decision about which interface is primary.

## 2. Design Principle: Agent-First, Human-Readable

This principle applies to the entire RevealUI product and development workflow. It is documented here as the motivating philosophy for this system, and should be extracted into a standalone architecture decision record (`docs/architecture/ADR-001-agent-first.md`) during implementation.

### The principle

Every system in RevealUI has two interfaces:

1. **Programmatic surface:** Structured data (YAML, JSON, OpenAPI, Zod schemas) that agents and automated tools parse deterministically. This is the primary interface.

2. **Human surface:** Rendered views produced on demand when a human requests information. The human asks a question in natural language and receives a formatted answer. Browser-based UIs, dashboards, and documentation sites are renderers — projections of the programmatic surface, not independent systems.

The programmatic surface is built first. The human surface is built on top of it. Never build a human interface without the programmatic interface beneath it.

### Two distinct programmatic surfaces

This spec concerns itself with the **development workflow programmatic surface** — YAML files that development agents read to manage feature lifecycle. The **product programmatic surface** (REST API, OpenAPI spec, Zod contracts) is a separate concern already implemented. These are different audiences:

- **Product programmatic surface:** End-user agents and integrations consume the REST API via OpenAPI. Changes to this surface are product work.
- **Development programmatic surface:** Development agents (Claude Code sessions) consume roadmap/reality/gap YAML files. Changes to this surface are this spec's scope.

### Priority implication

When triaging work, programmatic surface gaps outrank human surface gaps at the same severity level. A missing OpenAPI route (agents can't discover an endpoint) is higher priority than a missing admin UI field renderer (a human can't click a dropdown).

## 3. Three-Layer Feature Lifecycle

Three layers of structured YAML files across two repos. Agents are the primary consumers. Humans access everything through conversation.

### Layer 1: Roadmap Targets (private)

**Location:** `~/projects/revealui-jv/docs/roadmap/<feature>.yml`

One YAML file per feature. Describes the target state — what "done" looks like. Each acceptance item is written so an agent can verify whether the codebase satisfies it.

```yaml
feature: billing
name: Stripe Billing & Payments
tier: pro
depends-on: []
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
  - id: env-vars
    done: "All 6 mandatory billing env vars set in Vercel production"
    owner: human
```

Each acceptance item has an `owner` field:
- `agent` — an agent can verify and implement this autonomously
- `human` — requires human action (credentials, dashboard config, legal sign-off)
- `agent-then-human` — agent writes code, human performs a manual step

Features that don't exist yet (e.g., `editors`, `harnesses`) still get roadmap files. The roadmap is where intent lives. Code only contains what's real.

### Roadmap YAML Schema

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `feature` | yes | string | Identifier matching the reality doc filename (without `.yml`) |
| `name` | yes | string | Human-readable feature name |
| `tier` | yes | enum: `free`, `pro`, `max`, `enterprise` | Minimum license tier |
| `depends-on` | yes | string[] | Feature IDs this feature requires (empty array if none) |
| `acceptance` | yes | array | List of acceptance items |
| `acceptance[].id` | yes | string | Unique identifier within the feature |
| `acceptance[].done` | yes | string | Verifiable statement of what "done" means |
| `acceptance[].owner` | yes | enum: `agent`, `human`, `agent-then-human` | Who can complete this |

### Layer 2: Reality Docs (public)

**Location:** `~/projects/RevealUI/docs/features/<feature>.yml`

One YAML file per feature. Describes what actually works today. Structured with explicit agent-surface and human-surface sections so agents know what interfaces exist.

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
    summary: "Usage overage tracked in DB but not reported to Stripe"
  - id: key-rotation
    surface: api
    summary: "No kid claim in license JWTs — key rotation breaks verification"
  - id: github-provisioning
    surface: api
    summary: "Perpetual license GitHub team add is fire-and-forget, no retry"
```

Status values:
- `production` — tested, deployed, safe to charge for
- `beta` — works but has known gaps
- `alpha` — partially implemented
- `stub` — interface exists, implementation doesn't
- `planned` — in roadmap only, no code

Features that don't exist yet (editors, harnesses) have NO reality doc. The absence of a file IS the signal that the feature is not implemented. A reality doc is created when the first functional code ships — not when stubs, scaffolding, or type-only interfaces exist. When the feature ships, the reality doc is created in the same PR.

### Reality Doc YAML Schema

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `feature` | yes | string | Identifier matching the roadmap filename |
| `name` | yes | string | Human-readable feature name |
| `status` | yes | enum: `production`, `beta`, `alpha`, `stub` | Current implementation status |
| `tier` | yes | enum: `free`, `pro`, `max`, `enterprise` | Minimum license tier |
| `last-verified` | yes | date (YYYY-MM-DD) | When this doc was last verified against code |
| `api-surface` | no | map | Programmatic interfaces (endpoints, configs) |
| `api-surface.<id>.endpoint` | yes (if entry exists) | string | HTTP method + path |
| `api-surface.<id>.openapi` | yes (if entry exists) | boolean | Whether endpoint is in OpenAPI spec |
| `api-surface.<id>.input-validation` | no | string | Validation method (zod, stripe-signature, etc.) |
| `api-surface.<id>.tested` | yes (if entry exists) | boolean | Whether automated tests exist |
| `ui-surface` | no | map | Human-facing interfaces (pages, components) |
| `ui-surface.<id>.location` | yes (if entry exists) | string | File path |
| `ui-surface.<id>.status` | yes (if entry exists) | enum: `functional`, `basic`, `stub` | Completeness |
| `limitations` | no | array | Known limitations |
| `limitations[].id` | yes | string | Unique identifier |
| `limitations[].surface` | yes | enum: `api`, `ui`, `both` | Which surface is affected |
| `limitations[].summary` | yes | string | One-line description |

Note: Reality doc uses `api-surface` and `ui-surface` (not "agent surface" / "human surface") to avoid overloading the design principle terminology.

### Layer 3: Gap Files (private)

**Location:** `~/projects/revealui-jv/docs/gaps/<id>.yml`

One YAML file per gap. A gap is a specific, actionable delta between a roadmap target and reality. Each gap is a task definition precise enough for an agent to execute without interpretation.

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
  - "Existing tests still pass"

verify: "pnpm --filter api test && pnpm gate:quick"
```

### Gap YAML Schema

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `id` | yes | string | Unique identifier: `GAP-NNN` (zero-padded 3 digits) |
| `feature` | yes | string | Links to roadmap and reality doc by feature ID |
| `name` | yes | string | One-line description |
| `priority` | yes | enum: `blocker`, `high`, `medium`, `low` | Triage priority |
| `owner` | yes | enum: `agent`, `human`, `agent-then-human` | Who can complete this |
| `status` | yes | enum: `open`, `closed` | No intermediate states; active work tracked on workboard |
| `blocked-by` | no | string[] | Gap IDs that must close before this gap can be worked |
| `file` | no | string or string[] | Primary file(s) involved, for agent context |
| `work` | yes | string[] | Ordered list of specific steps to complete the gap |
| `acceptance` | yes | string[] | Conditions that must be true when done |
| `verify` | yes | string | Command(s) to run to confirm completion |
| `closed-date` | no | date (YYYY-MM-DD) | Set when status changes to closed |

### Gap ID Allocation

To determine the next gap ID: glob `gaps/GAP-*.yml`, parse the numeric suffix from each filename, take the maximum, add 1, zero-pad to 3 digits. Example: if `GAP-026.yml` is the highest, the next gap is `GAP-027.yml`. If two agents create gaps concurrently, the file write will not collide because filenames differ — each agent increments independently. In the unlikely event of a duplicate ID, the second agent's commit will show the conflict and should increment again.

### Seeding Requirement

All 26 gap files seeded during implementation must include populated `work`, `acceptance`, and `verify` fields — not just names. A gap without work items violates the principle that gaps are "precise enough for an agent to execute without interpretation."

When a gap is closed, the agent sets `status: closed`, adds `closed-date`, and updates the corresponding reality doc. The gap file remains as a historical record.

## 4. Agent Rule

A new rule at `~/projects/revealui-jv/.claude/rules/feature-gaps.md` that all agents load.

### Session Start Behavior

1. Glob `~/projects/revealui-jv/docs/gaps/*.yml` where `status: open`
2. Note count by priority (e.g., "3 blockers, 4 high, 2 medium")
3. If any `owner: human` blocker gaps exist, flag them — they may block agent work
4. Do NOT auto-claim. Wait for user direction.

### Natural Language Intent Recognition

When the user asks about feature status, gaps, or roadmap in conversation, the agent reads the relevant YAML files and renders a human-friendly response:

- **Status inquiry** ("what's left", "how's billing", "show me gaps", "what needs work")
  Read gap files and/or reality docs. Render as formatted table or summary.

- **Work request** ("pick something", "work the gaps", "what's next", "just go")
  Read gap files. Filter `owner: agent`, `status: open`. Sort by priority. Present top gaps or begin working the highest-priority one.

- **Target inquiry** ("where should auth be", "what's the plan for editors")
  Read roadmap file for that feature. Render targets and acceptance criteria.

- **Feature detail** ("what works in billing", "is AI ready")
  Read reality doc for that feature. Render agent-surface and human-surface status.

- **Gap creation** ("there's a problem with X", "I found a bug in Y")
  Create a new gap file with appropriate priority and owner.

### Working a Gap

1. Register the gap on the workboard (existing coordination system)
2. Read the gap file for work items, acceptance criteria, and verify command
3. If the gap has `blocked-by` entries, check those gaps are closed first. If not, skip and present the next gap.
4. If more context is needed, read `roadmap/<feature>.yml` and `features/<feature>.yml`
5. Do the work in the RevealUI repo
6. Run the verify command
7. Update `features/<feature>.yml` in the public repo (add/modify entries under `api-surface`, `ui-surface`, or `limitations`)
8. Set gap `status: closed` and `closed-date` in `revealui-jv/docs/gaps/<id>.yml`
9. Commit to both repos (see cross-repo commit workflow below)
10. Remove from workboard
11. Present next available gap if user wants to continue

### Cross-Repo Commit Workflow

When a gap touches both repos, the agent makes two separate commits:

1. **RevealUI (public):** Commit the code changes and updated reality doc.
   ```
   cd ~/projects/RevealUI
   git add <changed-files> docs/features/<feature>.yml
   git commit -m "fix(<scope>): <gap description>"
   ```

2. **revealui-jv (private):** Commit the closed gap file.
   ```
   cd ~/projects/revealui-jv
   git add docs/gaps/<id>.yml
   git commit -m "chore(gaps): close <GAP-ID> — <gap name>"
   ```

The RevealUI commit message does NOT reference gap IDs (public repo should not leak private tracking). The revealui-jv commit message references the gap ID for traceability. Both commits happen in the same session but are independent — if one fails, the other is still valid.

### Discovering New Gaps

When work reveals a new issue (missing index, stub function, unhandled error, undocumented endpoint):

1. Create a new gap file in `revealui-jv/docs/gaps/` with next available ID
2. Assign priority based on: blocker (breaks agent surface or makes charging immoral) > high (degrades agent capability or data integrity) > medium (human surface gaps) > low (deferred, cosmetic)
3. Assign owner based on: can an agent fix this autonomously?
4. Continue current work — do not context-switch to the new gap

### Human Gaps

Gaps with `owner: human` are never claimed by agents. If a human gap blocks an agent gap, the agent tells the user: "[gap name] is blocked by [human gap] — needs your action."

## 5. Code Changes

The code changes in this section are tracked as GAP-005 in the gap system. This section documents the rationale; the gap file is the authoritative task definition.

### Remove phantom feature flags

Delete `editors` and `harnesses` from `packages/core/src/features.ts`:

- Remove from `FeatureFlags` interface (lines 23, 25)
- Remove from `featureTierMap` (lines 54-55)

These features get roadmap YAML files (target state) and gap YAML files (work to implement them). When the implementation ships, the feature flag returns in the same PR as the code.

### Remove references in documentation

- `docs/PRO.md` line 1039 references `isFeatureEnabled('harnesses')` — remove the line. The public repo should not advertise unimplemented features. The harnesses roadmap target in `revealui-jv/docs/roadmap/harnesses.yml` is the authoritative location for this intent.

## 6. Initial Seeding

### Gap Files (from audit)

26 gaps identified. Priority breakdown:

**Blockers — agent (6):**

| ID | Feature | Name |
|----|---------|------|
| GAP-001 | billing | Email notifications silently fail in production |
| GAP-002 | database | Ticket number race condition (non-atomic increment) |
| GAP-003 | api | GDPR endpoints lack Zod validation |
| GAP-004 | database | Missing FK constraints (pages.parentId, tickets.parentTicketId) + missing composite unique (pages slug+siteId) + missing index (collab_edits.documentId) |
| GAP-005 | features | Remove editors/harnesses phantom feature flags |
| GAP-006 | api | Collab routes missing from OpenAPI spec |

**Blockers — human (3):**

| ID | Feature | Name |
|----|---------|------|
| GAP-007 | billing | Configure Stripe Billing Meter or disable overage UI |
| GAP-008 | config | Verify all 6 mandatory env vars set in Vercel production |
| GAP-009 | billing | Set up RESEND_API_KEY in production |

**High — agent (6):**

| ID | Feature | Name |
|----|---------|------|
| GAP-010 | billing | JWT license keys need kid claim for key rotation |
| GAP-011 | billing | GitHub team provisioning needs confirmation and retry |
| GAP-012 | database | sites.pageCount denormalized without DB trigger |
| GAP-013 | database | Cross-DB FK validation at runtime (Supabase to Neon) |
| GAP-014 | api | Ensure all API routes have OpenAPI documentation |
| GAP-015 | api | Structured error codes in all error responses |

**High — human (1):**

| ID | Feature | Name |
|----|---------|------|
| GAP-016 | billing | Cron secret rotation strategy |

**Medium (6):**

| ID | Feature | Name |
|----|---------|------|
| GAP-017 | cms-admin | Admin UI field renderers (blocks, relationships, uploads, arrays) |
| GAP-018 | marketing | Marketing site use presentation components |
| GAP-019 | config | Docker Compose missing infrastructure configs |
| GAP-020 | config | .env.production.example for self-hosted deployments |
| GAP-021 | ci | CI tests switch from warn-only to hard-fail |
| GAP-022 | database | Soft-delete pattern for users and sites |

**Low (4):**

| ID | Feature | Name |
|----|---------|------|
| GAP-023 | studio | Studio desktop app completion (defer to Phase 4) |
| GAP-024 | docs | Documentation site content |
| GAP-025 | router | Router nested routes and middleware support |
| GAP-026 | ci | SBOM generation in release pipeline |

### Reality Docs (from audit)

~15 feature reality docs to seed based on audit findings:

- `auth.yml` — status: production
- `billing.yml` — status: production
- `api.yml` — status: production
- `database.yml` — status: production
- `cms-engine.yml` — status: beta
- `cms-admin.yml` — status: alpha
- `presentation.yml` — status: production
- `config-build.yml` — status: production
- `ci.yml` — status: beta
- `ai.yml` — status: beta (opaque dist-only, integration layer solid)
- `mcp.yml` — status: beta (opaque dist-only)
- `services.yml` — status: beta (opaque dist-only)
- `sync.yml` — status: alpha
- `router.yml` — status: beta
- `marketing.yml` — status: alpha

No reality docs for `editors`, `harnesses`, or `studio` — those features are not ready.

### Roadmap Targets (from audit + MASTER_PLAN)

~18 roadmap target files covering all features including planned ones:

- All 15 features above, plus:
- `editors.yml` — planned, targets Zed/VS Code/Neovim adapters
- `harnesses.yml` — planned, targets AI harness coordination
- `studio.yml` — planned, targets desktop hub completion

## 7. File Tree

```
revealui-jv/
  docs/
    roadmap/
      auth.yml
      billing.yml
      api.yml
      database.yml
      cms-engine.yml
      cms-admin.yml
      presentation.yml
      config-build.yml
      ci.yml
      ai.yml
      mcp.yml
      services.yml
      sync.yml
      router.yml
      marketing.yml
      editors.yml
      harnesses.yml
      studio.yml
    gaps/
      GAP-001.yml ... GAP-026.yml
  .claude/rules/
    feature-gaps.md

RevealUI/
  docs/
    features/
      auth.yml
      billing.yml
      api.yml
      database.yml
      cms-engine.yml
      cms-admin.yml
      presentation.yml
      config-build.yml
      ci.yml
      ai.yml
      mcp.yml
      services.yml
      sync.yml
      router.yml
      marketing.yml
```

## 8. What This System Does NOT Do

- **No custom tooling.** No scripts, no CLI commands, no skills to maintain. Just YAML files and an agent rule.
- **No parallel coordination.** Active work is tracked on the existing workboard. Gap files only track open/closed.
- **No human file reading.** Humans never open YAML files. They ask questions in conversation.
- **No public gap exposure.** Gap files and roadmap targets are in the private repo. The public repo only contains honest reality docs.
- **No feature flags for unimplemented features.** Code only contains flags for features that exist. The roadmap is where aspirational features live.

## 9. Success Criteria

1. An agent starts a session and within one read operation knows what gaps exist, their priority, and whether it can work them.
2. You say "what's left" and get a formatted summary without opening any files.
3. You say "work the gaps" and the agent claims the highest-priority gap, executes it, verifies it, updates reality, and presents the next one.
4. When a gap is closed, the reality doc updates and the gap stops appearing in status queries.
5. Human-only gaps are visible but never attempted by agents.
6. New gaps discovered during work are captured as files without breaking flow.
7. The features.ts file contains only flags for features that actually exist in the codebase.
8. The public repo never advertises features that aren't implemented.
