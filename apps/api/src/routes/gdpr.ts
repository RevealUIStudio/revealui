import { logger } from '@revealui/core/observability/logger';
import {
  type ConsentType,
  createConsentManager,
  createDataDeletionSystem,
  type DataCategory,
} from '@revealui/core/security';
import { Hono } from 'hono';
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

  const body = await c.req.json<{ type?: string; expiresIn?: number }>();

  if (!(body.type && CONSENT_TYPES.includes(body.type as ConsentType))) {
    return c.json(
      {
        success: false,
        error: `Invalid consent type. Must be one of: ${CONSENT_TYPES.join(', ')}`,
      },
      400,
    );
  }

  const consent = await consentManager.grantConsent(
    user.id,
    body.type as ConsentType,
    'explicit',
    body.expiresIn,
  );

  logger.info('Consent granted', { userId: user.id, type: body.type });

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

  const body = await c.req.json<{ type?: string }>();

  if (!(body.type && CONSENT_TYPES.includes(body.type as ConsentType))) {
    return c.json(
      {
        success: false,
        error: `Invalid consent type. Must be one of: ${CONSENT_TYPES.join(', ')}`,
      },
      400,
    );
  }

  if (body.type === 'necessary') {
    return c.json(
      {
        success: false,
        error: 'Cannot revoke necessary consent — it is required for service operation',
      },
      400,
    );
  }

  await consentManager.revokeConsent(user.id, body.type as ConsentType);

  logger.info('Consent revoked', { userId: user.id, type: body.type });

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
 * Body: { categories?: DataCategory[], reason?: string }
 */
app.post('/deletion', async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, error: 'Authentication required' }, 401);
  }

  const body = await c.req.json<{ categories?: string[]; reason?: string }>();

  const request = await deletionSystem.requestDeletion(
    user.id,
    (body.categories as DataCategory[]) ?? ['personal'],
    body.reason,
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
