# GDPR export audit follow-up

**Status:** partial repair landed locally on `fix/audit-gdpr-reads-w23`.

The export now filters conversations by `userId`, orders by `customerId`, and
subscriptions by `userId`. It validates pagination metadata and returned
documents, reads every page within a bounded size, and fails the whole request
when a required collection cannot be read. Conversation and order collection
reads use the migrated DB fields, preserve core access predicates, and exclude
soft-deleted orders. Order creation access is restricted to the authenticated
customer or an administrator.

## Durable work still open

1. **Point-in-time export snapshot.** `apps/admin/src/app/api/gdpr/export/route.ts`
   currently performs multiple page/count operations through
   `apps/admin/src/lib/db/typedCollectionStorage.ts`. Those handlers acquire the
   global DB client independently. A concurrent write can change records while
   pages are being read, including without changing `totalDocs`. The owning
   target is the existing transaction/query-executor contract in
   `packages/db/src/client` and `packages/core/src/database`, extended so raw
   and typed collection reads share a read-only repeatable-read scope. The
   export must fail before response output when the production client cannot
   provide that scope. Validate with a concurrent PostgreSQL writer across
   pages, counts, and collections; PGlite-only tests do not prove this property.

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
