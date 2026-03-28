/**
 * Product CRUD routes
 *
 * GET /products         — List products (public: published only; admin: all)
 * POST /products        — Create a product (admin-only)
 * GET /products/:id     — Get product by ID (public: published only)
 * PATCH /products/:id   — Update a product (admin-only)
 * DELETE /products/:id  — Delete a product (admin-only)
 */

import * as productQueries from '@revealui/db/queries/products';
import { PRODUCT_STATUSES } from '@revealui/db/schema/products';
import { createRoute, OpenAPIHono, z } from '@revealui/openapi';
import { HTTPException } from 'hono/http-exception';
import { asNonEmptyTuple } from '../../lib/type-guards.js';
import { ErrorSchema, IdParam, SlugField } from '../_helpers/content-schemas.js';
import { PaginationQuery } from '../_helpers/pagination.js';
import { dateToString, nullableDateToString } from '../_helpers/serialize.js';
import type { ContentVariables } from './index.js';

const app = new OpenAPIHono<{ Variables: ContentVariables }>();

// =============================================================================
// Product Schemas
// =============================================================================

const ProductSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    slug: z.string(),
    description: z.string().nullable(),
    priceInCents: z.number().nullable(),
    currency: z.string(),
    stripeProductId: z.string().nullable(),
    stripePriceId: z.string().nullable(),
    active: z.boolean(),
    status: z.enum(asNonEmptyTuple(PRODUCT_STATUSES)),
    images: z.unknown().nullable(),
    metadata: z.unknown().nullable(),
    ownerId: z.string().nullable(),
    createdAt: z.string().openapi({ type: 'string', format: 'date-time' }),
    updatedAt: z.string().openapi({ type: 'string', format: 'date-time' }),
    deletedAt: z.string().nullable().openapi({ type: 'string', format: 'date-time' }),
  })
  .openapi('Product');

type SerializedProduct = z.infer<typeof ProductSchema>;

function serializeProduct(
  product: NonNullable<Awaited<ReturnType<typeof productQueries.getProductById>>>,
): SerializedProduct {
  return {
    id: product.id,
    title: product.title,
    slug: product.slug,
    description: product.description ?? null,
    priceInCents: product.priceInCents ?? null,
    currency: product.currency,
    stripeProductId: product.stripeProductId ?? null,
    stripePriceId: product.stripePriceId ?? null,
    active: product.active,
    status: product.status as SerializedProduct['status'],
    images: product.images ?? null,
    metadata: product.metadata ?? null,
    ownerId: product.ownerId ?? null,
    createdAt: dateToString(product.createdAt),
    updatedAt: dateToString(product.updatedAt),
    deletedAt: nullableDateToString(product.deletedAt),
  };
}

// =============================================================================
// Product Routes
// =============================================================================

// GET /products
app.openapi(
  createRoute({
    method: 'get',
    path: '/products',
    tags: ['content'],
    summary: 'List products',
    request: {
      query: PaginationQuery.extend({
        status: z
          .enum(asNonEmptyTuple(PRODUCT_STATUSES))
          .optional()
          .openapi({ example: 'published' }),
      }),
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), data: z.array(ProductSchema) }),
          },
        },
        description: 'Product list',
      },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user');
    const { status, limit, offset } = c.req.valid('query');

    if (!user) {
      // Public access: only published products
      const data = await productQueries.getAllProducts(db, {
        status: 'published',
        limit,
        offset,
      });
      return c.json({ success: true as const, data: data.map(serializeProduct) }, 200);
    }

    // Admin sees all; non-admin sees only published
    const effectiveStatus = user.role === 'admin' ? status : 'published';
    const data = await productQueries.getAllProducts(db, {
      status: effectiveStatus,
      limit,
      offset,
    });
    return c.json({ success: true as const, data: data.map(serializeProduct) }, 200);
  },
);

// POST /products
app.openapi(
  createRoute({
    method: 'post',
    path: '/products',
    tags: ['content'],
    summary: 'Create a product',
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.object({
              title: z.string().min(1).max(500),
              slug: SlugField,
              description: z.string().max(2000).optional(),
              priceInCents: z.number().int().min(0).optional(),
              currency: z.string().length(3).optional(),
              stripeProductId: z.string().optional(),
              stripePriceId: z.string().optional(),
              active: z.boolean().optional(),
              status: z.enum(asNonEmptyTuple(PRODUCT_STATUSES)).optional(),
              images: z.array(z.string()).optional(),
              metadata: z.record(z.string(), z.unknown()).optional(),
            }),
          },
        },
      },
    },
    responses: {
      201: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), data: ProductSchema }),
          },
        },
        description: 'Product created',
      },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user');
    if (!user) throw new HTTPException(401, { message: 'Authentication required' });
    if (user.role !== 'admin') throw new HTTPException(403, { message: 'Admin access required' });

    const body = c.req.valid('json');
    const product = await productQueries.createProduct(db, {
      id: crypto.randomUUID(),
      ...body,
      ownerId: user.id,
    });
    // biome-ignore lint/style/noNonNullAssertion: createProduct always returns the created row
    return c.json({ success: true as const, data: serializeProduct(product!) }, 201);
  },
);

// GET /products/:id
app.openapi(
  createRoute({
    method: 'get',
    path: '/products/{id}',
    tags: ['content'],
    summary: 'Get a product by ID',
    request: { params: IdParam },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), data: ProductSchema }),
          },
        },
        description: 'Product found',
      },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Not found' },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user');
    const { id } = c.req.valid('param');
    const product = await productQueries.getProductById(db, id);
    if (!product) throw new HTTPException(404, { message: 'Product not found' });

    // Public access: only published products
    if (!user && product.status !== 'published') {
      throw new HTTPException(404, { message: 'Product not found' });
    }

    // Non-admin users can only see published products
    if (user && user.role !== 'admin' && product.status !== 'published') {
      throw new HTTPException(404, { message: 'Product not found' });
    }

    return c.json({ success: true as const, data: serializeProduct(product) }, 200);
  },
);

// PATCH /products/:id
app.openapi(
  createRoute({
    method: 'patch',
    path: '/products/{id}',
    tags: ['content'],
    summary: 'Update a product',
    request: {
      params: IdParam,
      body: {
        content: {
          'application/json': {
            schema: z.object({
              title: z.string().min(1).max(500).optional(),
              slug: SlugField.optional(),
              description: z.string().max(2000).nullable().optional(),
              priceInCents: z.number().int().min(0).nullable().optional(),
              currency: z.string().length(3).optional(),
              stripeProductId: z.string().nullable().optional(),
              stripePriceId: z.string().nullable().optional(),
              active: z.boolean().optional(),
              status: z.enum(asNonEmptyTuple(PRODUCT_STATUSES)).optional(),
              images: z.array(z.string()).nullable().optional(),
              metadata: z.record(z.string(), z.unknown()).nullable().optional(),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), data: ProductSchema }),
          },
        },
        description: 'Product updated',
      },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Not found' },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user');
    if (!user) throw new HTTPException(401, { message: 'Authentication required' });
    if (user.role !== 'admin') throw new HTTPException(403, { message: 'Admin access required' });

    const { id } = c.req.valid('param');
    const existing = await productQueries.getProductById(db, id);
    if (!existing) throw new HTTPException(404, { message: 'Product not found' });

    const body = c.req.valid('json');
    const product = await productQueries.updateProduct(db, id, body);
    if (!product) throw new HTTPException(404, { message: 'Product not found' });
    return c.json({ success: true as const, data: serializeProduct(product) }, 200);
  },
);

// DELETE /products/:id
app.openapi(
  createRoute({
    method: 'delete',
    path: '/products/{id}',
    tags: ['content'],
    summary: 'Delete a product',
    request: { params: IdParam },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), message: z.string() }),
          },
        },
        description: 'Product deleted',
      },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Not found' },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user');
    if (!user) throw new HTTPException(401, { message: 'Authentication required' });
    if (user.role !== 'admin') throw new HTTPException(403, { message: 'Admin access required' });

    const { id } = c.req.valid('param');
    const existing = await productQueries.getProductById(db, id);
    if (!existing) throw new HTTPException(404, { message: 'Product not found' });

    await productQueries.deleteProduct(db, id);
    return c.json({ success: true as const, message: 'Product deleted' }, 200);
  },
);

export default app;
