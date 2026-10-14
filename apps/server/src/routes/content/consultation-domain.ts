import { getStudioDomainConfig } from '@revealui/config';
import {
  ConsultationDnsProofSchema,
  ConsultationHostnameInputSchema,
  ConsultationVerificationSchema,
  SiteConsultationBindingSchema,
  SiteConsultationDomainPendingSchema,
  SiteConsultationDomainSchema,
  SiteConsultationLifecycleSchema,
} from '@revealui/contracts/entities';
import { type Database, withTransaction } from '@revealui/db/client';
import * as siteQueries from '@revealui/db/queries/sites';
import { createRoute, OpenAPIHono, z } from '@revealui/openapi';
import { isPlatformSuperAdmin } from '@revealui/utils/validation';
import { HTTPException } from 'hono/http-exception';
import {
  attachVerifiedConsultationDomain,
  detachConsultationDomain,
} from '../../lib/consultation-domain.js';
import { noStoreCacheMiddleware } from '../../middleware/cache-control.js';
import { ErrorSchema } from '../_helpers/content-schemas.js';
import type { ContentVariables } from './index.js';

const app = new OpenAPIHono<{ Variables: ContentVariables }>();
app.use('*', noStoreCacheMiddleware());
const Params = z.object({ siteId: z.string().min(1) });
const Result = z.object({
  success: z.literal(true),
  data: z.object({
    siteId: z.string(),
    domain: SiteConsultationDomainSchema.nullable(),
    customDomainAttached: z.boolean(),
    status: z.enum(['attached', 'pending-verification', 'detached']),
    hostname: z.string().optional(),
    verification: ConsultationVerificationSchema.optional(),
    dns: ConsultationDnsProofSchema.optional(),
  }),
});
function domainConfig() {
  try {
    const config = getStudioDomainConfig(process.env);
    if (config) return config;
  } catch {
    /* Invalid supported configuration fails closed. */
  }
  throw new HTTPException(503, { message: 'Consultation domains are not configured' });
}
async function requireOwner(
  db: Database,
  user: ContentVariables['user'],
  siteId: string,
  lock = false,
) {
  if (!user) throw new HTTPException(401, { message: 'Authentication required' });
  const site = lock
    ? await siteQueries.getSiteForUpdate(db, siteId)
    : await siteQueries.getSiteById(db, siteId);
  const actor = await siteQueries.getSiteContentActor(db, user.id);
  if (!isPlatformSuperAdmin(actor))
    throw new HTTPException(403, { message: 'Verified platform operator required' });
  if (!site || site.ownerId !== user.id || site.visibility !== 'private')
    throw new HTTPException(404, { message: 'Owned consultation not found' });
  const settings = site.settings as Record<string, unknown> | null;
  if (!SiteConsultationBindingSchema.safeParse(settings?.consultation).success)
    throw new HTTPException(404, { message: 'Owned consultation not found' });
  return { site, settings, actor: user };
}
function requireEntitlement(settings: Record<string, unknown> | null) {
  const lifecycle = SiteConsultationLifecycleSchema.safeParse(settings?.consultationLifecycle);
  if (
    !lifecycle.success ||
    lifecycle.data.revoked ||
    !lifecycle.data.domainPackPurchased ||
    !['entitled', 'retained'].includes(lifecycle.data.domainPack)
  )
    throw new HTTPException(409, { message: 'Current domain pack entitlement required' });
}
function savedDomain(settings: Record<string, unknown> | null) {
  const verified = SiteConsultationDomainSchema.safeParse(settings?.consultationDomain);
  const pending = SiteConsultationDomainPendingSchema.safeParse(
    settings?.consultationDomainPending,
  );
  return {
    verified: verified.success ? verified.data : null,
    pending: pending.success ? pending.data : null,
  };
}
function uniqueConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const value = error as { code?: string; cause?: unknown };
  return value.code === '23505' || (value.cause !== error && uniqueConflict(value.cause));
}

app.openapi(
  createRoute({
    method: 'get',
    path: '/consultation-domain',
    tags: ['content'],
    summary: 'Resolve a published private consultation hostname',
    request: { query: z.object({ hostname: ConsultationHostnameInputSchema }) },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), data: z.object({ siteId: z.string() }) }),
          },
        },
        description: 'Authenticated reader target only',
      },
      404: {
        content: { 'application/json': { schema: ErrorSchema } },
        description: 'No active domain delivery',
      },
    },
  }),
  async (c) => {
    let config: ReturnType<typeof getStudioDomainConfig> = null;
    try {
      config = getStudioDomainConfig(process.env);
    } catch {
      /* An unavailable feature has no public mappings. */
    }
    const site =
      config &&
      (await siteQueries.getConsultationSiteIdByHostname(
        c.get('db'),
        c.req.valid('query').hostname,
        config.projectId,
      ));
    if (!site) throw new HTTPException(404, { message: 'Delivery not found' });
    return c.json({ success: true as const, data: site }, 200);
  },
);

app.openapi(
  createRoute({
    method: 'put',
    path: '/sites/{siteId}/consultation-domain',
    tags: ['content'],
    summary: 'Attach and verify a consultation hostname',
    request: {
      params: Params,
      body: {
        content: {
          'application/json': {
            schema: z.strictObject({ hostname: ConsultationHostnameInputSchema }),
          },
        },
      },
    },
    responses: {
      200: {
        content: { 'application/json': { schema: Result } },
        description: 'Verified domain attached',
      },
      202: {
        content: { 'application/json': { schema: Result } },
        description: 'Ownership or DNS verification pending; domain is not attached',
      },
      409: {
        content: { 'application/json': { schema: ErrorSchema } },
        description: 'Current delivery cannot bind this domain',
      },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const { siteId } = c.req.valid('param');
    const { site, settings, actor } = await requireOwner(db, c.get('user'), siteId);
    requireEntitlement(settings);
    const { hostname } = c.req.valid('json');
    const existing = savedDomain(settings);
    if (
      [existing.verified, existing.pending].some((domain) => domain && domain.hostname !== hostname)
    )
      throw new HTTPException(409, {
        message: 'Detach the current hostname before attaching another',
      });
    const other = await siteQueries.getConsultationDomainOwner(db, hostname);
    if (other && other.siteId !== site.id)
      throw new HTTPException(409, { message: 'Hostname is already bound to another delivery' });
    const config = domainConfig();
    if (
      [existing.verified, existing.pending].some(
        (domain) => domain && domain.projectId !== config.projectId,
      )
    )
      throw new HTTPException(409, {
        message: 'Stored hostname belongs to a different provider project',
      });
    try {
      const reserved = await siteQueries.reserveConsultationDomain(db, siteId, actor.id, {
        hostname,
        provider: 'vercel',
        projectId: config.projectId,
      });
      if (!reserved)
        throw new HTTPException(409, { message: 'Current hostname or entitlement changed' });
    } catch (error) {
      if (uniqueConflict(error))
        throw new HTTPException(409, { message: 'Hostname is already bound to another delivery' });
      const cleanup = siteQueries.SiteDomainCleanupRequiredError.fromDatabase(error);
      if (cleanup) throw new HTTPException(cleanup.statusCode, { message: cleanup.message });
      throw error;
    }
    // Serialize all provider mutations on the owning row. The committed reservation
    // survives rollback/crash, and a delayed operation cannot revive a detached alias.
    const proof = await withTransaction(db, async (tx) => {
      const current = await requireOwner(tx, c.get('user'), siteId, true);
      requireEntitlement(current.settings);
      const saved = savedDomain(current.settings);
      if (saved.pending?.hostname !== hostname || saved.pending.projectId !== config.projectId)
        throw new HTTPException(409, { message: 'Hostname reservation changed' });
      let checked: Awaited<ReturnType<typeof attachVerifiedConsultationDomain>>;
      try {
        checked = await attachVerifiedConsultationDomain(config, hostname);
      } catch {
        throw new HTTPException(503, { message: 'Provider domain verification unavailable' });
      }
      const updated =
        checked.status === 'pending-verification'
          ? await siteQueries.invalidateConsultationDomainProof(tx, siteId, actor.id, hostname)
          : await siteQueries.setConsultationDomain(tx, siteId, actor.id, checked.domain);
      if (!updated)
        throw new HTTPException(409, { message: 'Hostname reservation or entitlement changed' });
      return checked;
    }).catch((error: unknown) => {
      const cleanup = siteQueries.SiteDomainCleanupRequiredError.fromDatabase(error);
      if (cleanup) throw new HTTPException(cleanup.statusCode, { message: cleanup.message });
      throw error;
    });
    if (proof.status === 'pending-verification') {
      return c.json(
        { success: true as const, data: { siteId, ...proof, customDomainAttached: false } },
        202,
      );
    }
    return c.json(
      {
        success: true as const,
        data: {
          siteId,
          domain: proof.domain,
          status: 'attached' as const,
          customDomainAttached: true,
        },
      },
      200,
    );
  },
);

app.openapi(
  createRoute({
    method: 'delete',
    path: '/sites/{siteId}/consultation-domain',
    tags: ['content'],
    summary: 'Detach a consultation hostname',
    request: { params: Params },
    responses: {
      200: { content: { 'application/json': { schema: Result } }, description: 'Domain detached' },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const { siteId } = c.req.valid('param');
    await withTransaction(db, async (tx) => {
      const { settings, actor } = await requireOwner(tx, c.get('user'), siteId, true);
      const saved = savedDomain(settings);
      const existing = saved.verified ?? saved.pending;
      if (!existing) return;
      const config = domainConfig();
      if (existing.projectId !== config.projectId)
        throw new HTTPException(409, {
          message: 'Stored hostname belongs to a different provider project',
        });
      try {
        await detachConsultationDomain(config, existing.hostname);
      } catch {
        throw new HTTPException(503, { message: 'Provider domain detach unavailable' });
      }
      const removed = await siteQueries.removeConsultationDomain(
        tx,
        siteId,
        actor.id,
        existing.hostname,
      );
      if (!removed)
        throw new HTTPException(409, { message: 'Hostname binding changed during detach' });
    });
    return c.json(
      {
        success: true as const,
        data: { siteId, domain: null, status: 'detached' as const, customDomainAttached: false },
      },
      200,
    );
  },
);
export default app;
