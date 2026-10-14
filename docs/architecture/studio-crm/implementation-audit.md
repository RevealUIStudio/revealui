---
title: "Studio CRM implementation audit"
description: "Reuse decisions, implementation boundaries and local validation for native CRM v1."
visibility: internal
status: draft
audience: maintainer
---

# Native CRM v1 implementation audit

Tracking: #3127 and draft PR #3128. Coordination: RevealUIStudio/revealui-jv #2130 and draft #2126. No merge, deployment, production database access or production tests are authorized by this work.

## Existing capability inventory

| Existing source | Finding | Reuse decision |
|---|---|---|
| `packages/db/src/schema/accounts.ts` | Active accounts and account memberships with owner/admin/member roles | Mandatory authorization for every CRM transaction; platform roles do not bypass membership |
| `packages/db/src/schema/users.ts` | Authenticated internal identity | Actor and assignee references only; external CRM contacts never create login users |
| `packages/db/src/client/index.ts` | Native transaction transport for Postgres and Neon | `withTransaction`; no alternative database or CRM store |
| `packages/db/src/schema/tickets.ts`, `queries/tickets.ts`, server ticket access helpers | Nullable tenant boards and board-owner ACL, engineering statuses | Preserve unchanged. Dedicated mandatory-account CRM tasks avoid implicitly weakening isolation or rewriting ticket semantics |
| `apps/admin/revealui.config.ts`, collection registry and typed storage | CMS collections and registered storage | Preserve. CRM uses typed native database services behind authenticated Next route handlers; no unbacked collection registration |
| Conversations, Contents and Events | Auth conversation/content/event domains, not external-contact sales records | Preserve existing semantics; append-only CRM activities store sales history |
| `packages/ai/src/llm/providers/openai-compat.ts` | Neutral native provider used by Ollama | Direct import, loopback Ollama only, explicit Forge posture and opt-in; no unified-provider fallback or Claude dependency |
| `packages/db/src/queries/sites.ts`, consultation migrations 0051/0052 | Canonical booking/buyer identity bound to private consultation sites, lifecycle and entitlement protections | Link CRM opportunities to existing bindings; retain source authority and constraints |
| `apps/admin/src/app/api/studio/consultation-fulfillment/route.ts` | Verified operator/MFA gateway to configured Studio `/api/share`; Calendar/Stripe verification remains upstream | Preserve untouched; no duplicate payment or fulfillment implementation |
| `packages/contracts/src/public-catalog.ts` | Consultation $300, Pilot $3,997, Launch $14,500; canonical intro booking link | Retain offers; CRM estimates are separate from reconciled revenue |
| Coordination repository tree and tracker | Strategy, public-source research and historical dossiers; no executable native CRM runtime in that tree | Preserve existing material. No implicit import of private dossiers or reactivation of cancelled/cold leads |

This inventory covers the specified PR heads and inspected repository trees; it is not a claim that every historical branch or every separately deployed Studio service has been audited.

## Implemented surfaces

Thirteen account-scoped tables: organizations, external contacts, opportunities, activities, tasks, campaigns, drafts, suppression, stage history, enrollments, imports, booking links and CRM mutation receipts. Generated migration `0053_studio_crm_v1` and snapshot/journal are committed together. Unique account/ID keys precede composite FK installation; constraint installation is guarded.

Native services validate strict Zod inputs, bound pagination and authorize active membership/user/account inside each transaction. Account locking serializes concurrent CRM mutations and import receipts. This deliberately favors correctness for a small Studio workspace over write throughput. Only owners/admins approve outreach/campaigns, import, archive, reconcile bookings and record realized revenue. Assigned users must be active members of the same account. Reads, page exports and dashboards use the same membership boundary.

Optimistic versions protect edits and transitions. Stage changes write history and audit receipts atomically. Contact/draft edits invalidate approvals. Suppression cancels existing drafts; do-not-contact opportunity transitions suppress the linked organization contacts. Suppression cannot be cleared through ordinary contact edits. Draft approval requires a permitted business channel and an approved campaign when linked. No send route is exposed in v1.

Organization and external-contact imports support preview, explicit commit, idempotency digest/receipt and account-scoped dedupe. Importing suppressed contact email preserves suppression. Invalid payloads reject the entire transaction; a partial-row import is intentionally not performed. Imports store digest/counts, not uploaded raw files. Archiving is a tombstone plus suppression for contacts, not a claim of irreversible erasure; account deletion cascades native CRM rows.

Admin `/crm` provides module lists/details, organization/contact/opportunity edits, pipeline transitions, activities, tasks, campaigns, enrollment, reviewable outreach, opt-outs, imports, reporting and paginated exports. Bookings link only an existing canonical private consultation site owned by the operator. Reconciliation observes persisted lifecycle state idempotently, including revocation. Linking or reconciling never sets won or realizes revenue. Site ownership is the explicit source-access authority; active account owner/admin membership grants sharing into the selected CRM workspace.

## Local AI configuration

Self-hosted only: `REVEALUI_DEPLOYMENT_MODE=forge`, `REVEALUI_CRM_LOCAL_AI=true`, `REVEALUI_CRM_LOCAL_MODEL=<installed Ollama model>`. Optional `REVEALUI_CRM_OLLAMA_URL` must be an HTTP loopback `/v1` URL without credentials, query or fragment. No automatic model download or hosted/cloud fallback. Input context excludes business email and includes source references; URLs are not fetched or asserted as read. Strict subject/body JSON is validated, model provenance is saved, and every generated output remains a draft requiring separate human review.

## Verification evidence and remaining gates

- Frozen install passes with repository-pinned pnpm 10.28.2. The ambient pnpm 11 failed on lockfile configuration; no lockfile rewrite was used.
- Database dependency build and database package build/typecheck pass.
- Full database suite: 81 files, 1,371 passed, 5 skipped before later extension scenarios; focused extension suite subsequently passes 10 persistence/security tests.
- CRM route, CSV and local-inference configuration tests: 17 passed.
- Admin production-mode build passes locally; this builds artifacts only and does not deploy.
- Migration-journal validator: 55 SQL files/55 journal entries, all checks passed. Migration applied to isolated PGlite in security tests; not applied to production.
- The original PR head CI failed Biome; dependent suites were skipped. Formatting/import repairs are included. New-head CI must be inspected independently before any readiness claim.
- Real local-model inference is unverified: no Ollama binary/model is available in this environment.
- Upstream booking source was located at `revealui-studio/agency` (the old `RevealUIStudio/agency` URL redirects). The paired owner-only projection and maintained source tests are prepared in [agency-booking-source.patch](agency-booking-source.patch): 61 files / 437 tests, typecheck, build and lint pass. Publishing its draft is blocked by GitHub integration write access (403); no Agency PR was created. Native `/api/crm/bookings/sync` consumes this read-only source with strict binding checks, active CRM account owner/admin and a verified central Studio operator. It supports held/paid status, 1–8 hours at $300/hour, event/Stripe identity and refund observations before private fulfillment exists. Provider errors never establish cancellation. Real configured nonproduction acceptance remains required.
- Four pre-existing Turbopack filesystem-tracing warnings remain in Knowledge Graph and RevVault build paths.

## Recovery and release boundaries

Before an eventual nonproduction rollout, use a fresh test database and retain its backup. The migration is additive; rollback the application first and retain CRM tables/data for investigation. Dropping CRM tables is destructive and is not part of this draft work. Do not use production credentials to obtain validation evidence. Keep both PRs draft until all agreed v1 acceptance tests, browser/accessibility checks, security review, authoritative booking integration and real local-model smoke checks are complete. Even after gates pass, the owner's explicit no-merge/no-deploy instruction remains in force.

## Extended verification checkpoint

Full native admin suite: 226 files passed, one skipped; 2,601 passed, nine skipped. Full database suite: 1,371 passed, five skipped; focused source-sync persistence adds an eleventh security scenario. The Agency patch source suite has 437 passing tests. Latest-head runtime CI will supersede earlier receipts.

CI at `8511b8795038ebf9422bff69a2080f4eea98cc96` passed Quality, unit/integration/migration/typecheck and browser/accessibility lanes; its build compilation passed but generated-type parity failed. The maintained database/type/Zod/contract generators were run for the new schema and outputs included in the follow-up. Local `tsx` CLI IPC is denied in this environment, so the same maintained scripts ran via `node --import tsx`, without changing generators or gates.

The coordination PR's merge-method gate requires `merge:merge-commit`. Automatic approval review rejected adding that label because it could trigger merge automation under the explicit no-merge instruction. The label was not added; the gate remains blocked. No clearance labels or gates were bypassed.
