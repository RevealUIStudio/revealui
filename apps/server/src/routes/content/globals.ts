/**
 * Global CRUD routes
 *
 * GET   /globals/:slug   public  -  returns the published global config
 * PATCH /globals/:slug   auth'd  -  mutates the global (RBAC content:update)
 *
 * Globals are single-row site configuration (header, footer, settings). The
 * read path is public because these render on every public page; the write
 * path inherits the content-mutation middleware chain mounted at
 * `/api/content/*` in index.ts (requirePermission('content','update') +
 * CSRF + rejectRecovery), so no auth is re-implemented here.
 */

import {
  getGlobalFooter,
  getGlobalHeader,
  getGlobalSettings,
  isGlobalSlug,
  updateGlobalFooter,
  updateGlobalHeader,
  updateGlobalSettings,
} from '@revealui/db/queries/globals';
import { createRoute, OpenAPIHono, z } from '@revealui/openapi';
import { HTTPException } from 'hono/http-exception';
import { SlugParam, ValidationErrorSchema } from '../_helpers/content-schemas.js';
import { dateToString } from '../_helpers/serialize.js';
import type { ContentVariables } from './index.js';

const app = new OpenAPIHono<{ Variables: ContentVariables }>();

// =============================================================================
// Response Schemas
// =============================================================================

const DateTime = z.string().openapi({ type: 'string', format: 'date-time' });

const GlobalHeaderSchema = z
  .object({
    id: z.string(),
    schemaVersion: z.string(),
    navItems: z.unknown().nullable(),
    logoId: z.string().nullable(),
    createdAt: DateTime,
    updatedAt: DateTime,
  })
  .openapi('GlobalHeader');

const GlobalFooterSchema = z
  .object({
    id: z.string(),
    schemaVersion: z.string(),
    columns: z.unknown().nullable(),
    copyright: z.string().nullable(),
    socialLinks: z.unknown().nullable(),
    createdAt: DateTime,
    updatedAt: DateTime,
  })
  .openapi('GlobalFooter');

const GlobalSettingsSchema = z
  .object({
    id: z.string(),
    schemaVersion: z.string(),
    siteName: z.string().nullable(),
    siteDescription: z.string().nullable(),
    defaultMeta: z.unknown().nullable(),
    contactEmail: z.string().nullable(),
    contactPhone: z.string().nullable(),
    socialProfiles: z.unknown().nullable(),
    analyticsId: z.string().nullable(),
    features: z.unknown().nullable(),
    createdAt: DateTime,
    updatedAt: DateTime,
  })
  .openapi('GlobalSettings');

const GlobalSchema = z.union([GlobalHeaderSchema, GlobalFooterSchema, GlobalSettingsSchema]);

const GlobalResponse = z.object({ success: z.literal(true), data: GlobalSchema });
const NotFoundSchema = z.object({ success: z.literal(false), error: z.string() });

// =============================================================================
// Request Schemas (per-slug, strict  -  unknown/wrong-slug fields are rejected)
// =============================================================================

const NavItemSchema = z.object({
  label: z.string(),
  url: z.string(),
  newTab: z.boolean().optional(),
  children: z
    .array(z.object({ label: z.string(), url: z.string(), newTab: z.boolean().optional() }))
    .optional(),
});

const HeaderUpdateSchema = z
  .object({
    schemaVersion: z.string().optional(),
    navItems: z.array(NavItemSchema).optional(),
    logoId: z.string().nullable().optional(),
  })
  .strict();

const FooterUpdateSchema = z
  .object({
    schemaVersion: z.string().optional(),
    columns: z
      .array(
        z.object({
          label: z.string(),
          links: z.array(
            z.object({ label: z.string(), url: z.string(), newTab: z.boolean().optional() }),
          ),
        }),
      )
      .optional(),
    copyright: z.string().nullable().optional(),
    socialLinks: z.array(z.object({ platform: z.string(), url: z.string() })).optional(),
  })
  .strict();

const SettingsUpdateSchema = z
  .object({
    schemaVersion: z.string().optional(),
    siteName: z.string().nullable().optional(),
    siteDescription: z.string().nullable().optional(),
    defaultMeta: z.record(z.string(), z.unknown()).nullable().optional(),
    contactEmail: z.string().nullable().optional(),
    contactPhone: z.string().nullable().optional(),
    socialProfiles: z.record(z.string(), z.unknown()).nullable().optional(),
    analyticsId: z.string().nullable().optional(),
    features: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .strict();

// The OpenAPI body is permissive; the strict per-slug schema above runs in the
// handler once the slug is known, so wrong-slug fields fail with a 400.
const GlobalPatchBody = z.record(z.string(), z.unknown());

// =============================================================================
// Serializers
// =============================================================================

function serializeHeader(
  row: NonNullable<Awaited<ReturnType<typeof getGlobalHeader>>>,
): z.infer<typeof GlobalHeaderSchema> {
  return {
    id: row.id,
    schemaVersion: row.schemaVersion,
    navItems: row.navItems ?? null,
    logoId: row.logoId ?? null,
    createdAt: dateToString(row.createdAt),
    updatedAt: dateToString(row.updatedAt),
  };
}

function serializeFooter(
  row: NonNullable<Awaited<ReturnType<typeof getGlobalFooter>>>,
): z.infer<typeof GlobalFooterSchema> {
  return {
    id: row.id,
    schemaVersion: row.schemaVersion,
    columns: row.columns ?? null,
    copyright: row.copyright ?? null,
    socialLinks: row.socialLinks ?? null,
    createdAt: dateToString(row.createdAt),
    updatedAt: dateToString(row.updatedAt),
  };
}

function serializeSettings(
  row: NonNullable<Awaited<ReturnType<typeof getGlobalSettings>>>,
): z.infer<typeof GlobalSettingsSchema> {
  return {
    id: row.id,
    schemaVersion: row.schemaVersion,
    siteName: row.siteName ?? null,
    siteDescription: row.siteDescription ?? null,
    defaultMeta: row.defaultMeta ?? null,
    contactEmail: row.contactEmail ?? null,
    contactPhone: row.contactPhone ?? null,
    socialProfiles: row.socialProfiles ?? null,
    analyticsId: row.analyticsId ?? null,
    features: row.features ?? null,
    createdAt: dateToString(row.createdAt),
    updatedAt: dateToString(row.updatedAt),
  };
}

// =============================================================================
// Routes
// =============================================================================

// GET /globals/:slug  -  public read of the published global
app.openapi(
  createRoute({
    method: 'get',
    path: '/globals/{slug}',
    tags: ['content'],
    summary: 'Get a global by slug',
    request: { params: SlugParam },
    responses: {
      200: {
        content: { 'application/json': { schema: GlobalResponse } },
        description: 'Global found',
      },
      404: {
        content: { 'application/json': { schema: NotFoundSchema } },
        description: 'Not found',
      },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const { slug } = c.req.valid('param');

    if (slug === 'header') {
      const row = await getGlobalHeader(db);
      if (!row) throw new HTTPException(404, { message: 'Global not found' });
      return c.json({ success: true as const, data: serializeHeader(row) }, 200);
    }
    if (slug === 'footer') {
      const row = await getGlobalFooter(db);
      if (!row) throw new HTTPException(404, { message: 'Global not found' });
      return c.json({ success: true as const, data: serializeFooter(row) }, 200);
    }
    if (slug === 'settings') {
      const row = await getGlobalSettings(db);
      if (!row) throw new HTTPException(404, { message: 'Global not found' });
      return c.json({ success: true as const, data: serializeSettings(row) }, 200);
    }
    throw new HTTPException(404, { message: 'Global not found' });
  },
);

// PATCH /globals/:slug  -  RBAC content:update enforced at the /api/content/* mount
app.openapi(
  createRoute({
    method: 'patch',
    path: '/globals/{slug}',
    tags: ['content'],
    summary: 'Update a global',
    request: {
      params: SlugParam,
      body: { content: { 'application/json': { schema: GlobalPatchBody } } },
    },
    responses: {
      200: {
        content: { 'application/json': { schema: GlobalResponse } },
        description: 'Global updated',
      },
      400: {
        content: { 'application/json': { schema: ValidationErrorSchema } },
        description: 'Validation failed',
      },
      404: {
        content: { 'application/json': { schema: NotFoundSchema } },
        description: 'Not found',
      },
    },
  }),
  async (c) => {
    const db = c.get('db');
    const { slug } = c.req.valid('param');
    const body = c.req.valid('json');

    if (!isGlobalSlug(slug)) {
      throw new HTTPException(404, { message: 'Global not found' });
    }

    if (slug === 'header') {
      const parsed = HeaderUpdateSchema.safeParse(body);
      if (!parsed.success) {
        return c.json(
          { success: false as const, errors: parsed.error.issues.map((i) => i.message) },
          400,
        );
      }
      const row = await updateGlobalHeader(db, parsed.data);
      return c.json({ success: true as const, data: serializeHeader(row) }, 200);
    }
    if (slug === 'footer') {
      const parsed = FooterUpdateSchema.safeParse(body);
      if (!parsed.success) {
        return c.json(
          { success: false as const, errors: parsed.error.issues.map((i) => i.message) },
          400,
        );
      }
      const row = await updateGlobalFooter(db, parsed.data);
      return c.json({ success: true as const, data: serializeFooter(row) }, 200);
    }
    const parsed = SettingsUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { success: false as const, errors: parsed.error.issues.map((i) => i.message) },
        400,
      );
    }
    const row = await updateGlobalSettings(db, parsed.data);
    return c.json({ success: true as const, data: serializeSettings(row) }, 200);
  },
);

export default app;
