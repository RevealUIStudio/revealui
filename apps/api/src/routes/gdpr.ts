import { logger } from '@revealui/core/observability/logger';
import {
  type ConsentType,
  createConsentManager,
  createDataDeletionSystem,
} from '@revealui/core/security';
import { Hono } from 'hono';
import { z } from 'zod';
import { DrizzleGDPRStorage } from '../lib/drizzle-gdpr-storage.js';

interface UserContext {
  id: string;
  email: string | null;
  name: string;
  role: string;
}

// Database-backed storage — persists consent records and deletion requests to PostgreSQL.
const gdprStorage = new DrizzleGDPRStorage();
const consentManager = createConsentManager(gdprStorage);
const deletionSystem = createDataDeletionSystem(gdprStorage);

const CONSENT_TYPES: ConsentType[] = [
  'necessary',
  'functional',
  'analytics',
  'marketing',
  'personalization',
];

const consentGrantSchema = z.object({
  type: z.enum(['necessary', 'functional', 'analytics', 'marketing', 'personalization']),
  expiresIn: z.number().int().positive().optional(),
});

const consentRevokeSchema = z.object({
  type: z.enum(['necessary', 'functional', 'analytics', 'marketing', 'personalization']),
});

const deletionRequestSchema = z.object({
  categories: z
    .array(z.enum(['personal', 'sensitive', 'financial', 'health', 'behavioral']))
    .optional(),
  reason: z.string().max(1000).optional(),
});

// biome-ignore lint/style/useNamingConvention: Hono requires PascalCase `Variables` in its generic type parameter
const app = new Hono<{ Variables: { user: UserContext | undefined } }>();

// ---------------------------------------------------------------------------
// Consent Management
// ---------------------------------------------------------------------------

/**
 * GET /gdpr/consent — List all consents for the authenticated user.
 */
app.get('/consent', async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, error: 'Authentication required' }, 401);
  }

  const consents = await consentManager.getUserConsents(user.id);

  return c.json({ success: true, consents });
});

/**
 * POST /gdpr/consent/grant — Grant consent for a specific type.
 *
 * Body: { type: ConsentType, expiresIn?: number }
 */
app.post('/consent/grant', async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, error: 'Authentication required' }, 401);
  }

  const result = consentGrantSchema.safeParse(await c.req.json());
  if (!result.success) {
    return c.json(
      {
        success: false,
        error: `Invalid request body: ${result.error.issues.map((i) => i.message).join(', ')}`,
      },
      400,
    );
  }

  const consent = await consentManager.grantConsent(
    user.id,
    result.data.type,
    'explicit',
    result.data.expiresIn,
  );

  logger.info('Consent granted', { userId: user.id, type: result.data.type });

  return c.json({ success: true, consent });
});

/**
 * POST /gdpr/consent/revoke — Revoke consent for a specific type.
 *
 * Body: { type: ConsentType }
 */
app.post('/consent/revoke', async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, error: 'Authentication required' }, 401);
  }

  const result = consentRevokeSchema.safeParse(await c.req.json());
  if (!result.success) {
    return c.json(
      {
        success: false,
        error: `Invalid request body: ${result.error.issues.map((i) => i.message).join(', ')}`,
      },
      400,
    );
  }

  if (result.data.type === 'necessary') {
    return c.json(
      {
        success: false,
        error: 'Cannot revoke necessary consent — it is required for service operation',
      },
      400,
    );
  }

  await consentManager.revokeConsent(user.id, result.data.type);

  logger.info('Consent revoked', { userId: user.id, type: result.data.type });

  return c.json({ success: true });
});

/**
 * GET /gdpr/consent/check/:type — Check if a specific consent is active.
 */
app.get('/consent/check/:type', async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, error: 'Authentication required' }, 401);
  }

  const type = c.req.param('type');
  if (!CONSENT_TYPES.includes(type as ConsentType)) {
    return c.json(
      {
        success: false,
        error: `Invalid consent type. Must be one of: ${CONSENT_TYPES.join(', ')}`,
      },
      400,
    );
  }

  const granted = await consentManager.hasConsent(user.id, type as ConsentType);

  return c.json({ success: true, type, granted });
});

// ---------------------------------------------------------------------------
// Deletion Requests
// ---------------------------------------------------------------------------

/**
 * POST /gdpr/deletion — Request data deletion (right to be forgotten).
 *
 * Body: { categories?: ('personal'|'sensitive'|'financial'|'health'|'behavioral')[], reason?: string }
 */
app.post('/deletion', async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, error: 'Authentication required' }, 401);
  }

  const result = deletionRequestSchema.safeParse(await c.req.json());
  if (!result.success) {
    return c.json(
      {
        success: false,
        error: `Invalid request body: ${result.error.issues.map((i) => i.message).join(', ')}`,
      },
      400,
    );
  }

  const request = await deletionSystem.requestDeletion(
    user.id,
    result.data.categories ?? ['personal'],
    result.data.reason,
  );

  logger.info('Deletion request created', { userId: user.id, requestId: request.id });

  return c.json({ success: true, request }, 201);
});

/**
 * GET /gdpr/deletion — List the authenticated user's deletion requests.
 */
app.get('/deletion', async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, error: 'Authentication required' }, 401);
  }

  const requests = await deletionSystem.getUserRequests(user.id);

  return c.json({ success: true, requests });
});

/**
 * GET /gdpr/deletion/:id — Get a specific deletion request by ID.
 */
app.get('/deletion/:id', async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, error: 'Authentication required' }, 401);
  }

  const request = await deletionSystem.getRequest(c.req.param('id'));

  if (!request || request.userId !== user.id) {
    return c.json({ success: false, error: 'Deletion request not found' }, 404);
  }

  return c.json({ success: true, request });
});

// ---------------------------------------------------------------------------
// Admin — Consent Statistics
// ---------------------------------------------------------------------------

/**
 * GET /gdpr/admin/stats — Aggregate consent statistics (admin only).
 */
app.get('/admin/stats', async (c) => {
  const user = c.get('user');
  if (!user || user.role !== 'admin') {
    return c.json({ success: false, error: 'Admin access required' }, 403);
  }

  const stats = await consentManager.getStatistics();

  return c.json({ success: true, stats });
});

export default app;
