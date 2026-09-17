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
 * Every collection config under this directory is imported here. Each slug
 * must have a matching Drizzle table (see `__tests__/registry-backing-storage.test.ts`).
 */

import type { CollectionConfig } from '@revealui/contracts/admin';
import Categories from './Categories';
import Contents from './Contents';
import { Conversations } from './Conversations';
import Events from './Events';
import Info from './Info';
import { Media } from './Media';
import { Orders } from './Orders';
import { Pages } from './Pages/index';
import { Posts } from './Posts';
import Prices from './Prices';
import Products from './Products';
import Subscriptions from './Subscriptions';
import Tags from './Tags';
import { Tenants } from './Tenants';
import Users from './Users';
import Videos from './Videos';

export const allCollections = [
  Users,
  Tenants,
  Pages,
  Media,
  Products,
  Orders,
  Posts,
  Conversations,
  Categories,
  Tags,
  Contents,
  Events,
  Info,
  Videos,
  Prices,
  Subscriptions,
  // biome-ignore lint/suspicious/noExplicitAny: heterogeneous collection array requires invariant generic
] as CollectionConfig<any>[];
