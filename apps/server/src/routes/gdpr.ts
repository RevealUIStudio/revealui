import { deleteAllUserSessions } from '@revealui/auth/server';
import { logger } from '@revealui/core/observability/logger';
import {
  type ConsentType,
  createConsentManager,
  createDataBreachManager,
  createDataDeletionSystem,
} from '@revealui/core/security';
import { getClient } from '@revealui/db';
import { anonymizeUser } from '@revealui/db/queries/users';
import { createRoute, OpenAPIHono, z } from '@revealui/openapi';
import { HTTPException } from 'hono/http-exception';
import { DrizzleBreachStorage, DrizzleGDPRStorage } from '../lib/drizzle-gdpr-storage.js';

interface UserContext {
  id: string;
  email: string | null;
  name: string;
  role: string;
}

// Database-backed storage  -  persists consent, deletion, and breach records to PostgreSQL.
const gdprStorage = new DrizzleGDPRStorage();
const breachStorage = new DrizzleBreachStorage();
const consentManager = createConsentManager(gdprStorage);
const deletionSystem = createDataDeletionSystem(gdprStorage);
// Breach manager must be created to register storage  -  not referenced after initialization
void createDataBreachManager(breachStorage);

const CONSENT_TYPES: ConsentType[] = [
  'necessary',
  'functional',
  'analytics',
  'marketing',
  'personalization',
];

const consentTypeEnum = z.enum([
  'necessary',
  'functional',
  'analytics',
  'marketing',
  'personalization',
]);

const consentGrantSchema = z.object({
  type: consentTypeEnum,
  expiresIn: z.number().int().positive().optional(),
});

const consentRevokeSchema = z.object({
  type: consentTypeEnum,
});

const deletionRequestSchema = z.object({
  categories: z
    .array(z.enum(['personal', 'sensitive', 'financial', 'health', 'behavioral']))
    .optional(),
  reason: z.string().max(1000).optional(),
});

const errorResponse = (description: string) => ({
  content: {
    'application/json': {
      schema: z.object({
        success: z.boolean().openapi({ example: false }),
        error: z.string(),
      }),
    },
  },
  description,
});

const app = new OpenAPIHono<{ Variables: { user: UserContext | undefined } }>();

// ---------------------------------------------------------------------------
// Consent Management
// ---------------------------------------------------------------------------

/**
 * GET /gdpr/consent  -  List all consents for the authenticated user.
 */
app.openapi(
  createRoute({
    method: 'get',
    path: '/consent',
    tags: ['gdpr'],
    summary: 'List all consents for the authenticated user',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
              consents: z.array(z.unknown()),
            }),
          },
        },
        description: 'List of user consents',
      },
      401: errorResponse('Authentication required'),
    },
  }),
  // @ts-expect-error -- OpenAPI response union narrowing
  async (c) => {
    const user = c.get('user');
    if (!user) {
      throw new HTTPException(401, { message: 'Authentication required' });
    }

    const consents = await consentManager.getUserConsents(user.id);

    return c.json({ success: true, consents });
  },
);

/**
 * POST /gdpr/consent/grant  -  Grant consent for a specific type.
 *
 * Body: { type: ConsentType, expiresIn?: number }
 */
app.openapi(
  createRoute({
    method: 'post',
    path: '/consent/grant',
    tags: ['gdpr'],
    summary: 'Grant consent for a specific type',
    request: {
      body: {
        content: {
          'application/json': {
            schema: consentGrantSchema,
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
              consent: z.unknown(),
            }),
          },
        },
        description: 'Consent granted',
      },
      400: errorResponse('Invalid request body'),
      401: errorResponse('Authentication required'),
    },
  }),
  // @ts-expect-error -- OpenAPI response union narrowing
  async (c) => {
    const user = c.get('user');
    if (!user) {
      throw new HTTPException(401, { message: 'Authentication required' });
    }

    const body = c.req.valid('json');

    const consent = await consentManager.grantConsent(
      user.id,
      body.type,
      'explicit',
      body.expiresIn,
    );

    logger.info('Consent granted', { userId: user.id, type: body.type });

    return c.json({ success: true, consent });
  },
);

/**
 * POST /gdpr/consent/revoke  -  Revoke consent for a specific type.
 *
 * Body: { type: ConsentType }
 */
app.openapi(
  createRoute({
    method: 'post',
    path: '/consent/revoke',
    tags: ['gdpr'],
    summary: 'Revoke consent for a specific type',
    request: {
      body: {
        content: {
          'application/json': {
            schema: consentRevokeSchema,
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
            }),
          },
        },
        description: 'Consent revoked',
      },
      400: errorResponse('Invalid request or cannot revoke necessary consent'),
      401: errorResponse('Authentication required'),
    },
  }),
  // @ts-expect-error -- OpenAPI response union narrowing
  async (c) => {
    const user = c.get('user');
    if (!user) {
      throw new HTTPException(401, { message: 'Authentication required' });
    }

    const body = c.req.valid('json');

    if (body.type === 'necessary') {
      throw new HTTPException(400, {
        message: 'Cannot revoke necessary consent  -  it is required for service operation',
      });
    }

    await consentManager.revokeConsent(user.id, body.type);

    logger.info('Consent revoked', { userId: user.id, type: body.type });

    return c.json({ success: true });
  },
);

/**
 * GET /gdpr/consent/check/:type  -  Check if a specific consent is active.
 */
app.openapi(
  createRoute({
    method: 'get',
    path: '/consent/check/{type}',
    tags: ['gdpr'],
    summary: 'Check if a specific consent type is active',
    request: {
      params: z.object({
        type: consentTypeEnum.openapi({
          param: { name: 'type', in: 'path' },
          example: 'analytics',
        }),
      }),
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
              type: z.string(),
              granted: z.boolean(),
            }),
          },
        },
        description: 'Consent check result',
      },
      400: errorResponse('Invalid consent type'),
      401: errorResponse('Authentication required'),
    },
  }),
  // @ts-expect-error -- OpenAPI response union narrowing
  async (c) => {
    const user = c.get('user');
    if (!user) {
      throw new HTTPException(401, { message: 'Authentication required' });
    }

    const { type } = c.req.valid('param');
    if (!CONSENT_TYPES.includes(type as ConsentType)) {
      throw new HTTPException(400, {
        message: `Invalid consent type. Must be one of: ${CONSENT_TYPES.join(', ')}`,
      });
    }

    const granted = await consentManager.hasConsent(user.id, type as ConsentType);

    return c.json({ success: true, type, granted });
  },
);

// ---------------------------------------------------------------------------
// Deletion Requests
// ---------------------------------------------------------------------------

/**
 * POST /gdpr/deletion  -  Request data deletion (right to be forgotten).
 *
 * Body: { categories?: ('personal'|'sensitive'|'financial'|'health'|'behavioral')[], reason?: string }
 */
app.openapi(
  createRoute({
    method: 'post',
    path: '/deletion',
    tags: ['gdpr'],
    summary: 'Request data deletion (right to be forgotten)',
    request: {
      body: {
        content: {
          'application/json': {
            schema: deletionRequestSchema,
          },
        },
      },
    },
    responses: {
      201: {
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
              request: z.unknown(),
            }),
          },
        },
        description: 'Deletion request created',
      },
      400: errorResponse('Invalid request body'),
      401: errorResponse('Authentication required'),
    },
  }),
  async (c) => {
    const user = c.get('user');
    if (!user) {
      throw new HTTPException(401, { message: 'Authentication required' });
    }

    const body = c.req.valid('json');

    const request = await deletionSystem.requestDeletion(
      user.id,
      body.categories ?? ['personal'],
      body.reason,
    );

    logger.info('Deletion request created', { userId: user.id, requestId: request.id });

    // Process the deletion immediately  -  anonymize PII and revoke sessions
    await deletionSystem.processDeletion(request.id, async (userId, categories) => {
      const db = getClient();
      const anonymized = await anonymizeUser(db, userId);
      if (!anonymized) {
        throw new Error(`User ${userId} not found for anonymization`);
      }

      await deleteAllUserSessions(userId);

      logger.info('GDPR deletion processed', {
        userId,
        requestId: request.id,
        categories,
      });

      return {
        deleted: ['profile', 'email', 'avatar', 'mfa', 'sessions', 'preferences'],
        retained: ['billing_records', 'audit_logs'],
      };
    });

    const processed = await deletionSystem.getRequest(request.id);

    return c.json({ success: true, request: processed ?? request }, 201);
  },
);

/**
 * GET /gdpr/deletion  -  List the authenticated user's deletion requests.
 */
app.openapi(
  createRoute({
    method: 'get',
    path: '/deletion',
    tags: ['gdpr'],
    summary: "List the authenticated user's deletion requests",
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
              requests: z.array(z.unknown()),
            }),
          },
        },
        description: 'List of deletion requests',
      },
      401: errorResponse('Authentication required'),
    },
  }),
  // @ts-expect-error -- OpenAPI response union narrowing
  async (c) => {
    const user = c.get('user');
    if (!user) {
      throw new HTTPException(401, { message: 'Authentication required' });
    }

    const requests = await deletionSystem.getUserRequests(user.id);

    return c.json({ success: true, requests });
  },
);

/**
 * GET /gdpr/deletion/:id  -  Get a specific deletion request by ID.
 */
app.openapi(
  createRoute({
    method: 'get',
    path: '/deletion/{id}',
    tags: ['gdpr'],
    summary: 'Get a specific deletion request by ID',
    request: {
      params: z.object({
        id: z.string().openapi({ param: { name: 'id', in: 'path' }, example: 'req_abc123' }),
      }),
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
              request: z.unknown(),
            }),
          },
        },
        description: 'Deletion request details',
      },
      401: errorResponse('Authentication required'),
      404: errorResponse('Deletion request not found'),
    },
  }),
  // @ts-expect-error -- OpenAPI response union narrowing
  async (c) => {
    const user = c.get('user');
    if (!user) {
      throw new HTTPException(401, { message: 'Authentication required' });
    }

    const { id } = c.req.valid('param');
    const request = await deletionSystem.getRequest(id);

    if (!request || request.userId !== user.id) {
      throw new HTTPException(404, { message: 'Deletion request not found' });
    }

    return c.json({ success: true, request });
  },
);

// ---------------------------------------------------------------------------
// Admin  -  Consent Statistics
// ---------------------------------------------------------------------------

/**
 * GET /gdpr/admin/stats  -  Aggregate consent statistics (admin only).
 */
app.openapi(
  createRoute({
    method: 'get',
    path: '/admin/stats',
    tags: ['gdpr'],
    summary: 'Aggregate consent statistics (admin only)',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              success: z.boolean(),
              stats: z.unknown(),
            }),
          },
        },
        description: 'Consent statistics',
      },
      403: errorResponse('Admin access required'),
    },
  }),
  // @ts-expect-error -- OpenAPI response union narrowing
  async (c) => {
    const user = c.get('user');
    if (!user || user.role !== 'admin') {
      throw new HTTPException(403, { message: 'Admin access required' });
    }

    const stats = await consentManager.getStatistics();

    return c.json({ success: true, stats });
  },
);

export default app;
