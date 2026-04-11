/**
 * Order CRUD routes
 *
 * GET /orders         — List orders (admin: all; authenticated: own orders)
 * POST /orders        — Create an order (authenticated)
 * GET /orders/:id     — Get order by ID (admin or owner)
 * PATCH /orders/:id   — Update order status (admin-only)
 */

import * as orderQueries from '@revealui/db/queries/orders';
import { ORDER_STATUSES } from '@revealui/db/schema/products';
import { createRoute, OpenAPIHono, z } from '@revealui/openapi';
import { HTTPException } from 'hono/http-exception';
import { asNonEmptyTuple } from '../../lib/type-guards.js';
import { ErrorSchema, IdParam } from '../_helpers/content-schemas.js';
import { PaginationQuery } from '../_helpers/pagination.js';
import { dateToString } from '../_helpers/serialize.js';
import type { ContentVariables } from './index.js';

const app = new OpenAPIHono<{ Variables: ContentVariables }>();

// =============================================================================
// Order Schemas
// =============================================================================

const OrderItemSchema = z.object({
  productId: z.string(),
  title: z.string(),
  quantity: z.number().int().positive(),
  priceInCents: z.number().int().min(0),
});

const OrderSchema = z
  .object({
    id: z.string(),
    customerId: z.string(),
    status: z.enum(asNonEmptyTuple(ORDER_STATUSES)),
    totalInCents: z.number(),
    currency: z.string(),
    stripePaymentIntentId: z.string().nullable(),
    stripeCheckoutSessionId: z.string().nullable(),
    items: z.array(OrderItemSchema),
    shippingAddress: z.unknown().nullable(),
    metadata: z.unknown().nullable(),
    createdAt: z.string().openapi({ type: 'string', format: 'date-time' }),
    updatedAt: z.string().openapi({ type: 'string', format: 'date-time' }),
  })
  .openapi('Order');

type SerializedOrder = z.infer<typeof OrderSchema>;

function serializeOrder(
  order: NonNullable<Awaited<ReturnType<typeof orderQueries.getOrderById>>>,
): SerializedOrder {
  return {
    id: order.id,
    customerId: order.customerId,
    status: order.status as SerializedOrder['status'],
    totalInCents: order.totalInCents,
    currency: order.currency,
    stripePaymentIntentId: order.stripePaymentIntentId ?? null,
    stripeCheckoutSessionId: order.stripeCheckoutSessionId ?? null,
    items: (order.items ?? []) as SerializedOrder['items'],
    shippingAddress: order.shippingAddress ?? null,
    metadata: order.metadata ?? null,
    createdAt: dateToString(order.createdAt),
    updatedAt: dateToString(order.updatedAt),
  };
}

// =============================================================================
// Order Routes
// =============================================================================

// GET /orders
app.openapi(
  createRoute({
    method: 'get',
    path: '/orders',
    tags: ['content'],
    summary: 'List orders',
    request: {
      query: PaginationQuery.extend({
        status: z.enum(asNonEmptyTuple(ORDER_STATUSES)).optional(),
      }),
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              success: z.literal(true),
              data: z.array(OrderSchema),
              totalDocs: z.number(),
              totalPages: z.number(),
              limit: z.number(),
              offset: z.number(),
            }),
          },
        },
        description: 'Order list',
      },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user');
    if (!user) throw new HTTPException(401, { message: 'Authentication required' });

    const { status, limit, offset } = c.req.valid('query');

    // Admin sees all orders; non-admin sees only their own
    const customerId = user.role === 'admin' ? undefined : user.id;
    const filterOpts = { customerId, status };
    const [data, totalDocs] = await Promise.all([
      orderQueries.getAllOrders(db, { ...filterOpts, limit, offset }),
      orderQueries.countOrders(db, filterOpts),
    ]);
    return c.json(
      {
        success: true as const,
        data: data.map(serializeOrder),
        totalDocs,
        totalPages: Math.ceil(totalDocs / limit),
        limit,
        offset,
      },
      200,
    );
  },
);

// POST /orders
app.openapi(
  createRoute({
    method: 'post',
    path: '/orders',
    tags: ['content'],
    summary: 'Create an order',
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.object({
              items: z.array(OrderItemSchema).min(1).max(100),
              currency: z.string().length(3).optional(),
              shippingAddress: z.record(z.string(), z.unknown()).optional(),
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
            schema: z.object({ success: z.literal(true), data: OrderSchema }),
          },
        },
        description: 'Order created',
      },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user');
    if (!user) throw new HTTPException(401, { message: 'Authentication required' });

    const body = c.req.valid('json');

    // Calculate total from line items
    const totalInCents = body.items.reduce(
      (sum, item) => sum + item.priceInCents * item.quantity,
      0,
    );

    const order = await orderQueries.createOrder(db, {
      id: crypto.randomUUID(),
      customerId: user.id,
      items: body.items,
      totalInCents,
      currency: body.currency ?? 'usd',
      shippingAddress: body.shippingAddress,
      metadata: body.metadata,
    });
    // biome-ignore lint/style/noNonNullAssertion: createOrder always returns the created row
    return c.json({ success: true as const, data: serializeOrder(order!) }, 201);
  },
);

// GET /orders/:id
app.openapi(
  createRoute({
    method: 'get',
    path: '/orders/{id}',
    tags: ['content'],
    summary: 'Get an order by ID',
    request: { params: IdParam },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), data: OrderSchema }),
          },
        },
        description: 'Order found',
      },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Not found' },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user');
    if (!user) throw new HTTPException(401, { message: 'Authentication required' });

    const { id } = c.req.valid('param');
    const order = await orderQueries.getOrderById(db, id);
    if (!order) throw new HTTPException(404, { message: 'Order not found' });

    // Non-admin can only view their own orders
    if (user.role !== 'admin' && order.customerId !== user.id) {
      throw new HTTPException(403, { message: 'Forbidden' });
    }

    return c.json({ success: true as const, data: serializeOrder(order) }, 200);
  },
);

// PATCH /orders/:id
app.openapi(
  createRoute({
    method: 'patch',
    path: '/orders/{id}',
    tags: ['content'],
    summary: 'Update order status',
    request: {
      params: IdParam,
      body: {
        content: {
          'application/json': {
            schema: z.object({
              status: z.enum(asNonEmptyTuple(ORDER_STATUSES)),
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
            schema: z.object({ success: z.literal(true), data: OrderSchema }),
          },
        },
        description: 'Order updated',
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
    const existing = await orderQueries.getOrderById(db, id);
    if (!existing) throw new HTTPException(404, { message: 'Order not found' });

    const body = c.req.valid('json');
    const order = await orderQueries.updateOrder(db, id, body);
    if (!order) throw new HTTPException(404, { message: 'Order not found' });
    return c.json({ success: true as const, data: serializeOrder(order) }, 200);
  },
);

export default app;
