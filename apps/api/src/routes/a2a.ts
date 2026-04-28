/**
 * A2A (Agent-to-Agent) Protocol Routes
 *
 * Implements the Google A2A specification over HTTP/JSON-RPC 2.0.
 *
 * Well-known discovery:
 *   GET /.well-known/agent.json           -  platform-level agent card
 *   GET /.well-known/agents/:id/agent.json  -  per-agent card
 *
 * A2A task API:
 *   POST /a2a                             -  JSON-RPC dispatcher (tasks/send, tasks/get, tasks/cancel)
 *   GET  /a2a/agents                      -  list all registered agents as A2A cards
 *   GET  /a2a/agents/:id                  -  single agent card
 *   GET  /a2a/stream/:taskId              -  SSE stream for a running task
 *
 * Task execution (tasks/send, tasks/sendSubscribe) is gated behind the 'ai' feature flag.
 * Discovery endpoints (agent.json, /a2a/agents) are public  -  no auth required.
 */

import type { A2AJsonRpcRequest } from '@revealui/contracts';
import { A2AJsonRpcRequestSchema, AgentDefinitionSchema } from '@revealui/contracts';
import { logger } from '@revealui/core/observability/logger';
import { getClient } from '@revealui/db';
import { agentActions, marketplaceServers, registeredAgents } from '@revealui/db/schema';
import { createRoute, OpenAPIHono, z } from '@revealui/openapi';
import { desc, eq } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth.js';
import { requireFeature } from '../middleware/license.js';
import { requireTaskQuota } from '../middleware/task-quota.js';
import {
  buildPaymentMethods,
  buildPaymentRequired,
  encodePaymentRequired,
  verifyPayment,
} from '../middleware/x402.js';

// JSON-RPC error codes (inlined  -  avoids static import of @revealui/ai)
const RPC_INVALID_REQUEST = -32600;

// Lazy-loaded @revealui/ai module  -  cached after first successful import
let aiModulePromise: Promise<typeof import('@revealui/ai') | null> | null = null;

function getAiModule(): Promise<typeof import('@revealui/ai') | null> {
  if (!aiModulePromise) {
    aiModulePromise = import('@revealui/ai').catch(() => null);
  }
  return aiModulePromise;
}

interface UserContext {
  id: string;
  email: string | null;
  name: string;
  role: string;
}

const app = new OpenAPIHono();

// Base URL for generating agent card URLs
// x-forwarded-proto is set by Vercel's edge when TLS is terminated at the proxy
function getBaseUrl(req: Request): string {
  const url = new URL(req.url);
  const proto = req.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '');
  return `${proto}://${url.host}`;
}

/** Validate agent ID: 1-256 word characters or hyphens */
function isValidAgentId(id: string): boolean {
  if (id.length < 1 || id.length > 256) return false;
  for (const ch of id) {
    const c = ch.charCodeAt(0);
    const isAlpha = (c >= 65 && c <= 90) || (c >= 97 && c <= 122);
    const isDigit = c >= 48 && c <= 57;
    if (!(isAlpha || isDigit || c === 95 || c === 45)) return false; // _ or -
  }
  return true;
}

// LLM client is resolved from environment configuration (open models only).
// No per-request API key injection  -  all inference uses server-configured providers.

// =============================================================================
// Well-known discovery endpoints (public, no auth)
// =============================================================================

/** Platform-level agent card */
app.openapi(
  createRoute({
    method: 'get',
    path: '/agent.json',
    tags: ['a2a'],
    summary: 'Platform-level agent card',
    responses: {
      200: {
        content: { 'application/json': { schema: z.unknown() } },
        description: 'Agent card',
      },
      404: {
        content: { 'application/json': { schema: z.unknown() } },
        description: 'Agent not found',
      },
      403: {
        content: { 'application/json': { schema: z.unknown() } },
        description: 'AI feature requires Pro or Enterprise license',
      },
    },
  }),
  async (c) => {
    const aiMod = await getAiModule();
    if (!aiMod) {
      return c.json(
        {
          error:
            "Feature 'ai' requires a Pro or Enterprise license. Upgrade at https://revealui.com/pricing",
        },
        403,
      );
    }
    const baseUrl = getBaseUrl(c.req.raw);
    const card = aiMod.agentCardRegistry.getCard('revealui-creator', baseUrl);
    if (!card) {
      return c.json({ error: 'Agent not found' }, 404);
    }
    return c.json(card, 200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300',
    });
  },
);

/** Per-agent card at /.well-known/agents/:id/agent.json */
app.openapi(
  createRoute({
    method: 'get',
    path: '/agents/{id}/agent.json',
    tags: ['a2a'],
    summary: 'Per-agent discovery card',
    request: {
      params: z.object({
        id: z.string().openapi({ description: 'Agent ID' }),
      }),
    },
    responses: {
      200: {
        content: { 'application/json': { schema: z.unknown() } },
        description: 'Agent card',
      },
      400: {
        content: { 'application/json': { schema: z.unknown() } },
        description: 'Invalid agent ID format',
      },
      404: {
        content: { 'application/json': { schema: z.unknown() } },
        description: 'Agent not found',
      },
      403: {
        content: { 'application/json': { schema: z.unknown() } },
        description: 'AI feature requires Pro or Enterprise license',
      },
    },
  }),
  async (c) => {
    const aiMod = await getAiModule();
    if (!aiMod) {
      return c.json(
        {
          error:
            "Feature 'ai' requires a Pro or Enterprise license. Upgrade at https://revealui.com/pricing",
        },
        403,
      );
    }
    const { id: agentId } = c.req.valid('param');
    if (!isValidAgentId(agentId)) {
      return c.json({ error: 'Invalid agent ID format' }, 400);
    }
    const baseUrl = getBaseUrl(c.req.raw);
    const card = aiMod.agentCardRegistry.getCard(agentId, baseUrl);
    if (!card) {
      return c.json({ error: `Agent '${agentId}' not found` }, 404);
    }
    return c.json(card, 200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300',
    });
  },
);

/**
 * MCP Marketplace discovery (Phase 5.5).
 * GET /.well-known/marketplace.json
 *
 * Returns marketplace metadata and the registry URL for agent discovery.
 * Includes a lightweight summary of active servers for quick enumeration.
 */
app.openapi(
  createRoute({
    method: 'get',
    path: '/marketplace.json',
    tags: ['a2a'],
    summary: 'MCP Marketplace discovery metadata',
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              version: z.string(),
              platform: z.string(),
              registryUrl: z.string(),
              publishUrl: z.string(),
              revenueShare: z.object({ platform: z.number(), developer: z.number() }),
              paymentMethods: z.array(z.string()),
              servers: z.array(
                z.object({
                  id: z.string(),
                  name: z.string(),
                  description: z.string(),
                  category: z.string(),
                  pricePerCallUsdc: z.string(),
                  invokeUrl: z.string(),
                }),
              ),
            }),
          },
        },
        description: 'Marketplace metadata',
      },
    },
  }),
  async (c) => {
    const baseUrl = getBaseUrl(c.req.raw);

    // Fetch active server summaries (name, category, price only  -  not internal URLs)
    let servers: Array<{
      id: string;
      name: string;
      description: string;
      category: string;
      pricePerCallUsdc: string;
      invokeUrl: string;
    }> = [];
    try {
      const db = getClient();
      const rows = await db
        .select({
          id: marketplaceServers.id,
          name: marketplaceServers.name,
          description: marketplaceServers.description,
          category: marketplaceServers.category,
          pricePerCallUsdc: marketplaceServers.pricePerCallUsdc,
        })
        .from(marketplaceServers)
        .where(eq(marketplaceServers.status, 'active'))
        .limit(50);

      servers = rows.map((row) => ({
        ...row,
        invokeUrl: `${baseUrl}/api/marketplace/servers/${row.id}/invoke`,
      }));
    } catch {
      // DB unavailable  -  return metadata without server list
    }

    return c.json(
      {
        version: '1.0',
        platform: 'revealui',
        registryUrl: `${baseUrl}/api/marketplace/servers`,
        publishUrl: `${baseUrl}/api/marketplace/servers`,
        revenueShare: { platform: 0.2, developer: 0.8 },
        paymentMethods: ['x402-usdc'],
        servers,
      },
      200,
      { 'Cache-Control': 'public, max-age=60' },
    );
  },
);

/**
 * x402 payment methods discovery (Phase 5.2).
 * GET /.well-known/payment-methods.json
 *
 * Returns supported payment schemes for agent task micropayments.
 * Agents can discover how to pay per-task in USDC on Base.
 * Returns 404 when X402_ENABLED=false (default).
 */
app.openapi(
  createRoute({
    method: 'get',
    path: '/payment-methods.json',
    tags: ['a2a'],
    summary: 'x402 payment methods discovery',
    responses: {
      200: {
        content: { 'application/json': { schema: z.unknown() } },
        description: 'Payment methods',
      },
      404: {
        content: { 'application/json': { schema: z.unknown() } },
        description: 'x402 payments not enabled',
      },
    },
  }),
  (c) => {
    const baseUrl = getBaseUrl(c.req.raw);
    const methods = buildPaymentMethods(baseUrl);
    if (!methods) {
      return c.json({ error: 'x402 payments not enabled on this instance' }, 404);
    }
    return c.json(methods, 200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300',
    });
  },
);

// =============================================================================
// A2A task API  -  /a2a/*
// =============================================================================

const a2a = new OpenAPIHono<{ Variables: { user: UserContext | undefined } }>();

// Soft auth  -  populates user context when a session cookie is present.
// Not required  -  anonymous A2A requests are allowed; stored keys are used when authenticated.
a2a.use('*', authMiddleware({ required: false }));

// =============================================================================
// Registry hydration  -  load custom agents from DB on first request
// =============================================================================

// Built-in agents are always pre-seeded in-memory; never persisted to DB.
const BUILTIN_AGENT_IDS = new Set(['revealui-creator', 'revealui-ticket-agent']);

// Promise singleton  -  ensures hydration runs exactly once per server instance.
let hydrationPromise: Promise<void> | null = null;

async function ensureRegistryHydrated(): Promise<void> {
  if (hydrationPromise) return hydrationPromise;
  hydrationPromise = (async () => {
    try {
      const aiMod = await getAiModule();
      if (!aiMod) return; // @revealui/ai not installed  -  skip hydration
      const db = getClient();
      const rows = await db.select().from(registeredAgents);
      for (const row of rows) {
        const parsed = AgentDefinitionSchema.safeParse(row.definition);
        if (parsed.success && !aiMod.agentCardRegistry.has(parsed.data.id)) {
          aiMod.agentCardRegistry.register(parsed.data);
        }
      }
    } catch {
      // DB unavailable  -  registry remains in-memory only for this instance.
      // Reset so the next request retries hydration.
      hydrationPromise = null;
    }
  })();
  return hydrationPromise;
}

a2a.use('*', async (_c, next) => {
  await ensureRegistryHydrated();
  return next();
});

/** List all registered agents as A2A agent cards */
a2a.openapi(
  createRoute({
    method: 'get',
    path: '/agents',
    tags: ['a2a'],
    summary: 'List all registered agents as A2A agent cards',
    responses: {
      200: {
        content: { 'application/json': { schema: z.object({ agents: z.array(z.unknown()) }) } },
        description: 'Agent card list',
      },
      403: {
        content: { 'application/json': { schema: z.unknown() } },
        description: 'AI feature requires Pro or Enterprise license',
      },
    },
  }),
  async (c) => {
    const aiMod = await getAiModule();
    if (!aiMod) {
      return c.json(
        {
          error:
            "Feature 'ai' requires a Pro or Enterprise license. Upgrade at https://revealui.com/pricing",
        },
        403,
      );
    }
    const baseUrl = getBaseUrl(c.req.raw);
    const cards = aiMod.agentCardRegistry.listCards(baseUrl);
    return c.json({ agents: cards });
  },
);

/** Single agent card by ID */
a2a.openapi(
  createRoute({
    method: 'get',
    path: '/agents/{id}',
    tags: ['a2a'],
    summary: 'Get a single agent card by ID',
    request: {
      params: z.object({
        id: z.string().openapi({ description: 'Agent ID' }),
      }),
    },
    responses: {
      200: {
        content: { 'application/json': { schema: z.unknown() } },
        description: 'Agent card',
      },
      400: {
        content: { 'application/json': { schema: z.unknown() } },
        description: 'Invalid agent ID format',
      },
      404: {
        content: { 'application/json': { schema: z.unknown() } },
        description: 'Agent not found',
      },
      403: {
        content: { 'application/json': { schema: z.unknown() } },
        description: 'AI feature requires Pro or Enterprise license',
      },
    },
  }),
  async (c) => {
    const aiMod = await getAiModule();
    if (!aiMod) {
      return c.json(
        {
          error:
            "Feature 'ai' requires a Pro or Enterprise license. Upgrade at https://revealui.com/pricing",
        },
        403,
      );
    }
    const { id: agentId } = c.req.valid('param');
    if (!isValidAgentId(agentId)) {
      return c.json({ error: 'Invalid agent ID format' }, 400);
    }
    const baseUrl = getBaseUrl(c.req.raw);
    const card = aiMod.agentCardRegistry.getCard(agentId, baseUrl);
    if (!card) {
      return c.json({ error: `Agent '${agentId}' not found` }, 404);
    }
    return c.json(card);
  },
);

/** Full agent definition  -  admin only, requires 'ai' feature */
a2a.openapi(
  createRoute({
    method: 'get',
    path: '/agents/{id}/def',
    tags: ['a2a'],
    summary: 'Get full agent definition (admin only)',
    request: {
      params: z.object({
        id: z.string().openapi({ description: 'Agent ID' }),
      }),
    },
    middleware: [
      authMiddleware({ required: true }),
      requireFeature('ai', { mode: 'entitlements' }),
    ] as const,
    responses: {
      200: {
        content: { 'application/json': { schema: z.object({ def: z.unknown() }) } },
        description: 'Agent definition',
      },
      400: {
        content: { 'application/json': { schema: z.unknown() } },
        description: 'Invalid agent ID format',
      },
      404: {
        content: { 'application/json': { schema: z.unknown() } },
        description: 'Agent not found',
      },
      403: {
        content: { 'application/json': { schema: z.unknown() } },
        description: 'AI feature requires Pro or Enterprise license',
      },
    },
  }),
  async (c) => {
    const aiMod = await getAiModule();
    if (!aiMod) {
      return c.json(
        {
          error:
            "Feature 'ai' requires a Pro or Enterprise license. Upgrade at https://revealui.com/pricing",
        },
        403,
      );
    }
    const { id: agentId } = c.req.valid('param');
    if (!isValidAgentId(agentId)) {
      return c.json({ error: 'Invalid agent ID format' }, 400);
    }
    const def = aiMod.agentCardRegistry.getDef(agentId);
    if (!def) {
      return c.json({ error: `Agent '${agentId}' not found` }, 404);
    }
    return c.json({ def });
  },
);

/** Task history for an agent  -  last 20 actions, requires auth + 'ai' feature */
a2a.openapi(
  createRoute({
    method: 'get',
    path: '/agents/{id}/tasks',
    tags: ['a2a'],
    summary: 'Get task history for an agent',
    request: {
      params: z.object({
        id: z.string().openapi({ description: 'Agent ID' }),
      }),
    },
    middleware: [requireFeature('ai', { mode: 'entitlements' })] as const,
    responses: {
      200: {
        content: { 'application/json': { schema: z.object({ tasks: z.array(z.unknown()) }) } },
        description: 'Task history',
      },
      400: {
        content: { 'application/json': { schema: z.unknown() } },
        description: 'Invalid agent ID format',
      },
      401: {
        content: { 'application/json': { schema: z.unknown() } },
        description: 'Authentication required',
      },
    },
  }),
  async (c) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Authentication required' }, 401);
    }
    const { id: agentId } = c.req.valid('param');
    if (!isValidAgentId(agentId)) {
      return c.json({ error: 'Invalid agent ID format' }, 400);
    }
    try {
      const db = getClient();
      const rows = await db
        .select()
        .from(agentActions)
        .where(eq(agentActions.agentId, agentId))
        .orderBy(desc(agentActions.startedAt))
        .limit(20);
      return c.json({ tasks: rows });
    } catch {
      return c.json({ tasks: [] });
    }
  },
);

/** Update an agent's mutable fields  -  requires auth + 'ai' feature */
a2a.openapi(
  createRoute({
    method: 'put',
    path: '/agents/{id}',
    tags: ['a2a'],
    summary: "Update an agent's mutable fields",
    request: {
      params: z.object({
        id: z.string().openapi({ description: 'Agent ID' }),
      }),
      body: {
        content: {
          'application/json': {
            schema: z.object({
              name: z.string().optional(),
              description: z.string().optional(),
              systemPrompt: z.string().optional(),
              model: z.string().optional(),
              temperature: z.number().optional(),
              maxTokens: z.number().optional(),
              capabilities: z.unknown().optional(),
            }),
          },
        },
      },
    },
    middleware: [
      authMiddleware({ required: true }),
      requireFeature('ai', { mode: 'entitlements' }),
    ] as const,
    responses: {
      200: {
        content: { 'application/json': { schema: z.object({ card: z.unknown() }) } },
        description: 'Updated agent card',
      },
      400: {
        content: { 'application/json': { schema: z.unknown() } },
        description: 'Invalid request',
      },
      404: {
        content: { 'application/json': { schema: z.unknown() } },
        description: 'Agent not found',
      },
      403: {
        content: { 'application/json': { schema: z.unknown() } },
        description: 'AI feature requires Pro or Enterprise license',
      },
    },
  }),
  async (c) => {
    const aiMod = await getAiModule();
    if (!aiMod) {
      return c.json(
        {
          error:
            "Feature 'ai' requires a Pro or Enterprise license. Upgrade at https://revealui.com/pricing",
        },
        403,
      );
    }
    const { id: agentId } = c.req.valid('param');
    if (!isValidAgentId(agentId)) {
      return c.json({ error: 'Invalid agent ID format' }, 400);
    }
    if (!aiMod.agentCardRegistry.has(agentId)) {
      return c.json({ error: `Agent '${agentId}' not found` }, 404);
    }

    const body = c.req.valid('json');

    const allowed = [
      'name',
      'description',
      'systemPrompt',
      'model',
      'temperature',
      'maxTokens',
      'capabilities',
    ] as const;
    const patch: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in (body as Record<string, unknown>)) {
        patch[key] = (body as Record<string, unknown>)[key];
      }
    }

    aiMod.agentCardRegistry.update(
      agentId,
      patch as Parameters<typeof aiMod.agentCardRegistry.update>[1],
    );

    // Persist update to DB for non-built-in agents (best-effort)
    if (!BUILTIN_AGENT_IDS.has(agentId)) {
      try {
        const updatedDef = aiMod.agentCardRegistry.getDef(agentId);
        if (updatedDef) {
          const db = getClient();
          await db
            .update(registeredAgents)
            .set({
              definition: updatedDef,
              updatedAt: new Date(),
            })
            .where(eq(registeredAgents.id, agentId));
        }
      } catch (err) {
        // Non-fatal  -  update is applied in-memory.
        logger.warn('Agent registry DB update failed (update applied in-memory only)', {
          agentId,
          error: err instanceof Error ? err.message : 'unknown',
        });
      }
    }

    const baseUrl = getBaseUrl(c.req.raw);
    const card = aiMod.agentCardRegistry.getCard(agentId, baseUrl);
    return c.json({ card });
  },
);

/** Retire (unregister) an agent  -  requires auth; built-in platform agents are protected */
a2a.openapi(
  createRoute({
    method: 'delete',
    path: '/agents/{id}',
    tags: ['a2a'],
    summary: 'Retire (unregister) an agent',
    request: {
      params: z.object({
        id: z.string().openapi({ description: 'Agent ID' }),
      }),
    },
    middleware: [
      authMiddleware({ required: true }),
      requireFeature('ai', { mode: 'entitlements' }),
    ] as const,
    responses: {
      200: {
        content: { 'application/json': { schema: z.object({ success: z.boolean() }) } },
        description: 'Agent retired',
      },
      400: {
        content: { 'application/json': { schema: z.unknown() } },
        description: 'Invalid agent ID format',
      },
      403: {
        content: { 'application/json': { schema: z.unknown() } },
        description:
          'Built-in agents cannot be retired or AI feature requires Pro or Enterprise license',
      },
      404: {
        content: { 'application/json': { schema: z.unknown() } },
        description: 'Agent not found',
      },
    },
  }),
  async (c) => {
    const { id: agentId } = c.req.valid('param');
    if (!isValidAgentId(agentId)) {
      return c.json({ error: 'Invalid agent ID format' }, 400);
    }

    // Built-in agents cannot be retired
    if (BUILTIN_AGENT_IDS.has(agentId)) {
      return c.json({ error: 'Built-in platform agents cannot be retired' }, 403);
    }

    const aiMod = await getAiModule();
    if (!aiMod) {
      return c.json(
        {
          error:
            "Feature 'ai' requires a Pro or Enterprise license. Upgrade at https://revealui.com/pricing",
        },
        403,
      );
    }

    const removed = aiMod.agentCardRegistry.unregister(agentId);
    if (!removed) {
      return c.json({ error: `Agent '${agentId}' not found` }, 404);
    }

    // Remove from DB (best-effort)
    try {
      const db = getClient();
      await db.delete(registeredAgents).where(eq(registeredAgents.id, agentId));
    } catch (err) {
      // Non-fatal  -  agent is unregistered from in-memory registry.
      logger.warn('Agent registry DB delete failed (agent removed from in-memory only)', {
        agentId,
        error: err instanceof Error ? err.message : 'unknown',
      });
    }

    return c.json({ success: true });
  },
);

/**
 * Register a new agent from an AgentDefinition.
 * The agent is added to the in-memory registry for this server's lifetime.
 * Requires authentication + 'ai' feature flag.
 */
a2a.openapi(
  createRoute({
    method: 'post',
    path: '/agents',
    tags: ['a2a'],
    summary: 'Register a new agent from an AgentDefinition',
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.unknown(),
          },
        },
      },
    },
    middleware: [
      authMiddleware({ required: true }),
      requireFeature('ai', { mode: 'entitlements' }),
    ] as const,
    responses: {
      201: {
        content: { 'application/json': { schema: z.object({ card: z.unknown() }) } },
        description: 'Agent registered',
      },
      400: {
        content: { 'application/json': { schema: z.unknown() } },
        description: 'Invalid request',
      },
      403: {
        content: { 'application/json': { schema: z.unknown() } },
        description: 'AI feature requires Pro or Enterprise license',
      },
      409: {
        content: { 'application/json': { schema: z.unknown() } },
        description: 'Agent already registered',
      },
    },
  }),
  async (c) => {
    const body = c.req.valid('json');

    const parsed = AgentDefinitionSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid agent definition', issues: parsed.error.issues }, 400);
    }

    const aiMod = await getAiModule();
    if (!aiMod) {
      return c.json(
        {
          error:
            "Feature 'ai' requires a Pro or Enterprise license. Upgrade at https://revealui.com/pricing",
        },
        403,
      );
    }

    const def = parsed.data;
    if (aiMod.agentCardRegistry.has(def.id)) {
      return c.json({ error: `Agent '${def.id}' already registered` }, 409);
    }

    aiMod.agentCardRegistry.register(def);

    // Persist to DB (best-effort; registry remains functional if DB write fails)
    try {
      const db = getClient();
      await db.insert(registeredAgents).values({
        id: def.id,
        definition: def,
      });
    } catch (err) {
      // Non-fatal  -  agent is registered in-memory for this server instance.
      // Log so operators can detect persistent DB write failures on cold starts/redeploys.
      logger.warn('Agent registry DB persist failed (agent registered in-memory only)', {
        agentId: def.id,
        error: err instanceof Error ? err.message : 'unknown',
      });
    }

    const baseUrl = getBaseUrl(c.req.raw);
    const card = aiMod.agentCardRegistry.getCard(def.id, baseUrl);
    return c.json({ card }, 201);
  },
);

/**
 * SSE stream endpoint for tasks/sendSubscribe.
 * The client subscribes here after receiving a taskId from tasks/send.
 *
 * This is a simplified polling-based SSE  -  for a full streaming implementation
 * the AgentRuntime emits events that are forwarded here.
 */
a2a.openapi(
  createRoute({
    method: 'get',
    path: '/stream/{taskId}',
    tags: ['a2a'],
    summary: 'SSE stream for a running task',
    request: {
      params: z.object({
        taskId: z.string().openapi({ description: 'Task ID' }),
      }),
    },
    middleware: [requireFeature('ai', { mode: 'entitlements' })] as const,
    responses: {
      200: {
        content: { 'text/event-stream': { schema: z.unknown() } },
        description: 'SSE event stream',
      },
      403: {
        content: { 'application/json': { schema: z.unknown() } },
        description: 'AI feature requires Pro or Enterprise license',
      },
    },
  }),
  async (c) => {
    const aiMod = await getAiModule();
    if (!aiMod) {
      return c.json(
        {
          error:
            "Feature 'ai' requires a Pro or Enterprise license. Upgrade at https://revealui.com/pricing",
        },
        403,
      );
    }
    const { taskId } = c.req.valid('param');

    const getTaskFn = aiMod.getTask;
    return c.body(
      new ReadableStream({
        start(controller) {
          const send = (data: unknown) => {
            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`));
          };

          // Poll task store for status updates (simple implementation).
          // Must cover the full agent timeout (120s) so long tasks are observable.
          let iterations = 0;
          const maxIterations = 240; // 120s at 500ms interval

          const poll = () => {
            iterations++;
            const task = getTaskFn(taskId);

            if (!task) {
              send({ error: `Task '${taskId}' not found` });
              controller.close();
              return;
            }

            send(task);

            const terminal = ['completed', 'failed', 'canceled'];
            if (terminal.includes(task.status.state) || iterations >= maxIterations) {
              controller.close();
              return;
            }

            setTimeout(poll, 500);
          };

          poll();
        },
      }),
      200,
      {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    );
  },
);

/**
 * Main A2A JSON-RPC dispatcher.
 * Handles: tasks/send, tasks/get, tasks/cancel, tasks/sendSubscribe
 *
 * tasks/send and tasks/sendSubscribe require the 'ai' feature.
 * tasks/get and tasks/cancel are always allowed.
 */
a2a.openapi(
  createRoute({
    method: 'post',
    path: '/',
    tags: ['a2a'],
    summary: 'A2A JSON-RPC dispatcher',
    request: {
      body: {
        content: {
          'application/json': {
            schema: z.unknown(),
          },
        },
      },
    },
    responses: {
      200: {
        content: { 'application/json': { schema: z.unknown() } },
        description: 'JSON-RPC response',
      },
      400: {
        content: { 'application/json': { schema: z.unknown() } },
        description: 'Parse error or invalid request',
      },
      403: {
        content: { 'application/json': { schema: z.unknown() } },
        description: 'AI feature requires Pro or Enterprise license',
      },
    },
  }),
  // @ts-expect-error  -  JSON-RPC dispatcher returns heterogeneous shapes + raw Response from quota middleware
  async (c) => {
    const aiMod = await getAiModule();
    if (!aiMod) {
      return c.json(
        {
          jsonrpc: '2.0',
          id: null,
          error: {
            code: -32003,
            message:
              "Feature 'ai' requires a Pro or Enterprise license. Upgrade at https://revealui.com/pricing",
          },
        },
        403,
      );
    }

    const body = c.req.valid('json');

    const parsed = A2AJsonRpcRequestSchema.safeParse(body);
    if (!parsed.success) {
      const id = (body as Record<string, unknown>)?.id ?? null;
      return c.json(
        {
          jsonrpc: '2.0',
          id,
          error: { code: RPC_INVALID_REQUEST, message: 'Invalid Request' },
        },
        400,
      );
    }

    const req: A2AJsonRpcRequest = parsed.data;

    // Gate task execution behind entitlements; read-only methods always allowed
    const executionMethods = new Set(['tasks/send', 'tasks/sendSubscribe']);
    if (executionMethods.has(req.method)) {
      const entitlements = (c as unknown as { get(k: string): unknown }).get('entitlements') as
        | { features?: Record<string, boolean> }
        | undefined;
      const aiEnabled = entitlements?.features?.ai ?? false;
      if (!aiEnabled) {
        return c.json(
          {
            jsonrpc: '2.0',
            id: req.id,
            error: {
              code: -32003,
              message: "Feature 'ai' requires a Pro or Enterprise license.",
            },
          },
          403,
        );
      }

      // Check and increment task quota (Track B metering)
      const quotaResponse = await requireTaskQuota(c, async () => {
        // No-op: quota check only, work is performed after quota validation
      });
      if (quotaResponse instanceof Response) {
        return quotaResponse;
      }
    }

    // Extract optional agent ID from X-Agent-ID header
    const agentId = c.req.header('X-Agent-ID');

    // x402 payment proof verification: when an X-PAYMENT-PAYLOAD header is
    // present on an executable JSON-RPC method, verify it before calling
    // the handler. Valid → set paymentVerified so the handler skips its
    // pending-payment branch. Invalid → 402 with fresh requirements.
    let paymentVerified = false;
    if (executionMethods.has(req.method)) {
      const paymentPayload = c.req.header('X-PAYMENT-PAYLOAD');
      if (paymentPayload) {
        const baseUrl = getBaseUrl(c.req.raw);
        const resource = `${baseUrl}${new URL(c.req.url).pathname}`;
        const verification = await verifyPayment(paymentPayload, resource);
        if (verification.valid) {
          paymentVerified = true;
        } else {
          const paymentRequired = buildPaymentRequired(resource);
          return c.json(
            {
              jsonrpc: '2.0',
              id: req.id,
              error: {
                code: -32004,
                message: `Payment verification failed: ${verification.error}`,
              },
            },
            402,
            { 'X-PAYMENT-REQUIRED': encodePaymentRequired(paymentRequired) },
          );
        }
      }
    }

    // Resolve LLM client from environment-configured open models
    let llmClient: unknown;
    try {
      const aiMod2 = await import('@revealui/ai').catch(() => null);
      if (aiMod2) {
        llmClient = aiMod2.createLLMClientFromEnv();
      }
    } catch {
      // No AI module available  -  llmClient stays undefined, handler returns stub
    }

    const startedAt = Date.now();
    // llmClient is typed as unknown because it comes from dynamically imported Pro packages;
    // the runtime type is LLMClient when present.
    type HandleParams = Parameters<typeof aiMod.handleA2AJsonRpc>;
    const result = await aiMod.handleA2AJsonRpc(
      req,
      agentId ?? undefined,
      llmClient as HandleParams[2],
      { paymentVerified },
    );
    const completedAt = Date.now();

    // Inspect handler outcome up front — used by both the 402 branch and
    // the agentActions audit log below.
    const taskResult = result.result as {
      id?: string;
      status?: { state?: string };
      metadata?: { pricing?: { usdc?: string } };
    } | null;
    const taskState = taskResult?.status?.state;

    // Pending-payment tasks: convert to HTTP 402 with X-PAYMENT-REQUIRED.
    // The route owns this protocol-layer wrapper because verifyPayment lives
    // in apps/api middleware and must not leak into the @revealui/ai package.
    if (taskState === 'pending-payment') {
      const baseUrl = getBaseUrl(c.req.raw);
      const resource = `${baseUrl}${new URL(c.req.url).pathname}`;
      const paymentRequired = buildPaymentRequired(resource, taskResult?.metadata?.pricing?.usdc);
      return c.json(result, 402, {
        'X-PAYMENT-REQUIRED': encodePaymentRequired(paymentRequired),
      });
    }

    // Fire-and-forget: persist task execution record to agentActions
    if (executionMethods.has(req.method)) {
      const status = taskState === 'failed' ? 'failed' : 'completed';
      void (async () => {
        try {
          const db = getClient();
          await db.insert(agentActions).values({
            id: crypto.randomUUID(),
            agentId: agentId ?? 'revealui-creator',
            tool: req.method,
            params: (req.params ?? null) as Record<string, unknown> | null,
            result: taskResult as Record<string, unknown> | null,
            status,
            startedAt: new Date(startedAt),
            completedAt: new Date(completedAt),
            durationMs: completedAt - startedAt,
          });
        } catch {
          // Non-fatal  -  in-memory task store remains authoritative for active tasks
        }
      })();
    }

    return c.json(result);
  },
);

export { a2a as a2aRoutes, app as wellKnownRoutes };
