/**
 * User CRUD routes (admin-facing)
 *
 * GET    /users      — List users with pagination (admin-only)
 * GET    /users/:id  — Get user by ID (admin or self)
 * PATCH  /users/:id  — Update user (admin or self, restricted fields)
 * DELETE /users/:id  — Soft-delete user (admin-only)
 *
 * No POST — users are created via auth signup flows.
 *
 * Returns the paginated envelope format expected by the admin dashboard panel:
 *   { docs, totalDocs, totalPages, page, limit, ... }
 */

import * as userQueries from '@revealui/db/queries/users';
import { createRoute, OpenAPIHono, z } from '@revealui/openapi';
import { HTTPException } from 'hono/http-exception';
import { ErrorSchema, IdParam } from '../_helpers/content-schemas.js';
import { dateToString, nullableDateToString } from '../_helpers/serialize.js';
import type { ContentVariables } from './index.js';

const app = new OpenAPIHono<{ Variables: ContentVariables }>();

// =============================================================================
// Constants
// =============================================================================

/** Roles that grant admin-level access to user management */
const ADMIN_ROLES = new Set(['admin', 'super-admin', 'user-admin', 'user-super-admin']);

function isAdminRole(role: string): boolean {
  return ADMIN_ROLES.has(role);
}

/**
 * Fields that must NEVER be returned in API responses.
 * These contain authentication secrets or tokens.
 */
const SENSITIVE_FIELDS = new Set([
  'password',
  'mfaSecret',
  'mfaBackupCodes',
  'emailVerificationToken',
  'stripeCustomerId',
]);

// =============================================================================
// Schemas
// =============================================================================

const UserSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    email: z.string().nullable(),
    avatarUrl: z.string().nullable(),
    type: z.string(),
    role: z.string(),
    status: z.string(),
    emailVerified: z.boolean(),
    mfaEnabled: z.boolean(),
    createdAt: z.string().openapi({ type: 'string', format: 'date-time' }),
    updatedAt: z.string().openapi({ type: 'string', format: 'date-time' }),
    lastActiveAt: z.string().nullable().openapi({ type: 'string', format: 'date-time' }),
  })
  .openapi('User');

const PaginatedUsersSchema = z.object({
  success: z.literal(true),
  data: z.array(UserSchema),
  docs: z.array(UserSchema).openapi({ description: 'Alias for data (admin dashboard compat)' }),
  totalDocs: z.number(),
  totalPages: z.number(),
  page: z.number(),
  limit: z.number(),
  pagingCounter: z.number(),
  hasPrevPage: z.boolean(),
  hasNextPage: z.boolean(),
  prevPage: z.number().nullable(),
  nextPage: z.number().nullable(),
});

const UserListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  status: z.string().optional(),
  role: z.string().optional(),
  search: z.string().optional(),
});

type SerializedUser = z.infer<typeof UserSchema>;

// =============================================================================
// Serialization
// =============================================================================

function serializeUser(
  user: NonNullable<Awaited<ReturnType<typeof userQueries.getUserById>>>,
): SerializedUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email ?? null,
    avatarUrl: user.avatarUrl ?? null,
    type: user.type,
    role: user.role,
    status: user.status,
    emailVerified: user.emailVerified,
    mfaEnabled: user.mfaEnabled,
    createdAt: dateToString(user.createdAt),
    updatedAt: dateToString(user.updatedAt),
    lastActiveAt: nullableDateToString(user.lastActiveAt),
  };
}

// =============================================================================
// Routes
// =============================================================================

// GET /users — paginated list (admin-only)
app.openapi(
  createRoute({
    method: 'get',
    path: '/users',
    tags: ['content'],
    summary: 'List users (admin-only)',
    request: { query: UserListQuery },
    responses: {
      200: {
        content: { 'application/json': { schema: PaginatedUsersSchema } },
        description: 'Paginated user list',
      },
    },
  }),
  async (c) => {
    const user = c.get('user');
    if (!user) throw new HTTPException(401, { message: 'Authentication required' });
    if (!isAdminRole(user.role)) {
      throw new HTTPException(403, { message: 'Admin access required' });
    }

    const db = c.get('db');
    const { page, limit, status, role, search } = c.req.valid('query');
    const offset = (page - 1) * limit;

    const [docs, totalDocs] = await Promise.all([
      userQueries.getAllUsers(db, { status, role, search, limit, offset }),
      userQueries.countUsers(db, { status, role, search }),
    ]);

    const totalPages = Math.ceil(totalDocs / limit);

    const serialized = docs.map(serializeUser);

    return c.json(
      {
        success: true as const,
        data: serialized,
        docs: serialized,
        totalDocs,
        totalPages,
        page,
        limit,
        pagingCounter: offset + 1,
        hasPrevPage: page > 1,
        hasNextPage: page < totalPages,
        prevPage: page > 1 ? page - 1 : null,
        nextPage: page < totalPages ? page + 1 : null,
      },
      200,
    );
  },
);

// GET /users/:id — get single user (admin or self)
app.openapi(
  createRoute({
    method: 'get',
    path: '/users/{id}',
    tags: ['content'],
    summary: 'Get a user by ID',
    request: { params: IdParam },
    responses: {
      200: {
        content: {
          'application/json': { schema: z.object({ success: z.literal(true), data: UserSchema }) },
        },
        description: 'User found',
      },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Not found' },
    },
  }),
  async (c) => {
    const sessionUser = c.get('user');
    if (!sessionUser) throw new HTTPException(401, { message: 'Authentication required' });

    const { id } = c.req.valid('param');

    // Non-admins can only view their own profile
    if (!isAdminRole(sessionUser.role) && sessionUser.id !== id) {
      throw new HTTPException(403, { message: 'Forbidden' });
    }

    const db = c.get('db');
    const user = await userQueries.getUserById(db, id);
    if (!user) throw new HTTPException(404, { message: 'User not found' });

    return c.json({ success: true as const, data: serializeUser(user) }, 200);
  },
);

// PATCH /users/:id — update user (admin or self, restricted fields)
app.openapi(
  createRoute({
    method: 'patch',
    path: '/users/{id}',
    tags: ['content'],
    summary: 'Update a user',
    request: {
      params: IdParam,
      body: {
        content: {
          'application/json': {
            schema: z.object({
              name: z.string().min(1).max(200).optional(),
              email: z.string().email().optional(),
              role: z.string().optional(),
              status: z.string().optional(),
              avatarUrl: z.string().nullable().optional(),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          'application/json': { schema: z.object({ success: z.literal(true), data: UserSchema }) },
        },
        description: 'User updated',
      },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Not found' },
    },
  }),
  async (c) => {
    const sessionUser = c.get('user');
    if (!sessionUser) throw new HTTPException(401, { message: 'Authentication required' });

    const { id } = c.req.valid('param');
    const isAdmin = isAdminRole(sessionUser.role);

    // Non-admins can only update their own profile
    if (!isAdmin && sessionUser.id !== id) {
      throw new HTTPException(403, { message: 'Forbidden' });
    }

    const db = c.get('db');
    const existing = await userQueries.getUserById(db, id);
    if (!existing) throw new HTTPException(404, { message: 'User not found' });

    const body = c.req.valid('json');

    // Non-admins cannot change role or status
    if (!isAdmin && (body.role !== undefined || body.status !== undefined)) {
      throw new HTTPException(403, { message: 'Only admins can change role or status' });
    }

    // Strip any sensitive fields that might sneak through
    const sanitized = Object.fromEntries(
      Object.entries(body).filter(([key]) => !SENSITIVE_FIELDS.has(key)),
    );

    const updated = await userQueries.updateUser(db, id, sanitized);
    if (!updated) throw new HTTPException(404, { message: 'User not found' });

    return c.json({ success: true as const, data: serializeUser(updated) }, 200);
  },
);

// DELETE /users/:id — soft-delete (admin-only)
app.openapi(
  createRoute({
    method: 'delete',
    path: '/users/{id}',
    tags: ['content'],
    summary: 'Delete a user (soft-delete)',
    request: { params: IdParam },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), message: z.string() }),
          },
        },
        description: 'User deleted',
      },
      404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Not found' },
    },
  }),
  async (c) => {
    const sessionUser = c.get('user');
    if (!sessionUser) throw new HTTPException(401, { message: 'Authentication required' });
    if (!isAdminRole(sessionUser.role)) {
      throw new HTTPException(403, { message: 'Admin access required' });
    }

    const { id } = c.req.valid('param');

    // Prevent self-deletion
    if (sessionUser.id === id) {
      throw new HTTPException(400, { message: 'Cannot delete your own account' });
    }

    const db = c.get('db');
    const existing = await userQueries.getUserById(db, id);
    if (!existing) throw new HTTPException(404, { message: 'User not found' });

    await userQueries.deleteUser(db, id);
    return c.json({ success: true as const, message: 'User deleted' }, 200);
  },
);

export default app;
