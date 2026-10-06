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

2. **Conversation/order collection writes.** The typed storage registry has
   `find` and `findByID` handlers for these collections, but no `create`,
   `update`, or `delete` handlers. Those operations still fall through the core
   dynamic SQL adapter, which does not map all camelCase collection fields to
   the normalized Drizzle columns. Extend the existing typed storage seam and
   DB query owners to support validated canonical writes, preserving the order
   hooks and soft-delete semantics. Validate CRUD through the collection API
   against the migrated schema, including ownership denial, item/total
   validation, status constraints, and hook behavior.

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
