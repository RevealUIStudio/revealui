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
import Banners from './Banners';
import Cards from './Cards';
import Categories from './Categories';
import Contents from './Contents';
import { Conversations } from './Conversations';
import Events from './Events';
import Heros from './Heros';
import Layouts from './Layouts';
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

export const allCollections = [
  Users,
  Tenants,
  Pages,
  Media,
  Layouts,
  Contents,
  Categories,
  Tags,
  Events,
  Cards,
  Heros,
  Products,
  Prices,
  Orders,
  Posts,
  Subscriptions,
  Banners,
  Conversations,
  // biome-ignore lint/suspicious/noExplicitAny: heterogeneous collection array requires invariant generic
] as CollectionConfig<any>[];
