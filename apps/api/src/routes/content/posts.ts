/**
 * Post CRUD routes
 *
 * GET|POST /posts
 * GET|PATCH|DELETE /posts/:id
 * GET /posts/slug/:slug
 */

import { validateContent } from '@revealui/contracts/content-validation';
import { POST_STATUSES } from '@revealui/contracts/entities';
import * as postQueries from '@revealui/db/queries/posts';
import { createRoute, OpenAPIHono, z } from '@revealui/openapi';
import { HTTPException } from 'hono/http-exception';
import { asNonEmptyTuple } from '../../lib/type-guards.js';
import {
  ErrorSchema,
  IdParam,
  SlugField,
  SlugParam,
  ValidationErrorSchema,
} from '../_helpers/content-schemas.js';
import { PaginationQuery } from '../_helpers/pagination.js';
import { dateToString, nullableDateToString } from '../_helpers/serialize.js';
import type { ContentVariables } from './index.js';

const app = new OpenAPIHono<{ Variables: ContentVariables }>();

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
    status: z.enum(asNonEmptyTuple(POST_STATUSES)),
    published: z.boolean().nullable(),
    meta: z.unknown().nullable(),
    categories: z.unknown().nullable(),
    createdAt: z.string().openapi({ type: 'string', format: 'date-time' }),
    updatedAt: z.string().openapi({ type: 'string', format: 'date-time' }),
    publishedAt: z.string().nullable().openapi({ type: 'string', format: 'date-time' }),
  })
  .openapi('Post');

type SerializedPost = z.infer<typeof PostSchema>;

function serializePost(
  post: NonNullable<Awaited<ReturnType<typeof postQueries.getPostById>>>,
): SerializedPost {
  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt ?? null,
    content: post.content ?? null,
    featuredImageId: post.featuredImageId ?? null,
    authorId: post.authorId ?? null,
    status: post.status as SerializedPost['status'],
    published: post.published ?? null,
    meta: post.meta ?? null,
    categories: post.categories ?? null,
    createdAt: dateToString(post.createdAt),
    updatedAt: dateToString(post.updatedAt),
    publishedAt: nullableDateToString(post.publishedAt),
  };
}

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
        status: z.enum(asNonEmptyTuple(POST_STATUSES)).optional().openapi({ example: 'published' }),
        authorId: z.string().optional(),
      }),
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              success: z.literal(true),
              data: z.array(PostSchema),
              totalDocs: z.number(),
              totalPages: z.number(),
              limit: z.number(),
              offset: z.number(),
            }),
          },
        },
        description: 'Post list',
      },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user');
    const { status, authorId, limit, offset } = c.req.valid('query');
    if (!user) {
      // Public access: only published posts, no author filtering
      const filterOpts = { status: 'published' as const };
      const [data, totalDocs] = await Promise.all([
        postQueries.getAllPosts(db, { ...filterOpts, limit, offset }),
        postQueries.countPosts(db, filterOpts),
      ]);
      return c.json(
        {
          success: true as const,
          data: data.map(serializePost),
          totalDocs,
          totalPages: Math.ceil(totalDocs / limit),
          limit,
          offset,
        },
        200,
      );
    }
    // Non-admin users can only read their own posts
    const effectiveAuthorId = user.role === 'admin' ? authorId : user.id;
    const filterOpts = { status, authorId: effectiveAuthorId };
    const [data, totalDocs] = await Promise.all([
      postQueries.getAllPosts(db, { ...filterOpts, limit, offset }),
      postQueries.countPosts(db, filterOpts),
    ]);
    return c.json(
      {
        success: true as const,
        data: data.map(serializePost),
        totalDocs,
        totalPages: Math.ceil(totalDocs / limit),
        limit,
        offset,
      },
      200,
    );
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
              status: z.enum(asNonEmptyTuple(POST_STATUSES)).optional(),
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
      400: {
        content: { 'application/json': { schema: ValidationErrorSchema } },
        description: 'Content validation failed',
      },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user');
    if (!user) throw new HTTPException(401, { message: 'Authentication required' });
    const body = c.req.valid('json');
    // Validate content for dangerous URLs, excessive nesting, and payload size
    if (body.content !== undefined) {
      const validation = validateContent(body.content);
      if (!validation.valid) {
        return c.json({ success: false as const, errors: validation.errors }, 400);
      }
    }
    // Force authorId to session user — never trust client-supplied authorId
    const post = await postQueries.createPost(db, {
      id: crypto.randomUUID(),
      ...body,
      authorId: user.id,
    });
    // biome-ignore lint/style/noNonNullAssertion: createPost always returns the created row
    return c.json({ success: true as const, data: serializePost(post!) }, 201);
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
    const { id } = c.req.valid('param');
    const post = await postQueries.getPostById(db, id);
    if (!post) throw new HTTPException(404, { message: 'Post not found' });
    if (!user) {
      // Public access: only published posts
      if (post.status !== 'published') {
        throw new HTTPException(404, { message: 'Post not found' });
      }
      return c.json({ success: true as const, data: serializePost(post) }, 200);
    }
    if (user.role !== 'admin' && post.authorId !== user.id) {
      throw new HTTPException(403, { message: 'Forbidden' });
    }
    return c.json({ success: true as const, data: serializePost(post) }, 200);
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
    const { slug } = c.req.valid('param');
    const post = await postQueries.getPostBySlug(db, slug);
    if (!post) throw new HTTPException(404, { message: 'Post not found' });
    if (!user) {
      // Public access: only published posts
      if (post.status !== 'published') {
        throw new HTTPException(404, { message: 'Post not found' });
      }
      return c.json({ success: true as const, data: serializePost(post) }, 200);
    }
    if (user.role !== 'admin' && post.authorId !== user.id) {
      throw new HTTPException(403, { message: 'Forbidden' });
    }
    return c.json({ success: true as const, data: serializePost(post) }, 200);
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
              status: z.enum(asNonEmptyTuple(POST_STATUSES)).optional(),
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
      400: {
        content: { 'application/json': { schema: ValidationErrorSchema } },
        description: 'Content validation failed',
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
    const body = c.req.valid('json');
    // Validate content for dangerous URLs, excessive nesting, and payload size
    if (body.content !== undefined) {
      const validation = validateContent(body.content);
      if (!validation.valid) {
        return c.json({ success: false as const, errors: validation.errors }, 400);
      }
    }
    const post = await postQueries.updatePost(db, id, {
      ...body,
      publishedAt:
        body.publishedAt === null
          ? null
          : body.publishedAt
            ? new Date(body.publishedAt)
            : undefined,
    });
    if (!post) throw new HTTPException(404, { message: 'Post not found' });
    return c.json({ success: true as const, data: serializePost(post) }, 200);
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

export default app;
