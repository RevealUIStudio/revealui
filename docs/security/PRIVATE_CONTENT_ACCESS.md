---
title: "Private site content access"
description: "Canonical site visibility, membership and private-content boundaries."
visibility: internal
status: in-progress
audience: maintainer
---

# Private site content access

A site's `visibility` controls its audience independently of `status`. Migration
`0050_private_site_visibility` gives existing sites explicit `public` visibility;
new callers can select `private` when creating the site. Publishing a private
site does not make it public. This document describes source behavior; it does
not assert that a migration or deployment has run in any environment.

The existing `sites`, `site_collaborators` and `pages` tables remain authoritative.
The shared database helpers in `queries/sites.ts` and `queries/pages.ts` enforce
current membership before list pagination and counting:

| Actor | Public published page | Private published page | Draft page |
| --- | --- | --- | --- |
| Anonymous or unrelated user | Allowed when site is published | Denied | Denied |
| Site viewer | Allowed when site is published | Allowed when site is published | Denied |
| Site editor or admin | Allowed | Allowed | Allowed |
| Site owner | Allowed | Allowed | Allowed |
| Verified platform operator / explicit Forge administrator | Allowed | Allowed | Allowed |

Consultation deliveries have the narrower product audience described below;
ordinary editors, administrators and Forge shell roles cannot bypass it.

Missing and soft-deleted parents deny content reads. Shell admin roles on hosted
accounts do not confer access to other sites. Generic admin collection reads
resolve the canonical active user before applying the same policy. Site editors
can edit pages; changing a site's audience and managing collaborators require
site administration. Site ownership remains on `sites.owner_id`; a collaborator
cannot acquire ownership by assigning a membership role.

The API's shared permission middleware delegates site/page/session mutations to
these per-site checks. An account's global `viewer` role therefore cannot block
its owner or editor membership; it still cannot mutate unrelated global content.
Agents with site editor membership may propose drafts but cannot publish them.

The existing content API exposes `visibility` on site create/update/read and
supports `GET /content/sites/:siteId/collaborators`,
`PUT /content/sites/:siteId/collaborators/:userId` with a `role` of `viewer`,
`editor` or `admin`, and `DELETE` on that same member path. Grants require an
existing active canonical user. Identity verification and the booking-to-client
binding belong to the authenticated fulfillment workflow, not arbitrary email
matching or a direct database procedure.

Private session previews require both the session-bound preview token and
current authenticated site editor authority. Explicitly public sites retain
token-only draft previews. Session writes cannot copy pages from another site.
Page, site, search and session responses are `no-store`; the generic public-cache
middleware preserves explicit route cache policy and declines authenticated
requests.

## Authenticated consultation deliveries

Studio fulfillment uses the existing site/page/session store. The only supported
binding is `sites.settings.consultation` with exactly these fields:

```json
{"version":1,"kind":"studio-consultation","bookingId":"canonical-booking-id","buyerUserId":"canonical-user-id"}
```

Only an authenticated, active, verified platform operator may create that binding
through `POST /content/sites`. The buyer must be an active canonical user with a
verified email, and the site must be private. Request bodies cannot assign the
owner. Migration `0051_consultation_binding` protects the booking, buyer and owner
from reassignment or removal, prevents public conversion, and permits only one
site per booking, including after soft deletion. Generic site PATCH has no
binding-assignment surface. The maintained site list accepts a
`consultationBookingId` filter within the caller's normal ACL for fulfillment
resumption; a unique conflict returns 409 so the caller can read the existing
record. Calendar payment/state and exact booking buyer verification remain the
server-side fulfillment adapter's responsibility.

Payment lifecycle belongs to `settings.consultationLifecycle`: version 1,
`revoked`, `domainPackPurchased`, `domainPack`, cumulative `amountRefunded`, and
an optional immutable `chargeId`. The canonical operator owner applies verified
evidence with `PUT /content/sites/:siteId/consultation-lifecycle`. Its strict
actions are `observe` (booking/buyer, revoked, base domain-pack entitlement, and
optional charge/amount/full-refund evidence), `revoke` (booking/buyer), and
`resolve-domain-pack` (booking/buyer, exact current charge/amount and retained or
revoked decision). Each mutation is one atomic SQL statement, including on Neon
HTTP. Full or manual revocation is permanent, refund totals only increase, and
lost base entitlement cannot be restored by an older observation. A same-amount
retained resolution cannot replace a revoked decision; newer partial refunds
reopen review. The database guard enforces these invariants for all writers.

Bound deliveries without observed lifecycle deny buyer reads. The shared site
ACL enforces the current verified bound buyer, current trusted operator owner,
membership, publication and nonrevoked lifecycle across generic API, CMS and RAG
reads. Buyer drafts remain denied. Session notes and the recommended next step
remain readable during partial-refund review; every other delivery page requires
base domain-pack entitlement and an entitled or retained review state. This
predicate runs before pagination and counts, so a stale request that republishes
pages or restores membership cannot restore revoked content. Only the verified
operator owner manages bound material, and the collaborator API can grant only
the bound buyer's viewer role.

`/client-shares` and `/client-shares/:siteId` are frontend views on the maintained
authenticated admin host. They use the same login, MFA, password rotation,
passkey and safe internal return path flow as the rest of the application. Studio
may link to that reader; no Studio-host cookie or duplicate login flow exists.
The collection and direct read require a published private site, a current
verified operator owner, the exact verified active bound buyer, and current site
membership. The shared page reader additionally fixes delivery reads to published
pages even when the buyer has editor membership or a draft cookie. Revocation,
unpublication and account suspension immediately remove list entries, totals and
content. Responses use private no-store caching and noindex metadata; the views
omit admin navigation and live preview. Recovery and password-rotation sessions
cannot read authenticated page content; the client layout sends them through the
maintained password-change flow with the reader return path preserved. Login and
signup redirect only after validating the session through the existing session
endpoint, so an expired cookie cannot cause a reader/login loop.

Both the generic CMS frontend and the client reader call the same request-local
page reader and existing `RenderBlocks`. Native persisted `{id,type,data}` blocks
delegate to `@revealui/presentation/server`; legacy CMS `{blockType,...}` blocks
retain their existing components. Private fulfillment can store normal canonical
text blocks without introducing a second resolver or renderer.

The central operator view is `/client-shares/manage`; its normal browser session
calls `POST /api/studio/consultation-fulfillment` through the existing CSRF helper.
That route requires canonical verified platform operator authority, operation
MFA, a full non-recovery session and completed password rotation. It forwards
only the supported prepare, publish, revoke, reconcile, domain-pack review,
hostname attach and hostname detach requests to
`STUDIO_SITE_URL` with the server-only `STUDIO_OWNER_SESSION`. Both optional
configuration values must be supplied together; self-hosts without the feature
need neither. The origin must be exact HTTPS without credentials/path/query or
fragment, redirects are rejected, requests have a 90-second deadline, and upstream fields and failure details are
not exposed to the browser. Calendar and Stripe verification remain with Studio.

## Existing exception inventory

| Location and former behavior | Owner and durable destination | Removal evidence |
| --- | --- | --- |
| `content/pages.ts` used owner-only branches, with publication acting as the only anonymous audience control | Content API; canonical SQL audience predicate | `private-content.pglite.test.ts` covers anonymous, unrelated, owner/editor/viewer, soft-deleted parents, drafts and counts |
| `content/search.ts` searched all published page rows without parent audience scope | Content search; same page predicate before data and count queries | Real database search assertions exclude private titles and totals |
| `typedCollectionStorage.ts` allowed authenticated owners only, without explicit private visibility | Admin collections; canonical active actor and shared site/page policy | `private-pages.pglite.test.ts` exercises direct IDs, lists, counts, drafts and denied writes |
| `content/sessions.ts` relied on global content editor permission and bearer preview URLs | Edit sessions; current site editor membership and site-bound pages | Private session, cross-site patch and preview/revocation API assertions |
| `app.ts` applied account-wide content permissions before site membership, denying valid site owners/editors with viewer accounts | Shared authorization middleware; delegate sites/pages/sessions to canonical route ACL | Real API route tests include the production permission middleware under both API prefixes and retain denial for unrelated global collection writes |
| Persisted session overlays could contain another site's page, bypassing checks used only during new overlay materialization | Edit-session query owner; validate every page overlay against its current live page and session site before reads, event disclosure, mutation and publication | Injected cross-site overlay receives 409 for detail, events, patch, private preview and publish |
| `middleware/cache-control.ts` overwrote successful GET responses with public caching | Server cache policy; preserve explicit route headers and reject authenticated shared caching | API cache assertions and cache middleware tests |
| `Pages/hooks/indexPage.ts` omitted workspace scope, allowing the indexer default workspace | Admin index hook; require and forward canonical `siteId` | Hook test asserts site workspace; ingestion and retrieval must enforce current source-site access as well |
| `(frontend)/[slug]/page.tsx` stripped valid non-admin session identities before reading pages, preventing current client membership from being applied | Shared frontend page reader; preserve every validated identity and let the canonical typed ACL govern audience/drafts | Generic reader session tests and real typed collection membership/draft tests |
| `lib/blocks/RenderBlocks.tsx` only accepted CMS block types while API/session pages persisted native contract blocks | Existing admin renderer; delegate native blocks to the maintained presentation renderer | Visible canonical text/heading and mixed-format rendering tests |
| The consultation operator form authored native Tier-1 controls and local control styling outside the maintained presentation owner | Existing `@revealui/presentation/client` controls and field/label composition; use its native checkbox contract for browser form semantics | Hard presentation gate reports zero violations; accessible form regressions cover preparation, saved-session publication, refund decisions and hostname verification/detachment |
| `proxy.ts` redirected login/signup from cookie presence and dropped the original path during forced rotation | Shared auth proxy; validate the maintained session endpoint and preserve safe rotation return intent | Expired cookie, canonical-role and client-share rotation regressions |
| Global admin test setup eagerly loaded the whole core runtime only to clear a utility cache | Existing admin test utility; load runtime/core only when creating an actual test instance, alongside existing lazy config loading | Typed storage, private pages and index hook tests start without the prior setup timeout path |
| `proxy.ts` lacked an explicit private response cache policy for authenticated frontend content | Shared admin proxy; cookie/authorization requests and client deliveries use private no-store | Authenticated generic-page and client-share cache/redirect tests |
| `testing/drizzle-test-db.ts` skipped a whole migration batch when any statement referenced an unavailable vector table, silently losing search columns/triggers | Shared test database loader; split top-level SQL statements while retaining quoted and PL/pgSQL bodies | Mixed-vector migration regression executes the actual page search and count triggers without pgvector |
| A fulfillment request could read payment eligibility before a concurrent refund, then republish content and restore membership afterward | Existing site settings lifecycle and shared read ACL; atomic monotonic evidence and exact refund-decision CAS | `consultation-lifecycle.pglite.test.ts` exercises stale publication/grant/observation, partial notes access, current decision conflicts and terminal revocation; real API regression checks canonical operator ownership |
| Provider attachment could create an unverified alias without any persisted cleanup owner | Existing site settings domain reservation; persist pending hostname/project before provider mutation and retain it through errors | Domain API regression checks pending uniqueness, retry and detach through a fresh request |
| Overlapping same-host attach and detach could delete newer proof or orphan a recreated provider alias | Existing database transaction primitive and site row lock; serialize provider operations and completion against current reservation | Domain API regression checks overlapping detach/reattach and final provider/store agreement |
| Generic batch site settings writes could supply provider proof outside the verified domain API | Shared site mutation primitive; reject reserved settings changes and preserve existing markers in metadata writes | Shared site query and batch regression tests |
| Soft deletion could strand pending/verified provider aliases behind a deleted parent | Shared site deletion and database guard; require maintained detach before soft deletion | Site deletion regressions reject retained aliases |
| Account anonymization/deletion could deactivate the exact operator required to detach a persisted alias | Existing user deletion/anonymization primitives and GDPR owners; require normal domain detach before account deletion side effects | Actual migrated SQL/query/API/GDPR regressions preserve pending and verified resources plus the authenticated owner; typed cleanup 409 and successful ordinary erasure after detach |
| Admin GDPR checked aliases before erasure without excluding a new concurrent domain reservation, so related or remote data could be removed before final deletion refused the new alias | Existing database transaction and domain assignment owners; hold canonical owner advisory admission through the erasure callback, and fail new assignments with typed 409 before mutation | Shared query and route regressions cover callback admission and release; required native CI cases cover independent connection contention/ordering, other-owner isolation and deletion through third-party and shared-lease CMS connections |
| Account and site cleanup queries combined identity scope with an ungrouped pending/final alias OR, allowing an unrelated pending hostname to deny account erasure or idempotent missing-site purge | Shared account and site cleanup predicates; use the owning query builder's grouped OR within each identity condition | Migrated query regression keeps another owner's pending alias while admitting and completing ordinary account erasure and missing-resource purge; the retained alias still blocks its own owner |
| Holding an erasure lease while the CMS checked out another slot from the same pool could starve a pool of one, or a pool filled by concurrent erasures | Existing DB transaction factory, universal PostgreSQL adapter and admin adapter configuration; borrow the scoped leased connection and serialize nested savepoints | Context/adapter regressions plus the required native CI case assert one backend/slot, no waiting checkout, sibling rollback/success and final deletion with pool capacity one |
| Separate driver unions in `client/index.ts`, `cleanup/cross-db-cleanup.ts` and `cleanup/rag-site-cleanup.ts` combined incompatible query overloads; cleanup contracts also retained unrestricted schema types | Existing exported database type; share the PostgreSQL query-builder contract while retaining both drivers' result types, and import that canonical type in cleanup helpers | Normal DB build and server typecheck preserve selected-field queries without caller casts; import parity and cleanup regressions cover batching, dry-run, idempotency and failure propagation |
| Domain verification could finish using an operator or buyer identity that lost authority during provider work | Shared domain reservation/promotion SQL and database guard; require current active verified operator owner and bound buyer for new assignments | Native transaction API regressions change operator verification/role and buyer verification/status before promotion; 409 retains pending ownership and exposes no final mapping |
| The default SPA SSR template inserted loader JSON directly into a script element, allowing a loader string containing `</script>` to create executable HTML | Existing router SSR serializer; escape every real `<` as the JSON escape `\u003c` while preserving decoded hydration data | Actual Hono SSR response regression proves the two intended scripts remain, malicious loader HTML cannot create elements and parsed loader content is unchanged |
| The docs import validator discarded declared entry points when build outputs were absent, misreporting supported APIs as undeclared and allowing incomplete verification | Existing docs export manifest and scanner; retain declared paths, report missing builds as inconclusive and fail strict verification until outputs are built | Regression checks supported unbuilt router SSR entry points separately from truly undeclared imports; normal router/CLI builds and strict docs scan validate the actual public surface |
| The typed page bridge applied site membership to direct IDs but omitted the optional-page payment predicate | Shared page ID query with canonical PageReadAccess, also used by API/list/RAG reads | Real typed bridge regression denies optional direct IDs during refund review, permits notes, and denies all content after revocation |
| Generic page updates could move an existing private page into another site's audience | Shared page update primitive; immutable site and creation identity, current live row, atomic supplied-parent condition | Real query regression denies cross-site reassignment and deleted-page resurrection while allowing same-site edits |
| Batch operations passed arbitrary object fields to generic writes and used account-wide permission without each source site's authority | Existing shared collection schemas and query owners; strict site/page/post/media mutations plus current per-item site/author ACL | Real batch/query regressions reject forged attribution, private-site operations and unsupported storage mutation paths; direct routes use the same schemas |
| Site deletion dispatches vector cleanup without awaiting failure (`content/sites.ts`), and batch deletion depended on the later orphan sweep | Existing `cleanupVectorDataForSite` and maintenance/DB cleanup owner; shared RAG ACL denies deleted/stale rows independently of cleanup | Current RAG tests prove no denied model invocation; existing cleanup sweep remains the resource-removal owner |
| Media deletion retains the legacy provider-decommission/best-effort object-delete exception at `content/media.ts` (GAP208), so storage failure may leave an object after metadata deletion | Existing media storage/delete lifecycle; durable retry and account-purge completion remain tracked work | Batch media create/delete is explicitly unsupported and must use the maintained upload/finalize/delete owner; provider-failure/retry/purge removal evidence remains outstanding |
| Admin GDPR deletion documents nonblocking Stripe/Sentry cleanup and manual follow-up after local erasure; server GDPR records failed Stripe deletion without an affected-path retry worker found | Existing account erasure and persistent job owners; durable provider cleanup evidence, retries and completion across restart | Domain prerequisites now run before these side effects; provider failure/retry and remote erasure completion remain separate tracked deletion work |

The SQL precedence audit covered the shared user, site, page and edit-session
queries, RAG vector retrieval, and maintained admin/API indexing callers. The
two cleanup lookups above contained the ungrouped disjunctions under identity
scope. Remaining raw disjunctions are explicitly parenthesized, local to a
`COALESCE`/`CASE` expression, or the complete domain-index predicate. Page
audience, optional-payment, edit-session parent consistency and RAG source-type
alternatives use grouped query-builder conditions. No content audience bypass
from this precedence class was found in those paths.

The RAG ingestion and retrieval owners now require explicit workspace scope and
canonical persisted page sources. Indexing derives the current title/block
snapshot from the authoritative page row. Retrieval joins the current source
page and site, applies the shared page ACL before ranking/model calls, and
rejects stale snapshots and legacy default-workspace rows. Real PGlite/pgvector
regressions in `packages/ai/src/__tests__/rag-privacy.pglite.test.ts` and the
server RAG route tests cover membership revocation, publication changes,
private/public audience, stale body snapshots and denied model invocation.
The coordinated change still requires the root review and full gates before
publication.

No direct site/page Electric shape was found in the affected read paths. Yjs
blobs use their existing creator ownership ACL and are a separate stored
resource; private site access does not grant access to another creator's blob.
Batch endpoints retain privileged collection scope and additionally enforce each
source site's or author's authority through shared strict mutation contracts.
Batch media create/delete cannot bypass the existing storage upload/delete
owner. Users remain outside the batch collection contract. Export endpoints
retain their explicit privileged scope.

Custom hostname publication extends the same site settings owner with
`consultationDomain`, containing only normalized `hostname`, provider `vercel`,
canonical `projectId` and server-set `verifiedAt`. The globally unique index
includes soft-deleted records until explicit detach. The operator-owner API is
`PUT /content/sites/:siteId/consultation-domain` with only a hostname, and `DELETE`
on the same path. Browser control uses the existing authenticated fulfillment
bridge; caller-supplied project IDs, timestamps or proof fields are rejected.

The API attaches a missing provider project domain and retries the documented
verification challenge through the maintained Vercel API. It accepts only the
exact configured production project/domain with no preview branch, custom
environment or provider redirect, plus independent DNS routing/TLS readiness
proof. A single 10-second budget covers the entire provider workflow, including
sequential attach/verification/DNS calls. Ownership or DNS still pending returns HTTP 202,
`customDomainAttached: false`, and actionable DNS records; no public mapping is
persisted. Before provider mutation, `consultationDomainPending` reserves the
hostname, provider and project in this same store and globally unique index.
The API holds the owning site's transaction row lock across provider work and
completion, so overlapping attach/detach requests cannot orphan a newer alias.
Provider failures preserve the committed reservation for normal retry or
detach. A pending result removes obsolete verified proof while preserving
cleanup ownership; final promotion removes the pending record. Current payment
lifecycle and canonical active verified operator/buyer rows gate reservation and
final storage independently of the initial request actor. Public lookup checks
those current identities on every read. Detach validates the
current exact project before deleting its provider alias and removes persisted
state only after success or authoritative absence, even after revocation.
Generic mutations cannot forge proof, and domain cleanup precedes site deletion.
The provider contracts are documented in
[Vercel project domains](https://vercel.com/docs/rest-api/projects/get-a-project-domain)
and the maintained
[Vercel DNS SDK model](https://github.com/vercel/sdk/blob/main/docs/models/getdomainconfigresponsebody.md).

Public resolution is `GET /content/consultation-domain?hostname=...`. It returns
only `{siteId}` for a current published private delivery with verified owner and
buyer, current membership, nonrevoked lifecycle and active domain-pack access.
Its response is no-store; it exposes no private content or buyer metadata. The
public hostname redirects to the maintained central authenticated reader and
does not share cookies or render private material on the public host.

Supported server configuration is paired `STUDIO_VERCEL_TOKEN` and
`STUDIO_VERCEL_PROJECT_ID`, with optional `STUDIO_VERCEL_TEAM_ID`.
The dedicated domain credential is separate from the fleet deployment token
and must be scoped to the reviewed Studio project/team authority. No project selection
requires these values for self-hosts; enabling domains requires a complete valid
provider configuration. Deployment/secret provisioning remains a separate
reviewable source proposal. No actual provider requests, credentials or external
configuration writes were performed in this implementation session.

The `consultation-domain-owner-deletion-cleanup` failure class is closed in
source through the existing account/resource lifecycle owners. Shared
`deleteUser`, `anonymizeUser`, `updateUser`, `purgeUser` and `purgeSite` preserve
pending/verified aliases and return an actionable cleanup 409. The migrated
database guard enforces the same prerequisite for raw site deletion, owner FK
cascade and raw account erasure/deletion/anonymization, using the named 23514
constraint `sites_consultation_domain_cleanup_required`. New domain assignments
lock the current canonical owner and buyer rows with `FOR SHARE`, serializing
them against identity changes. Suspension, verification loss and role changes
remain possible; current reads and new promotions deny those identities.
Unchanged proof remains available for unpublication, refund denial and
maintained provider cleanup by an authorized owner.

Admin GDPR acquires the owning account's transaction advisory admission, checks
the prerequisite inside that transaction, and holds admission through collection,
SQL and external erasure plus final CMS deletion. The owning DB transaction
factory provides the scoped connection to
`packages/core/src/database/universal-postgres.ts` through the maintained admin
adapter configuration. Queries borrow that lease without releasing it; nested
adapter transactions use serialized savepoints. This preserves completion with
pool capacity one and when concurrent erasures fill the pool.
New domain assignments try the identical key before canonical identity locks
and fail with a cleanup 409 while erasure is admitted. This prevents a new alias
between the prerequisite check and side effects. Sentry requests use a bounded deadline and
reject redirects; Stripe uses its maintained timeout/retry owner. Server GDPR
already atomically anonymizes before session revocation or Stripe deletion.
Actual migrated PGlite query/API regressions cover pending and verified
aliases, raw SQL and shared mutation denial, typed constraint mapping, unchanged
owner identity, and successful ordinary anonymization/purge after the domain
owner removes state following provider success or authoritative absence.
Provider failure/retry and overlapping attachment/detachment have separate API
regressions. Independent-session advisory contention is covered by
`packages/test/src/integration/database/consultation-domain-erasure.integration.test.ts`
in the existing required fresh-PostgreSQL CI job. The local host has no running
native PostgreSQL fixture; PGlite does not prove multi-session contention, so
the CI result remains a validation prerequisite. These source gates do not
constitute live provider/deployment proof.
The existing Stripe/Sentry erasure debt remains separately inventoried above.
