# GDPR export audit follow-up

**Status:** GDPR reads repair and snapshot scope implemented locally on `fix/audit-gdpr-reads-w23`; live PostgreSQL proof is configured in CI.

The export filters conversations by `userId`, orders by `customerId`, and
subscriptions by `userId`. It validates pagination metadata and returned
documents, reads every page within a bounded size, and fails the whole request
when a required collection cannot be read. Its collection pages and counts now
run inside one PostgreSQL read-only repeatable-read transaction. Conversation
and order collection reads use the migrated DB fields, preserve core access predicates, and exclude
soft-deleted orders. Order creation access is restricted to the authenticated
customer or an administrator.

## Durable work still open

1. **Point-in-time export snapshot — implementation complete; live database
   proof runs in CI.** `packages/db/src/client/index.ts` now uses the Node
   PostgreSQL wire client for Neon and self-hosted PostgreSQL through the same
   registered pool. `withReadOnlyRepeatableRead` pins a checked-out connection
   and starts `REPEATABLE READ READ ONLY`; the admin collection read scope binds
   the existing conversation, order, and subscription typed handlers to that
   Drizzle executor while the route reads every page and count. The CMS adapter
   receives that same pool through `getRestPool`, so it does not create a
   separate production pool.

   The implementation does not add a route-specific client or change export
   filters/access predicates. When no supported pool can be initialized, the
   route fails before collection reads and audit output. The PostgreSQL
   integration test `packages/db/src/__tests__/client/repeatable-read.integration.test.ts`
   uses a separate writer to update, insert, and delete between pages; it checks
   stable rows, totals, backend PID, and read-only enforcement. The CI integration
   job now runs this test with its PostgreSQL service. The local environment had
   no database URL, so this decisive test was skipped here; the CI run remains
   the required live-server proof. Unit coverage verifies transaction settings,
   rollback/release paths, executor scope propagation, and fail-closed routing.
   The driver change also removes the non-atomic auth-storage and signup-limit
   fallbacks; production job claims now require the shared pool and use
   `SKIP LOCKED`. The injected one-statement claim remains only for PGlite tests.

2. **Conversation/order collection writes — audit complete; durable repair
   remains open.** Do not add independent Hono and typed-storage mutation
   implementations. First establish the maintained mutation contract and have
   each supported ingress use it.

   For persisted conversations, the local RevealUI path now has strict,
   validated Drizzle create/update/delete handlers in
   `apps/admin/src/lib/db/typedCollectionStorage.ts`; the core SQL fallback is
   not reached. `packages/db/src/queries/conversations.ts` owns the shared
   mutations, database defaults own timestamps, and updates advance/check the
   version. The existing chat and sync Next routes now validate request bodies
   and call these query owners instead of constructing their own mutations.
   PGlite coverage verifies canonical writes, owner denial, invalid status and
   fields, stale-version conflict, cascaded message deletion, and zero dynamic
   fallback calls. The admin config no longer requires callers to provide
   server-owned ID/version/timestamps.

   One browser path remains open: the generic collection proxy targets
   `/api/content/conversations`, but
   `apps/server/src/routes/content/index.ts` mounts no conversation route. Add
   this capability to the maintained Hono content API using the shared query
   schemas and owner/admin rules, or change the proxy to an already-supported
   collection endpoint with equivalent admin scope. Prove browser create/read/
   update/delete and owner denial end to end; local typed-storage coverage is
   not browser coverage.

   For orders, both browser and local paths are inconsistent. The admin proxy
   forwards collection forms to `apps/server/src/routes/content/orders.ts`.
   Its POST derives customer and total from the authenticated caller and line
   items, while `apps/admin/src/lib/collections/Orders/index.ts` exposes those
   values as writable fields. PATCH supports only status and metadata although
   the collection advertises more editable fields. DELETE is mounted by the
   proxy but absent from Hono; the DB schema explicitly marks financial orders
   for soft deletion. Separately, local RevealUI order writes fall through
   dynamic SQL: updates expect `_json`, which is absent from the canonical
   table, and deletes physically remove rows. Extend
   `packages/db/src/queries/orders.ts` with the shared validated mutation and
   active-row contract, then align Hono and the local typed storage seam with
   it. Decide and enforce order hooks in that owning mutation path; current
   collection hooks are skipped by Hono and their user updates lack request
   context. Do not claim hook preservation until integration tests demonstrate
   it.

   Existing parallel paths and their durable destinations:

   - `apps/admin/src/app/api/collections/[collection]` proxies browser writes
     to Hono, while local RevealUI writes use the typed-storage seam and then
     core dynamic SQL. Converge both on validated DB mutation owners; evidence
     of removal is that collection tests see canonical Drizzle writes and no
     fallback `query` calls.
   - Hono `getAllOrders`, `countOrders`, and `getOrderById` include deleted
     orders, while `listOrders` filters them. Apply one active-order predicate
     in `packages/db/src/queries/orders.ts`; prove list, count, detail, update,
     and delete behavior against migrated tables.
   - `packages/cli/templates/e-commerce/src/collections/Orders.ts` still emits
     legacy `customer`, `total`, and item fields. Align the template to the
     canonical order contract and test generated output before removing those
     fields.
   - Order side effects are split between collection hooks and Hono. Move
     purchase/cart behavior to the shared mutation owner with authenticated
     context and failure semantics; then remove duplicate hooks after tests
     prove the same behavior through every supported ingress.

   Required validation: migrated-schema tests for create/update/delete; valid
   owner/admin and rejected foreign-owner/anonymous cases; strict item shape,
   positive integer quantities, nonnegative integer money, currency and status
   constraints; immutable identity fields; missing/deleted rows; active-row
   list/count/detail consistency; optimistic version behavior for conversations;
   order soft-delete retention; timestamp/default ownership; and side effects
   through browser Hono and local RevealUI APIs. Test that malformed inputs fail
   before persistence and that unsupported operations fail closed. PGlite
   fixtures must include the migrated defaults, checks, FKs, and nullability.

3. **Generated admin types.** `apps/admin/src/types/revealui.ts` still declares
   the legacy numeric `Order.id`, `orderedBy`, `total`, and legacy line items.
   The configured `pnpm --filter admin generate:types` command currently exits
   because its `revealui` executable reports that it is retired, and no
   supported admin type generator is exposed by the current CLI. The durable
   target is the owning admin/config type-generation primitive; regenerate this
   artifact from the canonical collection configs and test that the command
   emits the normalized order shape without hand-editing generated output.

The prior shared `ConversationSchema` remains a separate agent-thread
aggregate; this follow-up concerns the persisted `conversations` rows and the
admin collections only.
