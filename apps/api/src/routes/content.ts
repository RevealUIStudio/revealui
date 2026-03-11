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

import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { PAGE_STATUSES, POST_STATUSES, SITE_STATUSES } from '@revealui/contracts/entities';
import type { DatabaseClient } from '@revealui/db/client';
import * as mediaQueries from '@revealui/db/queries/media';
import * as pageQueries from '@revealui/db/queries/pages';
import * as postQueries from '@revealui/db/queries/posts';
import * as siteQueries from '@revealui/db/queries/sites';
import { HTTPException } from 'hono/http-exception';

type Variables = {
  db: DatabaseClient;
  user?: { id: string; role: string };
};

// biome-ignore lint/style/useNamingConvention: Hono requires Variables key
const app = new OpenAPIHono<{ Variables: Variables }>();

// =============================================================================
// Shared Schemas
// =============================================================================

const IdParam = z.object({
  id: z.string().openapi({ param: { name: 'id', in: 'path' }, example: 'abc123' }),
});

const SiteIdParam = z.object({
  siteId: z.string().openapi({ param: { name: 'siteId', in: 'path' }, example: 'site-abc' }),
});

const SlugParam = z.object({
  slug: z.string().openapi({ param: { name: 'slug', in: 'path' }, example: 'my-post' }),
});

const PaginationQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SlugField = z
  .string()
  .min(1)
  .max(200)
  .regex(SLUG_PATTERN, 'Slug must be lowercase alphanumeric with hyphens only');

const ErrorSchema = z.object({ success: z.literal(false), error: z.string() });

// =============================================================================
// Post Schemas
// =============================================================================

const PostSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    slug: z.string(),
    excerpt: z.string().nullable(),
    content: z.unknown().nullable(),
    featuredImageId: z.string().nullable(),
    authorId: z.string().nullable(),
    status: z.enum(POST_STATUSES as unknown as [string, ...string[]]),
    published: z.boolean().nullable(),
    meta: z.unknown().nullable(),
    categories: z.unknown().nullable(),
    createdAt: z.string().openapi({ type: 'string', format: 'date-time' }),
    updatedAt: z.string().openapi({ type: 'string', format: 'date-time' }),
    publishedAt: z.string().nullable().openapi({ type: 'string', format: 'date-time' }),
  })
  .openapi('Post');

// =============================================================================
// Media Schemas
// =============================================================================

const MediaSchema = z
  .object({
    id: z.string(),
    filename: z.string(),
    mimeType: z.string(),
    filesize: z.number().nullable(),
    url: z.string(),
    alt: z.string().nullable(),
    width: z.number().nullable(),
    height: z.number().nullable(),
    focalPoint: z.unknown().nullable(),
    sizes: z.unknown().nullable(),
    uploadedBy: z.string().nullable(),
    createdAt: z.string().openapi({ type: 'string', format: 'date-time' }),
    updatedAt: z.string().openapi({ type: 'string', format: 'date-time' }),
  })
  .openapi('Media');

// =============================================================================
// Site Schemas
// =============================================================================

const SiteSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    description: z.string().nullable(),
    ownerId: z.string(),
    status: z.enum(SITE_STATUSES as unknown as [string, ...string[]]),
    theme: z.unknown().nullable(),
    settings: z.unknown().nullable(),
    pageCount: z.number().nullable(),
    favicon: z.string().nullable(),
    createdAt: z.string().openapi({ type: 'string', format: 'date-time' }),
    updatedAt: z.string().openapi({ type: 'string', format: 'date-time' }),
    publishedAt: z.string().nullable().openapi({ type: 'string', format: 'date-time' }),
  })
  .openapi('Site');

// =============================================================================
// Page Schemas
// =============================================================================

const PageSchema = z
  .object({
    id: z.string(),
    siteId: z.string(),
    parentId: z.string().nullable(),
    templateId: z.string().nullable(),
    title: z.string(),
    slug: z.string(),
    path: z.string(),
    status: z.enum(PAGE_STATUSES as unknown as [string, ...string[]]),
    blocks: z.unknown().nullable(),
    seo: z.unknown().nullable(),
    blockCount: z.number().nullable(),
    wordCount: z.number().nullable(),
    createdAt: z.string().openapi({ type: 'string', format: 'date-time' }),
    updatedAt: z.string().openapi({ type: 'string', format: 'date-time' }),
    publishedAt: z.string().nullable().openapi({ type: 'string', format: 'date-time' }),
  })
  .openapi('Page');

// =============================================================================
// Post Routes
// =============================================================================

// GET /posts
app.openapi(
  createRoute({
    method: 'get',
    path: '/posts',
    tags: ['content'],
    summary: 'List posts',
    request: {
      query: PaginationQuery.extend({
        status: z
          .enum(POST_STATUSES as unknown as [string, ...string[]])
          .optional()
          .openapi({ example: 'published' }),
        authorId: z.string().optional(),
      }),
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), data: z.array(PostSchema) }),
          },
        },
        description: 'Post list',
      },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user');
    if (!user) throw new HTTPException(401, { message: 'Authentication required' });
    const { status, authorId, limit, offset } = c.req.valid('query');
    // Non-admin users can only read their own posts
    const effectiveAuthorId = user.role === 'admin' ? authorId : user.id;
    const data = await postQueries.getAllPosts(db, {
      status,
      authorId: effectiveAuthorId,
      limit,
      offset,
    });
    return c.json({ success: true as const, data }, 200);
  },
);

// POST /posts
app.openapi(
  createRoute({
    method: 'post',
    path: '/posts',
    tags: ['content'],
    summary: 'Create a post',
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.object({
              title: z.string().min(1).max(500),
              slug: SlugField,
              excerpt: z.string().max(1000).optional(),
              content: z.unknown().optional(),
              featuredImageId: z.string().optional(),
              authorId: z.string().optional(),
              status: z.enum(POST_STATUSES as unknown as [string, ...string[]]).optional(),
              meta: z.record(z.string(), z.unknown()).optional(),
              categories: z.array(z.string()).optional(),
            }),
          },
        },
      },
    },
    responses: {
      201: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), data: PostSchema }),
          },
        },
        description: 'Post created',
      },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user');
    if (!user) throw new HTTPException(401, { message: 'Authentication required' });
    const body = c.req.valid('json');
    const post = await postQueries.createPost(db, {
      id: crypto.randomUUID(),
      authorId: user.id,
      ...body,
    });
    // biome-ignore lint/style/noNonNullAssertion: createPost always returns the created row
    return c.json({ success: true as const, data: post! }, 201);
  },
);

// GET /posts/:id
app.openapi(
  createRoute({
    method: 'get',
    path: '/posts/{id}',
    tags: ['content'],
    summary: 'Get a post by ID',
    request: { params: IdParam },
    responses: {
      200: {
        content: {
          'application/json': { schema: z.object({ success: z.literal(true), data: PostSchema }) },
        },
        description: 'Post found',
      },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Not found' },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user');
    if (!user) throw new HTTPException(401, { message: 'Authentication required' });
    const { id } = c.req.valid('param');
    const post = await postQueries.getPostById(db, id);
    if (!post) return c.json({ success: false as const, error: 'Post not found' }, 404);
    if (user.role !== 'admin' && post.authorId !== user.id) {
      throw new HTTPException(403, { message: 'Forbidden' });
    }
    return c.json({ success: true as const, data: post }, 200);
  },
);

// GET /posts/slug/:slug
app.openapi(
  createRoute({
    method: 'get',
    path: '/posts/slug/{slug}',
    tags: ['content'],
    summary: 'Get a post by slug',
    request: { params: SlugParam },
    responses: {
      200: {
        content: {
          'application/json': { schema: z.object({ success: z.literal(true), data: PostSchema }) },
        },
        description: 'Post found',
      },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Not found' },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user');
    if (!user) throw new HTTPException(401, { message: 'Authentication required' });
    const { slug } = c.req.valid('param');
    const post = await postQueries.getPostBySlug(db, slug);
    if (!post) return c.json({ success: false as const, error: 'Post not found' }, 404);
    if (user.role !== 'admin' && post.authorId !== user.id) {
      throw new HTTPException(403, { message: 'Forbidden' });
    }
    return c.json({ success: true as const, data: post }, 200);
  },
);

// PATCH /posts/:id
app.openapi(
  createRoute({
    method: 'patch',
    path: '/posts/{id}',
    tags: ['content'],
    summary: 'Update a post',
    request: {
      params: IdParam,
      body: {
        content: {
          'application/json': {
            schema: z.object({
              title: z.string().min(1).max(500).optional(),
              slug: SlugField.optional(),
              excerpt: z.string().max(1000).nullable().optional(),
              content: z.unknown().optional(),
              featuredImageId: z.string().nullable().optional(),
              status: z.enum(POST_STATUSES as unknown as [string, ...string[]]).optional(),
              published: z.boolean().optional(),
              meta: z.record(z.string(), z.unknown()).nullable().optional(),
              categories: z.array(z.string()).optional(),
              publishedAt: z.string().datetime().nullable().optional(),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          'application/json': { schema: z.object({ success: z.literal(true), data: PostSchema }) },
        },
        description: 'Post updated',
      },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Not found' },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user');
    if (!user) throw new HTTPException(401, { message: 'Authentication required' });
    const { id } = c.req.valid('param');
    const existing = await postQueries.getPostById(db, id);
    if (!existing) return c.json({ success: false as const, error: 'Post not found' }, 404);
    if (user.role !== 'admin' && existing.authorId !== user.id) {
      throw new HTTPException(403, { message: 'Forbidden' });
    }
    const body = c.req.valid('json');
    const post = await postQueries.updatePost(db, id, {
      ...body,
      publishedAt:
        body.publishedAt === null
          ? null
          : body.publishedAt
            ? new Date(body.publishedAt)
            : undefined,
    });
    if (!post) return c.json({ success: false as const, error: 'Post not found' }, 404);
    return c.json({ success: true as const, data: post }, 200);
  },
);

// DELETE /posts/:id
app.openapi(
  createRoute({
    method: 'delete',
    path: '/posts/{id}',
    tags: ['content'],
    summary: 'Delete a post',
    request: { params: IdParam },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), message: z.string() }),
          },
        },
        description: 'Post deleted',
      },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Not found' },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user');
    if (!user) throw new HTTPException(401, { message: 'Authentication required' });
    const { id } = c.req.valid('param');
    const existing = await postQueries.getPostById(db, id);
    if (!existing) throw new HTTPException(404, { message: 'Post not found' });
    if (user.role !== 'admin' && existing.authorId !== user.id) {
      throw new HTTPException(403, { message: 'Forbidden' });
    }
    await postQueries.deletePost(db, id);
    return c.json({ success: true as const, message: 'Post deleted' }, 200);
  },
);

// =============================================================================
// Media Routes
// =============================================================================

// GET /media
app.openapi(
  createRoute({
    method: 'get',
    path: '/media',
    tags: ['content'],
    summary: 'List media',
    request: {
      query: PaginationQuery.extend({
        mimeType: z.string().optional().openapi({ example: 'image' }),
      }),
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), data: z.array(MediaSchema) }),
          },
        },
        description: 'Media list',
      },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user');
    if (!user) throw new HTTPException(401, { message: 'Authentication required' });
    const { mimeType, limit, offset } = c.req.valid('query');
    const data = await mediaQueries.getAllMedia(db, { mimeType, limit, offset });
    return c.json({ success: true as const, data }, 200);
  },
);

// GET /media/:id
app.openapi(
  createRoute({
    method: 'get',
    path: '/media/{id}',
    tags: ['content'],
    summary: 'Get a media item by ID',
    request: { params: IdParam },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), data: MediaSchema }),
          },
        },
        description: 'Media found',
      },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Not found' },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user');
    if (!user) throw new HTTPException(401, { message: 'Authentication required' });
    const { id } = c.req.valid('param');
    const item = await mediaQueries.getMediaById(db, id);
    if (!item) return c.json({ success: false as const, error: 'Media not found' }, 404);
    if (user.role !== 'admin' && item.uploadedBy !== user.id) {
      throw new HTTPException(403, { message: 'Forbidden' });
    }
    return c.json({ success: true as const, data: item }, 200);
  },
);

// PATCH /media/:id
app.openapi(
  createRoute({
    method: 'patch',
    path: '/media/{id}',
    tags: ['content'],
    summary: 'Update media metadata',
    request: {
      params: IdParam,
      body: {
        content: {
          'application/json': {
            schema: z.object({
              alt: z.string().max(500).nullable().optional(),
              focalPoint: z.object({ x: z.number(), y: z.number() }).nullable().optional(),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), data: MediaSchema }),
          },
        },
        description: 'Media updated',
      },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Not found' },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user');
    if (!user) throw new HTTPException(401, { message: 'Authentication required' });
    const { id } = c.req.valid('param');
    const existing = await mediaQueries.getMediaById(db, id);
    if (!existing) return c.json({ success: false as const, error: 'Media not found' }, 404);
    if (user.role !== 'admin' && existing.uploadedBy !== user.id) {
      throw new HTTPException(403, { message: 'Forbidden' });
    }
    const body = c.req.valid('json');
    const item = await mediaQueries.updateMedia(db, id, body);
    if (!item) return c.json({ success: false as const, error: 'Media not found' }, 404);
    return c.json({ success: true as const, data: item }, 200);
  },
);

// DELETE /media/:id
app.openapi(
  createRoute({
    method: 'delete',
    path: '/media/{id}',
    tags: ['content'],
    summary: 'Delete a media item',
    request: { params: IdParam },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), message: z.string() }),
          },
        },
        description: 'Media deleted',
      },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Not found' },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user');
    if (!user) throw new HTTPException(401, { message: 'Authentication required' });
    const { id } = c.req.valid('param');
    const existing = await mediaQueries.getMediaById(db, id);
    if (!existing) throw new HTTPException(404, { message: 'Media not found' });
    if (user.role !== 'admin' && existing.uploadedBy !== user.id) {
      throw new HTTPException(403, { message: 'Forbidden' });
    }
    await mediaQueries.deleteMedia(db, id);
    return c.json({ success: true as const, message: 'Media deleted' }, 200);
  },
);

// =============================================================================
// Site Routes
// =============================================================================

// GET /sites
app.openapi(
  createRoute({
    method: 'get',
    path: '/sites',
    tags: ['content'],
    summary: 'List sites',
    request: {
      query: PaginationQuery.extend({
        status: z
          .enum(SITE_STATUSES as unknown as [string, ...string[]])
          .optional()
          .openapi({ example: 'published' }),
      }),
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), data: z.array(SiteSchema) }),
          },
        },
        description: 'Site list',
      },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user');
    if (!user) throw new HTTPException(401, { message: 'Authentication required' });
    const { status, limit, offset } = c.req.valid('query');
    const data = await siteQueries.getAllSites(db, { ownerId: user.id, status, limit, offset });
    return c.json({ success: true as const, data }, 200);
  },
);

// POST /sites
app.openapi(
  createRoute({
    method: 'post',
    path: '/sites',
    tags: ['content'],
    summary: 'Create a site',
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.object({
              name: z.string().min(1).max(200),
              slug: SlugField,
              description: z.string().max(1000).optional(),
              status: z.enum(SITE_STATUSES as unknown as [string, ...string[]]).optional(),
            }),
          },
        },
      },
    },
    responses: {
      201: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), data: SiteSchema }),
          },
        },
        description: 'Site created',
      },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user');
    if (!user) throw new HTTPException(401, { message: 'Authentication required' });
    const body = c.req.valid('json');
    const site = await siteQueries.createSite(db, {
      id: crypto.randomUUID(),
      ownerId: user.id,
      ...body,
    });
    // biome-ignore lint/style/noNonNullAssertion: createSite always returns the created row
    return c.json({ success: true as const, data: site! }, 201);
  },
);

// GET /sites/:id
app.openapi(
  createRoute({
    method: 'get',
    path: '/sites/{id}',
    tags: ['content'],
    summary: 'Get a site by ID',
    request: { params: IdParam },
    responses: {
      200: {
        content: {
          'application/json': { schema: z.object({ success: z.literal(true), data: SiteSchema }) },
        },
        description: 'Site found',
      },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Not found' },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user');
    if (!user) throw new HTTPException(401, { message: 'Authentication required' });
    const { id } = c.req.valid('param');
    const site = await siteQueries.getSiteById(db, id);
    if (!site) return c.json({ success: false as const, error: 'Site not found' }, 404);
    if (user.role !== 'admin' && site.ownerId !== user.id) {
      throw new HTTPException(403, { message: 'Forbidden' });
    }
    return c.json({ success: true as const, data: site }, 200);
  },
);

// PATCH /sites/:id
app.openapi(
  createRoute({
    method: 'patch',
    path: '/sites/{id}',
    tags: ['content'],
    summary: 'Update a site',
    request: {
      params: IdParam,
      body: {
        content: {
          'application/json': {
            schema: z.object({
              name: z.string().min(1).max(200).optional(),
              slug: SlugField.optional(),
              description: z.string().max(1000).nullable().optional(),
              status: z.enum(SITE_STATUSES as unknown as [string, ...string[]]).optional(),
              favicon: z.string().nullable().optional(),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          'application/json': { schema: z.object({ success: z.literal(true), data: SiteSchema }) },
        },
        description: 'Site updated',
      },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Not found' },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user');
    if (!user) throw new HTTPException(401, { message: 'Authentication required' });
    const { id } = c.req.valid('param');
    const body = c.req.valid('json');
    const existing = await siteQueries.getSiteById(db, id);
    if (!existing) return c.json({ success: false as const, error: 'Site not found' }, 404);
    if (user.role !== 'admin' && existing.ownerId !== user.id) {
      throw new HTTPException(403, { message: 'Forbidden' });
    }
    const site = await siteQueries.updateSite(db, id, body);
    if (!site) return c.json({ success: false as const, error: 'Site not found' }, 404);
    return c.json({ success: true as const, data: site }, 200);
  },
);

// DELETE /sites/:id
app.openapi(
  createRoute({
    method: 'delete',
    path: '/sites/{id}',
    tags: ['content'],
    summary: 'Delete a site',
    request: { params: IdParam },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), message: z.string() }),
          },
        },
        description: 'Site deleted',
      },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Not found' },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user');
    if (!user) throw new HTTPException(401, { message: 'Authentication required' });
    const { id } = c.req.valid('param');
    const existing = await siteQueries.getSiteById(db, id);
    if (!existing) throw new HTTPException(404, { message: 'Site not found' });
    if (user.role !== 'admin' && existing.ownerId !== user.id) {
      throw new HTTPException(403, { message: 'Forbidden' });
    }
    await siteQueries.deleteSite(db, id);
    return c.json({ success: true as const, message: 'Site deleted' }, 200);
  },
);

// =============================================================================
// Page Routes
// =============================================================================

// GET /sites/:siteId/pages
app.openapi(
  createRoute({
    method: 'get',
    path: '/sites/{siteId}/pages',
    tags: ['content'],
    summary: 'List pages for a site',
    request: {
      params: SiteIdParam,
      query: z.object({
        status: z
          .enum(PAGE_STATUSES as unknown as [string, ...string[]])
          .optional()
          .openapi({ example: 'published' }),
      }),
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), data: z.array(PageSchema) }),
          },
        },
        description: 'Page list',
      },
      404: {
        content: { 'application/json': { schema: ErrorSchema } },
        description: 'Site not found',
      },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user');
    if (!user) throw new HTTPException(401, { message: 'Authentication required' });
    const { siteId } = c.req.valid('param');
    const { status } = c.req.valid('query');
    const site = await siteQueries.getSiteById(db, siteId);
    if (!site) return c.json({ success: false as const, error: 'Site not found' }, 404);
    if (user.role !== 'admin' && site.ownerId !== user.id) {
      throw new HTTPException(403, { message: 'Forbidden' });
    }
    const data = await pageQueries.getPagesBySite(db, siteId, { status });
    return c.json({ success: true as const, data }, 200);
  },
);

// POST /sites/:siteId/pages
app.openapi(
  createRoute({
    method: 'post',
    path: '/sites/{siteId}/pages',
    tags: ['content'],
    summary: 'Create a page',
    request: {
      params: SiteIdParam,
      body: {
        content: {
          'application/json': {
            schema: z.object({
              title: z.string().min(1).max(500),
              slug: SlugField,
              path: z.string().min(1).max(500),
              status: z.enum(PAGE_STATUSES as unknown as [string, ...string[]]).optional(),
              parentId: z.string().optional(),
              templateId: z.string().optional(),
              blocks: z.array(z.unknown()).optional(),
              seo: z.record(z.string(), z.unknown()).optional(),
            }),
          },
        },
      },
    },
    responses: {
      201: {
        content: {
          'application/json': { schema: z.object({ success: z.literal(true), data: PageSchema }) },
        },
        description: 'Page created',
      },
      404: {
        content: { 'application/json': { schema: ErrorSchema } },
        description: 'Site not found',
      },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user');
    if (!user) throw new HTTPException(401, { message: 'Authentication required' });
    const { siteId } = c.req.valid('param');
    const body = c.req.valid('json');
    const existingSite = await siteQueries.getSiteById(db, siteId);
    if (!existingSite) return c.json({ success: false as const, error: 'Site not found' }, 404);
    if (user.role !== 'admin' && existingSite.ownerId !== user.id) {
      throw new HTTPException(403, { message: 'Forbidden' });
    }
    const page = await pageQueries.createPage(db, {
      id: crypto.randomUUID(),
      siteId,
      ...body,
    });
    // biome-ignore lint/style/noNonNullAssertion: createPage always returns the created row
    return c.json({ success: true as const, data: page! }, 201);
  },
);

// GET /pages/:id
app.openapi(
  createRoute({
    method: 'get',
    path: '/pages/{id}',
    tags: ['content'],
    summary: 'Get a page by ID',
    request: { params: IdParam },
    responses: {
      200: {
        content: {
          'application/json': { schema: z.object({ success: z.literal(true), data: PageSchema }) },
        },
        description: 'Page found',
      },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Not found' },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user');
    if (!user) throw new HTTPException(401, { message: 'Authentication required' });
    const { id } = c.req.valid('param');
    const page = await pageQueries.getPageById(db, id);
    if (!page) return c.json({ success: false as const, error: 'Page not found' }, 404);
    if (user.role !== 'admin') {
      const site = await siteQueries.getSiteById(db, page.siteId);
      if (!site || site.ownerId !== user.id) {
        throw new HTTPException(403, { message: 'Forbidden' });
      }
    }
    return c.json({ success: true as const, data: page }, 200);
  },
);

// PATCH /pages/:id
app.openapi(
  createRoute({
    method: 'patch',
    path: '/pages/{id}',
    tags: ['content'],
    summary: 'Update a page',
    request: {
      params: IdParam,
      body: {
        content: {
          'application/json': {
            schema: z.object({
              title: z.string().min(1).max(500).optional(),
              slug: SlugField.optional(),
              path: z.string().min(1).max(500).optional(),
              status: z.enum(PAGE_STATUSES as unknown as [string, ...string[]]).optional(),
              parentId: z.string().nullable().optional(),
              templateId: z.string().nullable().optional(),
              blocks: z.array(z.unknown()).optional(),
              seo: z.record(z.string(), z.unknown()).nullable().optional(),
              publishedAt: z.string().datetime().nullable().optional(),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          'application/json': { schema: z.object({ success: z.literal(true), data: PageSchema }) },
        },
        description: 'Page updated',
      },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Not found' },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user');
    if (!user) throw new HTTPException(401, { message: 'Authentication required' });
    const { id } = c.req.valid('param');
    const existing = await pageQueries.getPageById(db, id);
    if (!existing) return c.json({ success: false as const, error: 'Page not found' }, 404);
    if (user.role !== 'admin') {
      const site = await siteQueries.getSiteById(db, existing.siteId);
      if (!site || site.ownerId !== user.id) {
        throw new HTTPException(403, { message: 'Forbidden' });
      }
    }
    const body = c.req.valid('json');
    const page = await pageQueries.updatePage(db, id, {
      ...body,
      publishedAt:
        body.publishedAt === null
          ? null
          : body.publishedAt
            ? new Date(body.publishedAt)
            : undefined,
    });
    if (!page) return c.json({ success: false as const, error: 'Page not found' }, 404);
    return c.json({ success: true as const, data: page }, 200);
  },
);

// DELETE /pages/:id
app.openapi(
  createRoute({
    method: 'delete',
    path: '/pages/{id}',
    tags: ['content'],
    summary: 'Delete a page',
    request: { params: IdParam },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), message: z.string() }),
          },
        },
        description: 'Page deleted',
      },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Not found' },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user');
    if (!user) throw new HTTPException(401, { message: 'Authentication required' });
    const { id } = c.req.valid('param');
    const existing = await pageQueries.getPageById(db, id);
    if (!existing) throw new HTTPException(404, { message: 'Page not found' });
    if (user.role !== 'admin') {
      const site = await siteQueries.getSiteById(db, existing.siteId);
      if (!site || site.ownerId !== user.id) {
        throw new HTTPException(403, { message: 'Forbidden' });
      }
    }
    await pageQueries.deletePage(db, id);
    return c.json({ success: true as const, message: 'Page deleted' }, 200);
  },
);

export default app;
