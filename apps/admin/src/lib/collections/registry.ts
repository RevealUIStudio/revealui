/**
 * Canonical collection registry for the admin app.
 *
 * Single source of truth for which CollectionConfig objects are registered
 * with the admin instance. Consumed by:
 *   - `apps/admin/revealui.config.ts` — passes `allCollections` into
 *     `buildConfig({ collections })`.
 *   - `apps/admin/src/app/api/mcp/collections/route.ts` — enumerates
 *     collections to the MCP resource surface (Stage 4.2).
 *
 * Add new collections here; both the admin runtime and the MCP resource
 * introspection surface pick them up automatically.
 */

import type { CollectionConfig } from '@revealui/contracts/admin';
import { Conversations } from './Conversations';
import { Media } from './Media';
import { Orders } from './Orders';
import { Pages } from './Pages/index';
import { Posts } from './Posts';
import Products from './Products';
import { Tenants } from './Tenants';
import Users from './Users';

/**
 * WIRE-UP-PENDING — collections registered in the admin UI without a backing
 * Postgres table are intentionally NOT included below. A registered collection
 * whose slug has no table renders in the dashboard but every read/write throws
 * (the dynamic SQL adapter issues `SELECT * FROM "<slug>"` against a missing
 * relation, and the typed-storage bridge has no handler for it), so the UI is
 * silently broken. These are unregistered here until a migration lands, then
 * re-registered:
 *
 *   - Contents       (slug `contents`      — no `contents` table)
 *   - Categories     (slug `categories`    — no `categories` table)
 *   - Tags           (slug `tags`          — no `tags` table)
 *   - Events         (slug `events`        — no `events` table)
 *   - Prices         (slug `prices`        — no `prices` table)
 *   - Subscriptions  (slug `subscriptions` — no `subscriptions` table)
 *
 * Their config files stay on disk (imported by submodule consumers and kept as
 * the wire-up starting point). The backing-storage guard test in
 * `__tests__/registry-backing-storage.test.ts` fails CI if any collection is
 * added back here without a matching Drizzle table.
 */
export const allCollections = [
  Users,
  Tenants,
  Pages,
  Media,
  Products,
  Orders,
  Posts,
  Conversations,
  // biome-ignore lint/suspicious/noExplicitAny: heterogeneous collection array requires invariant generic
] as CollectionConfig<any>[];
