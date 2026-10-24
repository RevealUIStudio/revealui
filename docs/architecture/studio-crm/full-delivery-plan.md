# RevealUI CRM — full draft delivery plan

Status: draft; no deployment or production claims. Owner: RevealUI Studio. Tracking: #3127, PR #3128.

## Core modules
Organizations, external Contacts, Opportunities, Activities, Tasks, Campaigns, Outreach Drafts, Suppression, Stage History, Dashboard, Imports and native AI assistance.

## Reuse-first architecture
- Account membership from `packages/db/src/schema/accounts.ts`.
- Existing ticket and board infrastructure from `packages/db/src/schema/tickets.ts` after verifying authorization boundaries.
- Existing admin collection registry and typed storage; do not add a collection without matching backing storage.
- PostgreSQL and Drizzle via `@revealui/db`.
- Native local inference and MCP only. No Claude memory, Claude SDK or external CRM.

## Work packages
1. Complete schema: composite account-scoped keys, validation constraints, indexes, migration generation, rollback.
2. Services: server-verified account membership, scoped CRUD, deduplication, transactions, stage history, suppression.
3. UI: organizations/contacts, pipeline board, opportunity details, activities and next actions.
4. Campaigns: draft/review/approve lifecycle, public-source provenance, unsubscribe handling; outbound sending disabled until reviewed transport.
5. Native AI: optional local research and drafting with citations, human review and no automatic sending.
6. Import: preview, dedupe, idempotency, explicit confirmation, error log.
7. Analytics: stage funnel, overdue follow-ups, meetings, proposals, wins and realized revenue.
8. Verification: unit/integration/e2e, cross-account denial, migration smoke, accessibility, staging and rollback.

## Blocking safety conditions
A CRM contact must never be provisioned as an auth user automatically. All reads, writes and exports must be account scoped. Composite foreign keys require matching unique keys. Nullable contact organization must not accidentally null the non-null accountId on deletion. An assigned internal user must be an active member of the account. Suppressed contacts cannot be sent messages. Drafting is not sending.

## Release status
Schema-only work exists; service, UI, import and deployment remain unimplemented. Do not merge until full tests and reviews pass.
