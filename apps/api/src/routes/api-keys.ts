/**
 * BYOK API Key Routes — Encrypted credential storage for Bring Your Own Key
 *
 * POST   /api/api-keys          — Store a new API key (encrypted at rest)
 * GET    /api/api-keys          — List the authenticated user's keys (hints only)
 * DELETE /api/api-keys/:id      — Delete a stored key
 * POST   /api/api-keys/:id/rotate — Replace the plaintext for an existing key slot
 *
 * Requires: authenticated user session (authMiddleware)
 * Feature gate: available at all tiers (BYOK is a free feature per MASTER_PLAN)
 */

import crypto from 'node:crypto';
import { LLM_PROVIDERS } from '@revealui/contracts';
import { getClient } from '@revealui/db';
import { encryptApiKey, redactApiKey } from '@revealui/db/crypto';
import { tenantProviderConfigs, userApiKeys } from '@revealui/db/schema';
import { createRoute, OpenAPIHono, z } from '@revealui/openapi';
import { and, eq } from 'drizzle-orm';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';

const ALLOWED_PROVIDERS = LLM_PROVIDERS;

interface UserContext {
  id: string;
  email: string | null;
  name: string;
  role: string;
}

const app = new OpenAPIHono<{ Variables: { user: UserContext | undefined } }>();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function requireUser(c: Context): UserContext {
  const user = c.get('user') as UserContext | undefined;
  if (!user) throw new HTTPException(401, { message: 'Authentication required' });
  return user;
}

function generateId(): string {
  return `key_${crypto.randomUUID().replace(/-/g, '')}`;
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const CreateKeySchema = z.object({
  provider: z.enum(ALLOWED_PROVIDERS).openapi({
    description: 'LLM provider for this key',
    example: 'anthropic',
  }),
  apiKey: z.string().min(8).openapi({
    description: 'The plaintext API key (never stored; encrypted before persisting)',
    example: 'sk-ant-api03-...',
  }),
  label: z.string().max(80).optional().openapi({
    description: 'Optional user-visible label for this key',
    example: 'My Anthropic key',
  }),
  setAsDefault: z.boolean().optional().openapi({
    description: "Set this provider as the default for the user's agents",
    example: true,
  }),
  model: z.string().optional().openapi({
    description: 'Preferred model for the default provider config',
    example: 'claude-sonnet-4-6',
  }),
});

const KeySummarySchema = z.object({
  id: z.string(),
  provider: z.string(),
  keyHint: z.string().nullable(),
  label: z.string().nullable(),
  createdAt: z.string(),
  lastUsedAt: z.string().nullable(),
});

const RotateKeySchema = z.object({
  apiKey: z.string().min(8).openapi({
    description: 'The new plaintext API key',
  }),
});

// ─── Routes ───────────────────────────────────────────────────────────────────

const postRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['BYOK'],
  summary: 'Store an encrypted API key',
  request: { body: { content: { 'application/json': { schema: CreateKeySchema } } } },
  responses: {
    201: {
      description: 'Key stored successfully',
      content: {
        'application/json': {
          schema: z.object({ id: z.string(), keyHint: z.string().nullable() }),
        },
      },
    },
  },
});

app.openapi(postRoute, async (c) => {
  const user = requireUser(c);
  const body = await c.req.json<z.infer<typeof CreateKeySchema>>();
  const parsed = CreateKeySchema.safeParse(body);
  if (!parsed.success) throw new HTTPException(400, { message: 'Invalid request body' });

  const { provider, apiKey, label, setAsDefault, model } = parsed.data;

  // Validate the key against the provider before storing (best-effort; network
  // failures are treated as valid so outages don't block key storage).
  const keyValidatorMod = await import('@revealui/ai/llm/key-validator').catch(() => null);
  if (keyValidatorMod) {
    const validation = await keyValidatorMod.validateProviderKey(provider, apiKey);
    if (!validation.valid) {
      throw new HTTPException(400, { message: validation.error });
    }
  }
  // If @revealui/ai is not installed, skip validation — key will be stored without provider check

  const db = getClient();
  const id = generateId();
  const encrypted = encryptApiKey(apiKey);
  const keyHint = redactApiKey(apiKey);

  await db.insert(userApiKeys).values({
    id,
    userId: user.id,
    provider,
    encryptedKey: encrypted,
    keyHint,
    label: label ?? null,
  });

  // Optionally set/update the default provider config for this user
  if (setAsDefault) {
    // Clear existing default for this provider
    await db
      .update(tenantProviderConfigs)
      .set({ isDefault: false })
      .where(
        and(
          eq(tenantProviderConfigs.userId, user.id),
          eq(tenantProviderConfigs.provider, provider),
        ),
      );

    // Upsert via insert + on-conflict (simple delete+insert approach for portability)
    const existingConfig = await db
      .select({ id: tenantProviderConfigs.id })
      .from(tenantProviderConfigs)
      .where(
        and(
          eq(tenantProviderConfigs.userId, user.id),
          eq(tenantProviderConfigs.provider, provider),
        ),
      )
      .limit(1);

    if (existingConfig.length > 0 && existingConfig[0]) {
      await db
        .update(tenantProviderConfigs)
        .set({ isDefault: true, model: model ?? null })
        .where(eq(tenantProviderConfigs.id, existingConfig[0].id));
    } else {
      await db.insert(tenantProviderConfigs).values({
        id: `cfg_${crypto.randomUUID()}`,
        userId: user.id,
        provider,
        isDefault: true,
        model: model ?? null,
      });
    }
  }

  return c.json({ id, keyHint }, 201);
});

// ─── GET /api/api-keys ────────────────────────────────────────────────────────

const listRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['BYOK'],
  summary: 'List stored API keys (hints only, never plaintext)',
  responses: {
    200: {
      description: 'List of key summaries',
      content: { 'application/json': { schema: z.object({ keys: z.array(KeySummarySchema) }) } },
    },
  },
});

app.openapi(listRoute, async (c) => {
  const user = requireUser(c);
  const db = getClient();

  const rows = await db
    .select({
      id: userApiKeys.id,
      provider: userApiKeys.provider,
      keyHint: userApiKeys.keyHint,
      label: userApiKeys.label,
      createdAt: userApiKeys.createdAt,
      lastUsedAt: userApiKeys.lastUsedAt,
    })
    .from(userApiKeys)
    .where(eq(userApiKeys.userId, user.id));

  return c.json({
    keys: rows.map((r) => ({
      id: r.id,
      provider: r.provider,
      keyHint: r.keyHint,
      label: r.label,
      createdAt: r.createdAt.toISOString(),
      lastUsedAt: r.lastUsedAt?.toISOString() ?? null,
    })),
  });
});

// ─── DELETE /api/api-keys/:id ────────────────────────────────────────────────

const deleteRoute = createRoute({
  method: 'delete',
  path: '/:id',
  tags: ['BYOK'],
  summary: 'Delete a stored API key',
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: 'Key deleted',
      content: { 'application/json': { schema: z.object({ deleted: z.boolean() }) } },
    },
    404: { description: 'Key not found' },
  },
});

app.openapi(deleteRoute, async (c) => {
  const user = requireUser(c);
  const { id } = c.req.param();
  const db = getClient();

  const [existing] = await db
    .select({ id: userApiKeys.id })
    .from(userApiKeys)
    .where(and(eq(userApiKeys.id, id), eq(userApiKeys.userId, user.id)));

  if (!existing) throw new HTTPException(404, { message: 'API key not found' });

  await db.delete(userApiKeys).where(and(eq(userApiKeys.id, id), eq(userApiKeys.userId, user.id)));

  return c.json({ deleted: true });
});

// ─── POST /api/api-keys/:id/rotate ───────────────────────────────────────────

const rotateRoute = createRoute({
  method: 'post',
  path: '/:id/rotate',
  tags: ['BYOK'],
  summary: 'Replace the plaintext for an existing API key slot',
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { 'application/json': { schema: RotateKeySchema } } },
  },
  responses: {
    200: {
      description: 'Key rotated',
      content: {
        'application/json': {
          schema: z.object({ id: z.string(), keyHint: z.string().nullable() }),
        },
      },
    },
    404: { description: 'Key not found' },
  },
});

app.openapi(rotateRoute, async (c) => {
  const user = requireUser(c);
  const { id } = c.req.param();
  const body = await c.req.json<z.infer<typeof RotateKeySchema>>();
  const parsed = RotateKeySchema.safeParse(body);
  if (!parsed.success) throw new HTTPException(400, { message: 'Invalid request body' });

  const db = getClient();

  const [existing] = await db
    .select({ id: userApiKeys.id })
    .from(userApiKeys)
    .where(and(eq(userApiKeys.id, id), eq(userApiKeys.userId, user.id)));

  if (!existing) throw new HTTPException(404, { message: 'API key not found' });

  const encrypted = encryptApiKey(parsed.data.apiKey);
  const keyHint = redactApiKey(parsed.data.apiKey);

  await db
    .update(userApiKeys)
    .set({ encryptedKey: encrypted, keyHint, updatedAt: new Date() })
    .where(eq(userApiKeys.id, id));

  return c.json({ id, keyHint });
});

export default app;
