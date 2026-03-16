/**
 * Content REST API routes
 *
 * Minimal CRUD for the four core content tables — making CMS content
 * accessible to headless consumers without going through the admin UI.
 *
 * Posts:  GET|POST /api/content/posts
 *         GET|PATCH|DELETE /api/content/posts/:id
 *         GET /api/content/posts/slug/:slug
 *
 * Media:  GET /api/content/media
 *         GET|PATCH|DELETE /api/content/media/:id
 *
 * Sites:  GET|POST /api/content/sites
 *         GET|PATCH|DELETE /api/content/sites/:id
 *
 * Pages:  GET|POST /api/content/sites/:siteId/pages
 *         GET|PATCH|DELETE /api/content/pages/:id
 */

import { OpenAPIHono } from '@hono/zod-openapi';
import type { DatabaseClient } from '@revealui/db/client';
import mediaRoutes from './media.js';
import pagesRoutes from './pages.js';
import postsRoutes from './posts.js';
import sitesRoutes from './sites.js';

export type ContentVariables = {
  db: DatabaseClient;
  user?: { id: string; role: string };
};

// biome-ignore lint/style/useNamingConvention: Hono requires Variables key
const app = new OpenAPIHono<{ Variables: ContentVariables }>();

app.route('/', postsRoutes);
app.route('/', mediaRoutes);
app.route('/', sitesRoutes);
app.route('/', pagesRoutes);

export default app;
