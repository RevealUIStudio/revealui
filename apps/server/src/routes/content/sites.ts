/**
 * Site CRUD routes
 *
 * GET|POST /sites
 * GET|PATCH|DELETE /sites/:id
 */

import {
  SITE_STATUSES,
  SITE_VISIBILITIES,
  SiteConsultationBindingSchema,
  SiteConsultationLifecycleMutationSchema,
} from '@revealui/contracts/entities';
import { getExplicitDeploymentMode } from '@revealui/core/deployment-mode';
import { cleanupVectorDataForSite } from '@revealui/db/cleanup';
import * as siteQueries from '@revealui/db/queries/sites';
import { createRoute, OpenAPIHono, z } from '@revealui/openapi';
import { isPlatformSuperAdmin } from '@revealui/utils/validation';
import { HTTPException } from 'hono/http-exception';
import { asNonEmptyTuple } from '../../lib/type-guards.js';
import { noStoreCacheMiddleware } from '../../middleware/cache-control.js';
import {
  ErrorSchema,
  IdParam,
  SiteCreateSchema,
  SitePatchSchema,
} from '../_helpers/content-schemas.js';
import { PaginationQuery } from '../_helpers/pagination.js';
import { dateToString, nullableDateToString } from '../_helpers/serialize.js';
import type { ContentVariables } from './index.js';

/** Shared creation authority for direct and batch requests. */
export async function validateSiteCreation(
  db: Parameters<typeof siteQueries.createSite>[0],
  userId: string,
  body: z.infer<typeof SiteCreateSchema>,
): Promise<void> {
  if (body.settings?.consultation) {
    const actor = await siteQueries.getSiteContentActor(db, userId);
    if (!isPlatformSuperAdmin(actor)) {
      throw new HTTPException(403, {
        message: 'Studio fulfillment requires a verified platform operator',
      });
    }
    if (body.visibility !== 'private') {
      throw new HTTPException(400, { message: 'Consultation deliveries must be private' });
    }
    const buyer = await siteQueries.getSiteContentActor(db, body.settings.consultation.buyerUserId);
    if (!buyer?.emailVerified) {
      throw new HTTPException(404, { message: 'Verified active buyer not found' });
    }
  }
}

const app = new OpenAPIHono<{ Variables: ContentVariables }>();
app.use('*', noStoreCacheMiddleware());

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
    status: z.enum(asNonEmptyTuple(SITE_STATUSES)),
    visibility: z.enum(asNonEmptyTuple(SITE_VISIBILITIES)),
    theme: z.unknown().nullable(),
    settings: z.unknown().nullable(),
    pageCount: z.number().nullable(),
    favicon: z.string().nullable(),
    createdAt: z.string().openapi({ type: 'string', format: 'date-time' }),
    updatedAt: z.string().openapi({ type: 'string', format: 'date-time' }),
    publishedAt: z.string().nullable().openapi({ type: 'string', format: 'date-time' }),
  })
  .openapi('Site');

type SerializedSite = z.infer<typeof SiteSchema>;

function serializeSite(
  site: NonNullable<Awaited<ReturnType<typeof siteQueries.getSiteById>>>,
): SerializedSite {
  return {
    id: site.id,
    name: site.name,
    slug: site.slug,
    description: site.description ?? null,
    ownerId: site.ownerId,
    status: site.status as SerializedSite['status'],
    visibility: site.visibility as SerializedSite['visibility'],
    theme: site.theme ?? null,
    settings: site.settings ?? null,
    pageCount: site.pageCount ?? null,
    favicon: site.favicon ?? null,
    createdAt: dateToString(site.createdAt),
    updatedAt: dateToString(site.updatedAt),
    publishedAt: nullableDateToString(site.publishedAt),
  };
}

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
        status: z.enum(asNonEmptyTuple(SITE_STATUSES)).optional().openapi({ example: 'published' }),
        consultationBookingId: z.string().min(1).optional(),
      }),
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              success: z.literal(true),
              data: z.array(SiteSchema),
              totalDocs: z.number(),
              totalPages: z.number(),
              limit: z.number(),
              offset: z.number(),
            }),
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
    const { status, consultationBookingId, limit, offset } = c.req.valid('query');
    const filterOpts = {
      access: { actor: user, mode: getExplicitDeploymentMode() },
      status,
      consultationBookingId,
    };
    const [data, totalDocs] = await Promise.all([
      siteQueries.getAllSites(db, { ...filterOpts, limit, offset }),
      siteQueries.countSites(db, filterOpts),
    ]);
    return c.json(
      {
        success: true as const,
        data: data.map(serializeSite),
        totalDocs,
        totalPages: Math.ceil(totalDocs / limit),
        limit,
        offset,
      },
      200,
    );
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
            schema: SiteCreateSchema,
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
      409: {
        content: { 'application/json': { schema: ErrorSchema } },
        description: 'Site address already in use',
      },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user');
    if (!user) throw new HTTPException(401, { message: 'Authentication required' });
    const body = c.req.valid('json');
    await validateSiteCreation(db, user.id, body);
    const site = await siteQueries.createSite(db, {
      id: crypto.randomUUID(),
      ownerId: user.id,
      ...body,
    });
    if (!site)
      throw new HTTPException(409, {
        message: 'This site address is already in use. Choose another address.',
      });
    return c.json({ success: true as const, data: serializeSite(site) }, 201);
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
    if (!site) throw new HTTPException(404, { message: 'Site not found' });
    if (!(await siteQueries.actorCanReadSite(db, user, site.id, getExplicitDeploymentMode()))) {
      throw new HTTPException(403, { message: 'Forbidden' });
    }
    return c.json({ success: true as const, data: serializeSite(site) }, 200);
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
            schema: SitePatchSchema,
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
    if (!existing) throw new HTTPException(404, { message: 'Site not found' });
    if (
      !(await siteQueries.actorCanManageSite(
        db,
        user,
        existing.id,
        getExplicitDeploymentMode(),
        'admin',
      ))
    ) {
      throw new HTTPException(403, { message: 'Forbidden' });
    }
    if (
      existing.settings &&
      typeof existing.settings === 'object' &&
      'consultation' in existing.settings &&
      body.visibility &&
      body.visibility !== 'private'
    ) {
      throw new HTTPException(400, { message: 'Consultation deliveries must remain private' });
    }
    let site: Awaited<ReturnType<typeof siteQueries.updateSite>>;
    try {
      site = await siteQueries.updateSite(db, id, body);
    } catch (error) {
      if (error instanceof siteQueries.SiteMutationProtectedError)
        throw new HTTPException(409, { message: error.message });
      throw error;
    }
    if (!site) throw new HTTPException(404, { message: 'Site not found' });
    return c.json({ success: true as const, data: serializeSite(site) }, 200);
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
    if (
      !(await siteQueries.actorCanManageSite(
        db,
        user,
        existing.id,
        getExplicitDeploymentMode(),
        'admin',
      ))
    ) {
      throw new HTTPException(403, { message: 'Forbidden' });
    }
    try {
      await siteQueries.deleteSite(db, id);
    } catch (error) {
      if (error instanceof siteQueries.SiteDomainCleanupRequiredError)
        throw new HTTPException(409, { message: error.message });
      throw error;
    }

    // Fire-and-forget: cascade delete the site's vector / RAG rows. Sites
    // soft-delete instead of hard-delete, so FK cascades don't fire — the
    // batch cleanup cron also handles missed deletions if this throws.
    cleanupVectorDataForSite(db, id).catch(() => {
      // Swallowed  -  vector cleanup is best-effort.
    });

    return c.json({ success: true as const, message: 'Site deleted' }, 200);
  },
);

// Collaborator access belongs to the existing site, independent of publication.
const CollaboratorSchema = z.object({
  userId: z.string(),
  role: z.enum(['admin', 'editor', 'viewer']),
});
const CollaboratorParams = z.object({ siteId: z.string().min(1), userId: z.string().min(1) });
const MembershipResult = z.object({ success: z.literal(true) });

app.openapi(
  createRoute({
    method: 'put',
    path: '/sites/{siteId}/consultation-lifecycle',
    tags: ['content'],
    summary: 'Apply verified consultation payment lifecycle evidence',
    request: {
      params: z.object({ siteId: z.string().min(1) }),
      body: {
        content: { 'application/json': { schema: SiteConsultationLifecycleMutationSchema } },
      },
    },
    responses: {
      200: {
        content: {
          'application/json': { schema: z.object({ success: z.literal(true), data: SiteSchema }) },
        },
        description: 'Current consultation lifecycle',
      },
      409: {
        content: { 'application/json': { schema: ErrorSchema } },
        description: 'Evidence does not match the current binding or refund',
      },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const user = c.get('user');
    if (!user) throw new HTTPException(401, { message: 'Authentication required' });
    const actor = await siteQueries.getSiteContentActor(db, user.id);
    if (!isPlatformSuperAdmin(actor))
      throw new HTTPException(403, { message: 'Verified platform operator required' });
    const { siteId } = c.req.valid('param');
    const site = await siteQueries.getSiteById(db, siteId);
    if (!site || site.ownerId !== user.id)
      throw new HTTPException(404, { message: 'Owned consultation not found' });
    const updated = await siteQueries.updateConsultationLifecycle(
      db,
      siteId,
      user.id,
      c.req.valid('json'),
    );
    if (!updated)
      throw new HTTPException(409, {
        message: 'Consultation binding or current refund evidence does not match',
      });
    return c.json({ success: true as const, data: serializeSite(updated) }, 200);
  },
);

async function requireSiteAdmin(
  db: ContentVariables['db'],
  user: ContentVariables['user'],
  siteId: string,
) {
  if (!user) throw new HTTPException(401, { message: 'Authentication required' });
  if (
    !(await siteQueries.actorCanManageSite(db, user, siteId, getExplicitDeploymentMode(), 'admin'))
  ) {
    throw new HTTPException(403, { message: 'Site administration required' });
  }
  return user;
}

app.openapi(
  createRoute({
    method: 'get',
    path: '/sites/{siteId}/collaborators',
    tags: ['content'],
    summary: 'List site collaborators',
    request: { params: z.object({ siteId: z.string().min(1) }) },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), data: z.array(CollaboratorSchema) }),
          },
        },
        description: 'Site collaborators',
      },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const { siteId } = c.req.valid('param');
    await requireSiteAdmin(db, c.get('user'), siteId);
    const members = await siteQueries.listSiteCollaborators(db, siteId);
    return c.json(
      {
        success: true as const,
        data: members.map(({ userId, role }) => ({
          userId,
          role: role as 'admin' | 'editor' | 'viewer',
        })),
      },
      200,
    );
  },
);

app.openapi(
  createRoute({
    method: 'put',
    path: '/sites/{siteId}/collaborators/{userId}',
    tags: ['content'],
    summary: 'Grant or update a site collaborator',
    request: {
      params: CollaboratorParams,
      body: {
        content: { 'application/json': { schema: CollaboratorSchema.pick({ role: true }) } },
      },
    },
    responses: {
      200: {
        content: { 'application/json': { schema: MembershipResult } },
        description: 'Site collaborator saved',
      },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const { siteId, userId } = c.req.valid('param');
    const actor = await requireSiteAdmin(db, c.get('user'), siteId);
    const site = await siteQueries.getSiteById(db, siteId);
    const binding =
      site &&
      SiteConsultationBindingSchema.safeParse(
        site.settings && typeof site.settings === 'object' && 'consultation' in site.settings
          ? site.settings.consultation
          : undefined,
      );
    if (
      binding?.success &&
      (userId !== binding.data.buyerUserId || c.req.valid('json').role !== 'viewer')
    ) {
      throw new HTTPException(400, {
        message: 'Consultation membership is limited to the bound buyer as viewer',
      });
    }
    if (!(await siteQueries.getSiteContentActor(db, userId)))
      throw new HTTPException(404, { message: 'User not found' });
    await siteQueries.setSiteCollaborator(db, {
      siteId,
      userId,
      role: c.req.valid('json').role,
      addedBy: actor.id,
    });
    return c.json({ success: true as const }, 200);
  },
);

app.openapi(
  createRoute({
    method: 'delete',
    path: '/sites/{siteId}/collaborators/{userId}',
    tags: ['content'],
    summary: 'Revoke a site collaborator',
    request: { params: CollaboratorParams },
    responses: {
      200: {
        content: { 'application/json': { schema: MembershipResult } },
        description: 'Site collaborator revoked',
      },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const { siteId, userId } = c.req.valid('param');
    await requireSiteAdmin(db, c.get('user'), siteId);
    await siteQueries.removeSiteCollaborator(db, siteId, userId);
    return c.json({ success: true as const }, 200);
  },
);

export default app;
