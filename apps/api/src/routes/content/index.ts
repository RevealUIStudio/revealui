/**
 * Content REST API routes
 *
 * Minimal CRUD for the core content tables — making CMS content
 * accessible to headless consumers without going through the admin UI.
 *
 * Posts:     GET|POST /api/content/posts
 *            GET|PATCH|DELETE /api/content/posts/:id
 *            GET /api/content/posts/slug/:slug
 *
 * Media:     GET|POST /api/content/media
 *            GET|PATCH|DELETE /api/content/media/:id
 *
 * Sites:     GET|POST /api/content/sites
 *            GET|PATCH|DELETE /api/content/sites/:id
 *
 * Pages:     GET|POST /api/content/sites/:siteId/pages
 *            GET|PATCH|DELETE /api/content/pages/:id
 *
 * Users:     GET /api/content/users (admin-only, paginated)
 *            GET|PATCH|DELETE /api/content/users/:id
 *
 * Products:  GET|POST /api/content/products
 *            GET|PATCH|DELETE /api/content/products/:id
 *
 * Orders:    GET|POST /api/content/orders
 *            GET|PATCH /api/content/orders/:id
 *
 * Batch:     POST /api/content/batch/create
 *            POST /api/content/batch/update
 *            POST /api/content/batch/delete
 */

import type { DatabaseClient } from '@revealui/db/client';
import { OpenAPIHono } from '@revealui/openapi';
import batchRoutes from './batch.js';
import exportRoutes from './export.js';
import mediaRoutes from './media.js';
import ordersRoutes from './orders.js';
import pagesRoutes from './pages.js';
import postsRoutes from './posts.js';
import productsRoutes from './products.js';
import searchRoutes from './search.js';
import sitesRoutes from './sites.js';
import usersRoutes from './users.js';

export type ContentVariables = {
  db: DatabaseClient;
  user?: { id: string; role: string };
};

const app = new OpenAPIHono<{ Variables: ContentVariables }>();

app.route('/', postsRoutes);
app.route('/', mediaRoutes);
app.route('/', sitesRoutes);
app.route('/', pagesRoutes);
app.route('/', searchRoutes);
app.route('/', usersRoutes);
app.route('/', productsRoutes);
app.route('/', ordersRoutes);
app.route('/', batchRoutes);
app.route('/', exportRoutes);

export default app;
