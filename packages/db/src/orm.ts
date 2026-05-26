/**
 * @revealui/db/orm — Drizzle ORM query helpers, re-exported.
 *
 * Import Drizzle query operators (`eq`, `and`, `or`, `sql`, `inArray`, `desc`,
 * `count`, ...) from here rather than depending on the bare `drizzle-orm`
 * package directly.
 *
 * Why this subpath exists: under pnpm's isolated linker, `drizzle-orm` is
 * materialized only inside the `node_modules` of packages that declare it as a
 * dependency (such as `@revealui/db`), not at the repo root. A bare
 * `import('drizzle-orm')` from repo-root `scripts/` therefore fails with
 * `ERR_MODULE_NOT_FOUND`. Routing through `@revealui/db/orm` resolves from any
 * workspace location and — because it shares this package's Drizzle install —
 * guarantees the operators come from the same Drizzle instance as the db
 * client (`@revealui/db/client`) and schema (`@revealui/db/schema`).
 *
 * @example
 * ```ts
 * import { getClient } from '@revealui/db/client';
 * import { users } from '@revealui/db/schema';
 * import { eq } from '@revealui/db/orm';
 *
 * const db = getClient('rest');
 * await db.select().from(users).where(eq(users.role, 'owner'));
 * ```
 *
 * @module @revealui/db/orm
 */

export * from 'drizzle-orm';
