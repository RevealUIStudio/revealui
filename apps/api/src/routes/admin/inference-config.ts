/**
 * Admin Inference Configuration Routes — Max-tier `aiInference` paywall.
 *
 * Per-site (workspace-level) LLM provider configuration. Distinct from
 * per-user BYOK in `tenant_provider_configs`:
 *
 *   - tenant_provider_configs (per-user): "Bob's preferred provider for
 *     Bob's agents"
 *   - workspace_inference_configs (per-site): "Site X is locked to Groq
 *     for governance/cost"
 *
 * Routes:
 *   GET    /admin/inference/config?workspaceId=...   — read config (or
 *                                                       system default)
 *   PUT    /admin/inference/config                    — upsert config
 *   DELETE /admin/inference/config?workspaceId=...    — revert to default
 *
 * Mount with `requireFeature('aiInference')` so Pro tier gets 403, Max+
 * gets through. See apps/api/src/index.ts for the gate wiring.
 */

import crypto from 'node:crypto';
import { getClient } from '@revealui/db';
import type { DatabaseClient } from '@revealui/db/client';
import { encryptApiKey, redactApiKey } from '@revealui/db/crypto';
import { workspaceInferenceConfigs } from '@revealui/db/schema';
import { createRoute, OpenAPIHono, z } from '@revealui/openapi';
import { eq } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';

// LLMProviderType narrowed to the post-vultr-removal set.
const ALLOWED_PROVIDERS = ['groq', 'huggingface', 'inference-snaps', 'ollama'] as const;
const KEYLESS_PROVIDERS = new Set(['inference-snaps', 'ollama']);

// System default returned when a site has no per-site row. Mirrors the
// zero-config default in `createLLMClientFromEnv()` (Inference Snaps on
// Ubuntu local).
const SYSTEM_DEFAULT = {
  provider: 'inference-snaps' as const,
  model: 'gemma3',
  baseURL: 'http://localhost:9090/v1',
  temperature: null,
  maxTokens: null,
  keyHint: null,
};

type AdminVariables = {
  db: DatabaseClient;
  user?: { id: string; role: string };
};

const ADMIN_ROLES = new Set(['admin', 'super-admin']);

function requireAdmin(user: { id: string; role: string } | undefined): void {
  if (!user) throw new HTTPException(401, { message: 'Authentication required' });
  if (!ADMIN_ROLES.has(user.role)) {
    throw new HTTPException(403, { message: 'Admin access required' });
  }
}

const ErrorSchema = z.object({ success: z.literal(false), error: z.string() });

const ConfigShape = z.object({
  workspaceId: z.string(),
  source: z.enum(['configured', 'default']),
  provider: z.enum(ALLOWED_PROVIDERS),
  model: z.string().nullable(),
  baseURL: z.string().nullable(),
  temperature: z.number().nullable(),
  maxTokens: z.number().nullable(),
  keyHint: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

const PutBody = z
  .object({
    workspaceId: z.string().min(1),
    provider: z.enum(ALLOWED_PROVIDERS),
    apiKey: z.string().min(1).max(4096).optional(),
    model: z.string().max(120).optional(),
    baseURL: z.string().url().optional(),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().int().positive().max(1_000_000).optional(),
  })
  .refine(
    (v) => KEYLESS_PROVIDERS.has(v.provider) || (v.apiKey !== undefined && v.apiKey.length > 0),
    {
      message: 'apiKey is required for cloud providers (groq, huggingface)',
      path: ['apiKey'],
    },
  )
  .refine((v) => !KEYLESS_PROVIDERS.has(v.provider) || v.apiKey === undefined, {
    message: 'apiKey must not be set for keyless providers (inference-snaps, ollama)',
    path: ['apiKey'],
  });

const app = new OpenAPIHono<{ Variables: AdminVariables }>();

// ─── helpers ──────────────────────────────────────────────────────────────

function generateId(): string {
  return `wic_${crypto.randomUUID().replace(/-/g, '')}`;
}

function rowToShape(row: typeof workspaceInferenceConfigs.$inferSelect) {
  return {
    workspaceId: row.workspaceId,
    source: 'configured' as const,
    provider: row.provider as (typeof ALLOWED_PROVIDERS)[number],
    model: row.model,
    baseURL: row.baseURL,
    temperature: row.temperature,
    maxTokens: row.maxTokens,
    keyHint: row.keyHint,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function defaultShape(workspaceId: string) {
  return {
    workspaceId,
    source: 'default' as const,
    ...SYSTEM_DEFAULT,
    createdAt: null,
    updatedAt: null,
  };
}

/**
 * Best-effort registry update — runs after DB write so a subsequent chat()
 * call uses the new config without restart. If `@revealui/ai` is not
 * installed (OSS-only deployments), skip silently.
 */
async function syncRegistry(
  workspaceId: string,
  provider: (typeof ALLOWED_PROVIDERS)[number],
  apiKey: string,
  model: string | null,
  baseURL: string | null,
  temperature: number | null,
  maxTokens: number | null,
): Promise<void> {
  const aiMod = await import('@revealui/ai/llm/server').catch(() => null);
  if (!aiMod || !aiMod.workspaceProviderRegistry) return;

  aiMod.workspaceProviderRegistry.set({
    workspaceId,
    provider,
    apiKey,
    model: model ?? undefined,
    baseURL: baseURL ?? undefined,
    temperature: temperature ?? undefined,
    maxTokens: maxTokens ?? undefined,
  });
}

async function clearRegistry(workspaceId: string): Promise<void> {
  const aiMod = await import('@revealui/ai/llm/server').catch(() => null);
  if (!aiMod || !aiMod.workspaceProviderRegistry) return;
  aiMod.workspaceProviderRegistry.delete(workspaceId);
}

// ─── GET /admin/inference/config ─────────────────────────────────────────

app.openapi(
  createRoute({
    method: 'get',
    path: '/',
    tags: ['admin', 'inference'],
    summary: 'Read per-site inference config (Max tier)',
    request: {
      query: z.object({
        workspaceId: z.string().min(1),
      }),
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), data: ConfigShape }),
          },
        },
        description: 'Config (per-site) or system default',
      },
      401: {
        content: { 'application/json': { schema: ErrorSchema } },
        description: 'Unauthorized',
      },
      403: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Forbidden' },
    },
  }),
  async (c) => {
    requireAdmin(c.get('user'));
    const { workspaceId } = c.req.valid('query');
    const db = c.get('db') ?? getClient();

    const [row] = await db
      .select()
      .from(workspaceInferenceConfigs)
      .where(eq(workspaceInferenceConfigs.workspaceId, workspaceId))
      .limit(1);

    return c.json({
      success: true as const,
      data: row ? rowToShape(row) : defaultShape(workspaceId),
    });
  },
);

// ─── PUT /admin/inference/config ─────────────────────────────────────────

app.openapi(
  createRoute({
    method: 'put',
    path: '/',
    tags: ['admin', 'inference'],
    summary: 'Upsert per-site inference config (Max tier)',
    request: { body: { content: { 'application/json': { schema: PutBody } } } },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), data: ConfigShape }),
          },
        },
        description: 'Config saved',
      },
      400: {
        content: { 'application/json': { schema: ErrorSchema } },
        description: 'Invalid body',
      },
      401: {
        content: { 'application/json': { schema: ErrorSchema } },
        description: 'Unauthorized',
      },
      403: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Forbidden' },
    },
  }),
  async (c) => {
    requireAdmin(c.get('user'));
    const body = c.req.valid('json');
    const { workspaceId, provider, apiKey, model, baseURL, temperature, maxTokens } = body;
    const db = c.get('db') ?? getClient();

    const isKeyless = KEYLESS_PROVIDERS.has(provider);
    const encryptedApiKey = !isKeyless && apiKey ? encryptApiKey(apiKey) : null;
    const keyHint = !isKeyless && apiKey ? redactApiKey(apiKey) : null;

    const [existing] = await db
      .select({ id: workspaceInferenceConfigs.id })
      .from(workspaceInferenceConfigs)
      .where(eq(workspaceInferenceConfigs.workspaceId, workspaceId))
      .limit(1);

    let row: typeof workspaceInferenceConfigs.$inferSelect;
    if (existing) {
      const [updated] = await db
        .update(workspaceInferenceConfigs)
        .set({
          provider,
          encryptedApiKey,
          keyHint,
          model: model ?? null,
          baseURL: baseURL ?? null,
          temperature: temperature ?? null,
          maxTokens: maxTokens ?? null,
        })
        .where(eq(workspaceInferenceConfigs.id, existing.id))
        .returning();
      if (!updated) throw new HTTPException(500, { message: 'Update returned no row' });
      row = updated;
    } else {
      const [inserted] = await db
        .insert(workspaceInferenceConfigs)
        .values({
          id: generateId(),
          workspaceId,
          provider,
          encryptedApiKey,
          keyHint,
          model: model ?? null,
          baseURL: baseURL ?? null,
          temperature: temperature ?? null,
          maxTokens: maxTokens ?? null,
        })
        .returning();
      if (!inserted) throw new HTTPException(500, { message: 'Insert returned no row' });
      row = inserted;
    }

    // Best-effort: hydrate the in-memory registry so subsequent chat() calls
    // use the new config without restart. Keyless providers pass the
    // provider name as the placeholder API key (matches createLLMClientFromEnv).
    const registryKey = isKeyless ? provider : (apiKey as string);
    await syncRegistry(
      workspaceId,
      provider,
      registryKey,
      model ?? null,
      baseURL ?? null,
      temperature ?? null,
      maxTokens ?? null,
    );

    return c.json({ success: true as const, data: rowToShape(row) });
  },
);

// ─── DELETE /admin/inference/config ──────────────────────────────────────

app.openapi(
  createRoute({
    method: 'delete',
    path: '/',
    tags: ['admin', 'inference'],
    summary: 'Revert site to system default inference (Max tier)',
    request: {
      query: z.object({
        workspaceId: z.string().min(1),
      }),
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.literal(true), data: ConfigShape }),
          },
        },
        description: 'Config deleted; default returned',
      },
      401: {
        content: { 'application/json': { schema: ErrorSchema } },
        description: 'Unauthorized',
      },
      403: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Forbidden' },
    },
  }),
  async (c) => {
    requireAdmin(c.get('user'));
    const { workspaceId } = c.req.valid('query');
    const db = c.get('db') ?? getClient();

    await db
      .delete(workspaceInferenceConfigs)
      .where(eq(workspaceInferenceConfigs.workspaceId, workspaceId));

    await clearRegistry(workspaceId);

    return c.json({ success: true as const, data: defaultShape(workspaceId) });
  },
);

export default app;
