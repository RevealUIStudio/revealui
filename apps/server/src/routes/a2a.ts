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

import type { A2AJsonRpcRequest, A2ATask } from '@revealui/contracts';
import {
  A2AJsonRpcRequestSchema,
  A2ASendTaskParamsSchema,
  A2ATaskSchema,
  AgentDefinitionSchema,
} from '@revealui/contracts';
import { getExplicitDeploymentMode } from '@revealui/core/deployment-mode';
import { logger } from '@revealui/core/observability/logger';
import { trackX402PaymentRequired } from '@revealui/core/observability/metrics';
import { classifyAuditWriteFailure } from '@revealui/core/security';
import { getClient } from '@revealui/db';
import {
  type AgentAction,
  type AgentActionScope,
  agentActions,
  marketplaceServers,
  registeredAgents,
} from '@revealui/db/schema';
import { createRoute, OpenAPIHono, z } from '@revealui/openapi';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { aiModuleUnavailableBody, getAiModule } from '../lib/ai-module-loader.js';
import { createAuditStore } from '../lib/audit-signer.js';
import { asLLMNotConfigured } from '../lib/llm-not-configured.js';
import { buildMcpManifest } from '../lib/mcp-manifest.js';
import { detectDeploymentMode, type EnvMap } from '../lib/validate-startup.js';
import { authMiddleware } from '../middleware/auth.js';
import type { EntitlementContext } from '../middleware/entitlements.js';
import { requireFeature } from '../middleware/license.js';
import { requireTaskQuota } from '../middleware/task-quota.js';
import {
  buildPaymentMethods,
  buildPaymentRequired,
  encodePaymentRequired,
  getAdvertisedCurrencyLabel,
  verifyPayment,
} from '../middleware/x402.js';

// JSON-RPC error codes (inlined  -  avoids static import of @revealui/ai)
const RPC_INVALID_REQUEST = -32600;

interface UserContext {
  id: string;
  email: string | null;
  name: string;
  role: string;
}

/** Receipt attribution uses authenticated actor and membership-resolved context only. */
function actionScope(
  user: UserContext | undefined,
  entitlements: EntitlementContext | undefined,
): AgentActionScope | null {
  if (!user) return null;
  if (entitlements?.accountId) {
    return entitlements.userId === user.id
      ? { actorUserId: user.id, accountId: entitlements.accountId }
      : null;
  }
  // Only explicit Forge posture permits personal scope; absent/invalid mode grants none.
  if (getExplicitDeploymentMode(process.env as EnvMap) !== 'forge') return null;
  if (entitlements && entitlements.userId !== user.id) return null;
  return { actorUserId: user.id, accountId: null };
}

function actionScopePredicate(scope: AgentActionScope) {
  return and(
    eq(agentActions.actorUserId, scope.actorUserId),
    scope.accountId ? eq(agentActions.accountId, scope.accountId) : isNull(agentActions.accountId),
  );
}

type AiRuntime = NonNullable<Awaited<ReturnType<typeof getAiModule>>>;
const RECEIPT_VERSION = 2;
const executionMethods = new Set(['tasks/send', 'tasks/sendSubscribe']);
const receiptPayloadSchema = z.object({
  request: A2ASendTaskParamsSchema,
  binding: z.object({
    agentId: z.string().min(1),
    definitionDigest: z.string().regex(/^[a-f0-9]{64}$/),
    inputDigest: z.string().regex(/^[a-f0-9]{64}$/),
  }),
});
type ReceiptPayload = z.infer<typeof receiptPayloadSchema>;

function receiptPayload(row: AgentAction): ReceiptPayload | null {
  if (row.version !== RECEIPT_VERSION || !executionMethods.has(row.tool)) return null;
  const parsed = receiptPayloadSchema.safeParse(row.params);
  return parsed.success ? parsed.data : null;
}

function jsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Remove the reserved server receipt namespace without changing historical data. */
function withoutReceiptMetadata(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const record = jsonObject(value);
  const metadata = record.metadata;
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return value;
  const clean = Object.fromEntries(
    Object.entries(jsonObject(metadata)).filter(([key]) => key !== 'receipt'),
  );
  return { ...record, metadata: clean };
}

function receiptTask(task: A2ATask, persisted: boolean, error?: string): A2ATask {
  const metadata = Object.fromEntries(
    Object.entries(task.metadata ?? {}).filter(([key]) => key !== 'receipt'),
  );
  return {
    ...task,
    metadata: {
      ...metadata,
      receipt: {
        taskId: task.id,
        status: task.status.state,
        persisted,
        ...(error
          ? { error: { code: 'RECEIPT_WRITE_FAILED', message: error, retry: 'tasks/get' } }
          : {}),
      },
    },
  };
}

function isTerminalTask(task: A2ATask): boolean {
  return ['completed', 'failed', 'canceled'].includes(task.status.state);
}

function databaseStatus(task: A2ATask): string {
  return task.status.state === 'canceled'
    ? 'cancelled'
    : task.status.state === 'working'
      ? 'running'
      : isTerminalTask(task)
        ? task.status.state
        : 'pending';
}

function storedTask(row: AgentAction): A2ATask {
  const raw = jsonObject(row.result);
  const status = jsonObject(raw.status);
  const phase =
    row.status === 'pending' && receiptPayload(row) && status.state === 'pending-payment';
  const state =
    row.status === 'cancelled'
      ? 'canceled'
      : ['completed', 'failed'].includes(row.status)
        ? row.status
        : phase
          ? 'pending-payment'
          : 'unknown';
  const candidate = {
    ...(state === 'unknown' ? {} : raw),
    id: row.id,
    status: {
      ...status,
      state,
      timestamp:
        typeof status.timestamp === 'string'
          ? status.timestamp
          : (row.completedAt ?? row.startedAt ?? new Date()).toISOString(),
    },
  };
  const parsed = A2ATaskSchema.safeParse(candidate);
  const task: A2ATask = parsed.success
    ? parsed.data
    : {
        id: row.id,
        status: { state: 'unknown', timestamp: new Date().toISOString() },
      };
  return receiptTask(task, true);
}

async function lookupReceipt(taskId: string, scope: AgentActionScope): Promise<AgentAction | null> {
  const [row] = await getClient()
    .select()
    .from(agentActions)
    .where(
      and(
        eq(agentActions.id, taskId),
        eq(agentActions.version, RECEIPT_VERSION),
        actionScopePredicate(scope),
      ),
    )
    .limit(1);
  return row && row.version === RECEIPT_VERSION && executionMethods.has(row.tool) ? row : null;
}

/** Persist the known outcome without ever invoking execution or changing a terminal winner. */
async function persistTask(task: A2ATask, scope: AgentActionScope): Promise<A2ATask> {
  try {
    const terminal = isTerminalTask(task);
    const completedAt = terminal ? new Date(task.status.timestamp) : null;
    const saved = await getClient()
      .update(agentActions)
      .set({
        status: databaseStatus(task),
        result: {
          ...task,
          metadata: Object.fromEntries(
            Object.entries(task.metadata ?? {}).filter(([key]) => key !== 'receipt'),
          ),
        },
        error:
          task.status.state === 'failed'
            ? (task.status.message?.parts
                .filter((part) => part.type === 'text')
                .map((part) => ('text' in part ? part.text : ''))
                .join('\n') ?? null)
            : null,
        completedAt,
      })
      .where(
        and(
          eq(agentActions.id, task.id),
          eq(agentActions.version, RECEIPT_VERSION),
          actionScopePredicate(scope),
          inArray(agentActions.status, terminal ? ['pending', 'running'] : ['pending']),
        ),
      )
      .returning();
    if (saved.length) return receiptTask(task, true);
    const existing = await lookupReceipt(task.id, scope);
    if (existing && ['completed', 'failed', 'cancelled'].includes(existing.status))
      return storedTask(existing);
    throw new Error('The attributed receipt reservation is unavailable');
  } catch (error) {
    logger.warn('A2A receipt persistence failed', {
      taskId: task.id,
      reason: classifyAuditWriteFailure(error),
    });
    return receiptTask(
      task,
      false,
      'The task outcome is known, but its receipt could not be saved. Fetch this task again to retry saving the receipt; do not rerun it.',
    );
  }
}

async function readOwnedTask(
  taskId: string,
  scope: AgentActionScope,
  ai: AiRuntime,
): Promise<A2ATask | null> {
  const active = ai.getTask(taskId, scope);
  const row = await lookupReceipt(taskId, scope);
  if (!row)
    return active
      ? receiptTask(active, false, 'No durable receipt is available for this task.')
      : null;
  if (['completed', 'failed', 'cancelled'].includes(row.status)) return storedTask(row);
  if (
    active &&
    (isTerminalTask(active) ||
      (row.status === 'pending' && active.status.state === 'pending-payment'))
  )
    return persistTask(active, scope);
  return active ? receiptTask(active, true) : storedTask(row);
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
      503: {
        content: { 'application/json': { schema: z.unknown() } },
        description: 'AI runtime package not available in this deployment (not a Free-plan limit)',
      },
    },
  }),
  async (c) => {
    const aiMod = await getAiModule();
    if (!aiMod) {
      return c.json(aiModuleUnavailableBody(), 503);
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
      503: {
        content: { 'application/json': { schema: z.unknown() } },
        description: 'AI runtime package not available in this deployment (not a Free-plan limit)',
      },
    },
  }),
  async (c) => {
    const aiMod = await getAiModule();
    if (!aiMod) {
      return c.json(aiModuleUnavailableBody(), 503);
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

/**
 * MCP server discovery manifest.
 * GET /.well-known/mcp.json
 *
 * Returns the MCP servers exposed by this RevealUI deployment so agents
 * can enumerate available tool surfaces without prior knowledge.
 *
 * Public  -  no auth, no license gating; the response describes what
 * exists, not what the caller is licensed to invoke. Per-server
 * licensing is enforced at the tool-invocation layer.
 *
 * Closes fleet-messaging audit N4 ("agent-native pitch ships zero
 * agent affordances") at the discovery layer; complement to the
 * /llms.txt prose layer (PR #720) and the /.well-known/agent.json
 * A2A discovery layer.
 */
app.openapi(
  createRoute({
    method: 'get',
    path: '/mcp.json',
    tags: ['a2a'],
    summary: 'MCP server discovery manifest',
    responses: {
      200: {
        content: { 'application/json': { schema: z.unknown() } },
        description: 'MCP server manifest',
      },
    },
  }),
  (c) => {
    return c.json(buildMcpManifest(), 200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300',
    });
  },
);

// =============================================================================
// A2A task API  -  /a2a/*
// =============================================================================

const a2a = new OpenAPIHono<{
  Variables: { user: UserContext | undefined; entitlements: EntitlementContext | undefined };
}>();

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
      503: {
        content: { 'application/json': { schema: z.unknown() } },
        description: 'AI runtime package not available in this deployment (not a Free-plan limit)',
      },
    },
  }),
  async (c) => {
    const aiMod = await getAiModule();
    if (!aiMod) {
      return c.json(aiModuleUnavailableBody(), 503);
    }
    const baseUrl = getBaseUrl(c.req.raw);
    // Include registry id on each card. Display name alone is not a stable id
    // (e.g. "Ticket Agent" ≠ "revealui-ticket-agent") — admin list UIs must not
    // invent ids by slugifying the name.
    // Registry id must be applied AFTER the card spread so a missing/undefined
    // id field on the A2A card shape cannot overwrite the real agent id.
    const agents = aiMod.agentCardRegistry
      .listDefs()
      .map((def) => {
        const card = aiMod.agentCardRegistry.getCard(def.id, baseUrl);
        if (!card) return null;
        return { ...card, id: def.id };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);
    return c.json({ agents });
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
      503: {
        content: { 'application/json': { schema: z.unknown() } },
        description: 'AI runtime package not available in this deployment (not a Free-plan limit)',
      },
    },
  }),
  async (c) => {
    const aiMod = await getAiModule();
    if (!aiMod) {
      return c.json(aiModuleUnavailableBody(), 503);
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
      503: {
        content: { 'application/json': { schema: z.unknown() } },
        description: 'AI runtime package not available in this deployment (not a Free-plan limit)',
      },
    },
  }),
  async (c) => {
    const aiMod = await getAiModule();
    if (!aiMod) {
      return c.json(aiModuleUnavailableBody(), 503);
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
    const scope = actionScope(user, c.get('entitlements'));
    if (!scope) return c.json({ tasks: [] });
    try {
      const db = getClient();
      const rows = await db
        .select()
        .from(agentActions)
        .where(and(eq(agentActions.agentId, agentId), actionScopePredicate(scope)))
        .orderBy(desc(agentActions.startedAt))
        .limit(20);
      return c.json({
        tasks: rows.map((row) => {
          const params = jsonObject(withoutReceiptMetadata(row.params));
          return {
            ...row,
            params:
              row.params && typeof row.params === 'object' && !Array.isArray(row.params)
                ? {
                    ...params,
                    ...('request' in params
                      ? { request: withoutReceiptMetadata(params.request) }
                      : {}),
                  }
                : row.params,
            result:
              row.version === RECEIPT_VERSION && executionMethods.has(row.tool)
                ? storedTask(row)
                : withoutReceiptMetadata(row.result),
          };
        }),
      });
    } catch {
      return c.json({ tasks: [] });
    }
  },
);

/**
 * Cheapest possible existence check for onboarding-checklist derivation  -
 * requires auth + 'ai' feature, same gate as the task-history route above.
 * At most three distinct terminal statuses for the authenticated actor and resolved account.
 * Unattributed legacy rows and unfinished task records do not establish completion.
 */
a2a.openapi(
  createRoute({
    method: 'get',
    path: '/agent-tasks/exists',
    tags: ['a2a'],
    summary: 'Check for attributed terminal task receipts and completed executions',
    middleware: [requireFeature('ai', { mode: 'entitlements' })] as const,
    responses: {
      200: {
        content: {
          'application/json': { schema: z.object({ exists: z.boolean(), completed: z.boolean() }) },
        },
        description: 'Whether at least one agent task exists',
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
    const scope = actionScope(user, c.get('entitlements'));
    if (!scope) return c.json({ exists: false, completed: false });
    try {
      const db = getClient();
      // One row per terminal status, so a recent failure cannot hide prior success.
      const rows = await db
        .selectDistinct({ status: agentActions.status })
        .from(agentActions)
        .where(
          and(
            actionScopePredicate(scope),
            inArray(agentActions.status, ['completed', 'failed', 'cancelled']),
          ),
        )
        .limit(3);
      return c.json({
        exists: rows.length > 0,
        completed: rows.some((row) => row.status === 'completed'),
      });
    } catch {
      return c.json({ exists: false, completed: false });
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
      503: {
        content: { 'application/json': { schema: z.unknown() } },
        description: 'AI runtime package not available in this deployment (not a Free-plan limit)',
      },
    },
  }),
  async (c) => {
    const aiMod = await getAiModule();
    if (!aiMod) {
      return c.json(aiModuleUnavailableBody(), 503);
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
      503: {
        content: { 'application/json': { schema: z.unknown() } },
        description: 'AI runtime package not available in this deployment (not a Free-plan limit)',
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
      return c.json(aiModuleUnavailableBody(), 503);
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
      503: {
        content: { 'application/json': { schema: z.unknown() } },
        description: 'AI runtime package not available in this deployment (not a Free-plan limit)',
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
      return c.json(aiModuleUnavailableBody(), 503);
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
      404: {
        content: { 'application/json': { schema: z.unknown() } },
        description: 'Task not found in the authenticated actor and account scope',
      },
      403: {
        content: { 'application/json': { schema: z.unknown() } },
        description: 'AI feature requires Pro or Enterprise license',
      },
      500: {
        content: { 'application/json': { schema: z.unknown() } },
        description:
          'Task operation could not complete; known execution outcomes include server-owned receipt status',
      },
      503: {
        content: { 'application/json': { schema: z.unknown() } },
        description: 'AI runtime package not available in this deployment (not a Free-plan limit)',
      },
    },
  }),
  async (c) => {
    const aiMod = await getAiModule();
    if (!aiMod) {
      return c.json(aiModuleUnavailableBody(), 503);
    }
    const { taskId } = c.req.valid('param');
    const scope = actionScope(c.get('user'), c.get('entitlements'));
    if (!(scope && (await readOwnedTask(taskId, scope, aiMod))))
      return c.json({ error: 'Task not found' }, 404);

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

          const poll = async () => {
            iterations++;
            let task: A2ATask | null;
            try {
              task = await readOwnedTask(taskId, scope, aiMod);
            } catch {
              send({ error: 'Durable task storage is unavailable' });
              controller.close();
              return;
            }

            if (!task) {
              send({ error: 'Task not found' });
              controller.close();
              return;
            }

            send(task);

            const terminal = ['completed', 'failed', 'canceled', 'unknown'];
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
 * tasks/get and tasks/cancel require trusted task ownership without an AI feature gate.
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
        description:
          'JSON-RPC response with server-owned receipt status; persisted false requires receipt recovery rather than execution retry',
      },
      400: {
        content: { 'application/json': { schema: z.unknown() } },
        description: 'Parse error or invalid request',
      },
      404: {
        content: { 'application/json': { schema: z.unknown() } },
        description: 'Task not found in the authenticated actor and account scope',
      },
      402: {
        content: { 'application/json': { schema: z.unknown() } },
        description: 'Payment proof required; the pending task has not executed',
      },
      403: {
        content: { 'application/json': { schema: z.unknown() } },
        description: 'AI feature requires Pro or Enterprise license',
      },
      500: {
        content: { 'application/json': { schema: z.unknown() } },
        description:
          'Task operation could not complete; known execution outcomes include server-owned receipt status',
      },
      503: {
        content: { 'application/json': { schema: z.unknown() } },
        description: 'AI runtime package not available in this deployment (not a Free-plan limit)',
      },
      409: {
        content: { 'application/json': { schema: z.unknown() } },
        description:
          'Hosted account has no LLM provider configured (set one at /settings/api-keys)',
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
            message: aiModuleUnavailableBody().error,
            data: { code: 'AI_MODULE_UNAVAILABLE' },
          },
        },
        503,
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

    const scope = actionScope(c.get('user'), c.get('entitlements'));
    const agentId = c.req.header('X-Agent-ID');
    let preparedTask: A2ATask | undefined;
    let reservationPayload: ReceiptPayload | undefined;
    let pendingResult: A2ATask | undefined;
    let requiresPayment = false;

    // Execution requires entitlements; all task methods retain trusted ownership.
    if (executionMethods.has(req.method)) {
      const entitlements = (c as unknown as { get(k: string): unknown }).get('entitlements') as
        | { features?: Record<string, boolean> }
        | undefined;
      const aiEnabled = entitlements?.features?.ai ?? false;
      if (!aiEnabled) {
        // Real entitlement denial (Free / feature off) — not a module load miss.
        return c.json(
          {
            jsonrpc: '2.0',
            id: req.id,
            error: {
              code: -32003,
              message:
                "Feature 'ai' requires a Pro or Enterprise license. Upgrade at https://revealui.com/pricing",
            },
          },
          403,
        );
      }

      if (!scope) {
        return c.json(
          {
            jsonrpc: '2.0',
            id: req.id,
            error: { code: -32003, message: 'Authenticated task account context is unavailable' },
          },
          403,
        );
      }

      const sendParams = A2ASendTaskParamsSchema.safeParse(req.params);
      if (!sendParams.success)
        return c.json(
          { jsonrpc: '2.0', id: req.id, error: { code: -32602, message: 'Invalid task params' } },
          400,
        );
      if (agentId && !aiMod.agentCardRegistry.has(agentId))
        return c.json(
          { jsonrpc: '2.0', id: req.id, error: { code: -32003, message: 'Agent not found' } },
          400,
        );
      const definition = aiMod.agentCardRegistry.getDef(agentId ?? 'revealui-creator');
      requiresPayment = !!definition?.pricing;
      const taskParams = {
        ...sendParams.data,
        id: sendParams.data.id ?? crypto.randomUUID(),
        metadata: definition?.pricing
          ? { ...aiMod.withoutCallerReceipt(sendParams.data.metadata), pricing: definition.pricing }
          : aiMod.withoutCallerReceipt(sendParams.data.metadata),
      };
      const execution = { agentId: agentId ?? 'revealui-creator', definition };
      const payload: ReceiptPayload = {
        request: taskParams,
        binding: {
          agentId: execution.agentId,
          definitionDigest: await aiMod.getTaskExecutionFingerprint(execution),
          inputDigest: await aiMod.getTaskInputFingerprint(taskParams, execution),
        },
      };
      reservationPayload = payload;
      let prior: AgentAction | null;
      try {
        prior = await lookupReceipt(taskParams.id, scope);
      } catch {
        return c.json(
          {
            jsonrpc: '2.0',
            id: req.id,
            error: {
              code: -32011,
              message: 'Durable task storage is unavailable; execution has not started',
            },
          },
          503,
        );
      }
      if (prior) {
        const trusted = receiptPayload(prior);
        const unpaid = storedTask(prior).status.state === 'pending-payment';
        if (!unpaid) {
          return c.json(
            { jsonrpc: '2.0', id: req.id, result: await readOwnedTask(prior.id, scope, aiMod) },
            200,
          );
        }
        if (
          !trusted ||
          trusted.binding.agentId !== payload.binding.agentId ||
          trusted.binding.definitionDigest !== payload.binding.definitionDigest ||
          trusted.binding.inputDigest !== payload.binding.inputDigest
        ) {
          return c.json(
            { jsonrpc: '2.0', id: req.id, error: { code: -32001, message: 'Task not found' } },
            404,
          );
        }
      }
      preparedTask =
        (prior ? aiMod.resumePendingTask(taskParams, scope, execution) : null) ??
        aiMod.createTask(taskParams, scope, execution) ??
        undefined;
      if (!preparedTask)
        return c.json(
          { jsonrpc: '2.0', id: req.id, error: { code: -32001, message: 'Task not found' } },
          404,
        );
      if (!prior) {
        try {
          const inserted = await getClient()
            .insert(agentActions)
            .values({
              id: preparedTask.id,
              ...scope,
              version: RECEIPT_VERSION,
              agentId: execution.agentId,
              tool: req.method,
              params: payload,
              status: 'pending',
              startedAt: new Date(),
            })
            .onConflictDoNothing()
            .returning();
          if (!inserted.length) {
            aiMod.evictTask(preparedTask.id, preparedTask);
            const owned = await lookupReceipt(preparedTask.id, scope);
            return owned
              ? c.json({ jsonrpc: '2.0', id: req.id, result: storedTask(owned) }, 200)
              : c.json(
                  {
                    jsonrpc: '2.0',
                    id: req.id,
                    error: { code: -32001, message: 'Task not found' },
                  },
                  404,
                );
          }
        } catch {
          aiMod.evictTask(preparedTask.id, preparedTask);
          return c.json(
            {
              jsonrpc: '2.0',
              id: req.id,
              error: {
                code: -32011,
                message: 'Durable task storage is unavailable; execution has not started',
              },
            },
            503,
          );
        }
      }
      if (requiresPayment && prior) {
        // Reuse the durable fingerprint without mutating another continuation's
        // private lifecycle or overwriting its pending-to-running CAS input.
        const existingPending = A2ATaskSchema.safeParse(prior.result);
        if (!existingPending.success)
          return c.json(
            { jsonrpc: '2.0', id: req.id, error: { code: -32001, message: 'Task not found' } },
            404,
          );
        pendingResult = existingPending.data;
      } else if (requiresPayment) {
        aiMod.updateTaskState(preparedTask.id, 'pending-payment');
        const pending = aiMod.getTask(preparedTask.id, scope);
        const saved = pending ? await persistTask(pending, scope) : null;
        if (!saved || jsonObject(saved.metadata?.receipt).persisted !== true)
          return c.json(
            {
              jsonrpc: '2.0',
              id: req.id,
              error: {
                code: -32011,
                message: 'Pending payment receipt could not be saved; execution has not started',
              },
            },
            503,
          );
        pendingResult = { ...saved, metadata: aiMod.withoutCallerReceipt(saved.metadata) };
      }
    }

    if (!scope)
      return c.json(
        { jsonrpc: '2.0', id: req.id, error: { code: -32001, message: 'Task not found' } },
        404,
      );

    if (req.method === 'tasks/get' || req.method === 'tasks/cancel') {
      const taskId = jsonObject(req.params).id;
      if (typeof taskId !== 'string')
        return c.json(
          { jsonrpc: '2.0', id: req.id, error: { code: -32602, message: 'Invalid task params' } },
          400,
        );
      let task = await readOwnedTask(taskId, scope, aiMod);
      if (!task)
        return c.json(
          { jsonrpc: '2.0', id: req.id, error: { code: -32001, message: 'Task not found' } },
          404,
        );
      if (req.method === 'tasks/cancel' && !isTerminalTask(task)) {
        aiMod.cancelTask(taskId, scope);
        const active = aiMod.getTask(taskId, scope);
        task = await persistTask(
          active ?? {
            ...task,
            status: { ...task.status, state: 'canceled', timestamp: new Date().toISOString() },
          },
          scope,
        );
      }
      return c.json({ jsonrpc: '2.0', id: req.id, result: task }, 200);
    }

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
        const verification = await verifyPayment(paymentPayload, resource, 'a2a');
        if (verification.valid) {
          paymentVerified = true;
        } else {
          const paymentRequired = buildPaymentRequired(resource);
          trackX402PaymentRequired('a2a-invalid-proof', getAdvertisedCurrencyLabel());
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

    // An unpaid read must not call the executor or rewrite another worker's
    // phase. Its durable reservation is already saved and may now be claimed.
    if (preparedTask && requiresPayment && !paymentVerified) {
      const latest = await lookupReceipt(preparedTask.id, scope);
      if (!latest)
        return c.json(
          { jsonrpc: '2.0', id: req.id, error: { code: -32001, message: 'Task not found' } },
          404,
        );
      const task = storedTask(latest);
      if (task.status.state !== 'pending-payment')
        return c.json(
          { jsonrpc: '2.0', id: req.id, result: await readOwnedTask(latest.id, scope, aiMod) },
          200,
        );
      const resource = `${getBaseUrl(c.req.raw)}${new URL(c.req.url).pathname}`;
      const usdc = jsonObject(task.metadata?.pricing).usdc;
      const required = buildPaymentRequired(resource, typeof usdc === 'string' ? usdc : undefined);
      trackX402PaymentRequired('a2a-pending-payment', getAdvertisedCurrencyLabel());
      return c.json({ jsonrpc: '2.0', id: req.id, result: task }, 402, {
        'X-PAYMENT-REQUIRED': encodePaymentRequired(required),
      });
    }

    // Consume the private execution reservation atomically before metering.
    // An unpaid task remains pending and incurs no execution quota.
    if (preparedTask && (!requiresPayment || paymentVerified)) {
      let claimed = false;
      try {
        const saved = await getClient()
          .update(agentActions)
          .set({ status: 'running' })
          .where(
            and(
              eq(agentActions.id, preparedTask.id),
              eq(agentActions.version, RECEIPT_VERSION),
              actionScopePredicate(scope),
              eq(agentActions.status, 'pending'),
              eq(agentActions.params, reservationPayload ?? null),
              requiresPayment
                ? eq(agentActions.result, pendingResult ?? null)
                : isNull(agentActions.result),
            ),
          )
          .returning();
        claimed = saved.length > 0;
      } catch {
        return c.json(
          {
            jsonrpc: '2.0',
            id: req.id,
            error: {
              code: -32011,
              message: 'Execution claim could not be saved; execution has not started',
            },
          },
          503,
        );
      }
      if (!claimed)
        return c.json(
          { jsonrpc: '2.0', id: req.id, error: { code: -32001, message: 'Task not found' } },
          404,
        );
      if (!aiMod.claimTask(preparedTask, scope)) {
        const failed = aiMod.updateTaskState(preparedTask.id, 'failed');
        return c.json(
          {
            jsonrpc: '2.0',
            id: req.id,
            error: {
              code: -32001,
              message: 'Task not found',
              ...(failed ? { data: { task: await persistTask(failed, scope) } } : {}),
            },
          },
          404,
        );
      }
      let quotaResponse: Awaited<ReturnType<typeof requireTaskQuota>>;
      try {
        quotaResponse = await requireTaskQuota(c, async () => {
          // Execution follows the metering decision using the same one-use claim.
        });
      } catch {
        const failed = aiMod.updateTaskState(preparedTask.id, 'failed');
        return c.json(
          {
            jsonrpc: '2.0',
            id: req.id,
            error: {
              code: -32603,
              message: 'Task quota could not be checked; execution has not started',
              ...(failed ? { data: { task: await persistTask(failed, scope) } } : {}),
            },
          },
          500,
        );
      }
      if (quotaResponse instanceof Response) {
        aiMod.updateTaskState(preparedTask.id, 'failed');
        const failed = aiMod.getTask(preparedTask.id, scope);
        const receipt = failed ? await persistTask(failed, scope) : null;
        const body = await quotaResponse
          .clone()
          .json()
          .catch(() => ({}));
        return new Response(
          JSON.stringify({ ...jsonObject(body), ...(receipt ? { task: receipt } : {}) }),
          {
            status: quotaResponse.status,
            headers: quotaResponse.headers,
          },
        );
      }
    }

    // Resolve the LLM client via the GAP-360 resolver: per-account BYOK on
    // hosted, env on self-hosted. userId comes from the authenticated session
    // context only (§6.1), never from the JSON-RPC request params/body. A
    // hosted account with no usable key surfaces as HTTP 409 with an actionable
    // settings path, not a silent localhost hang.
    let llmClient: unknown;
    if (executionMethods.has(req.method) && (!requiresPayment || paymentVerified)) {
      const sessionUserId = c.get('user')?.id ?? null;
      try {
        const db = getClient();
        llmClient = await aiMod.resolveLLMClientForRequest(sessionUserId, db, {
          isHosted: detectDeploymentMode(process.env as EnvMap) === 'hosted',
          auditStore: createAuditStore(db),
        });
      } catch (err) {
        const notConfigured = asLLMNotConfigured(err);
        if (notConfigured) {
          if (preparedTask) aiMod.updateTaskState(preparedTask.id, 'failed');
          const failed = preparedTask ? aiMod.getTask(preparedTask.id, scope) : null;
          const receipt = failed ? await persistTask(failed, scope) : null;
          return c.json(
            {
              jsonrpc: '2.0',
              id: req.id,
              error: {
                code: -32010,
                message: notConfigured.error,
                data: {
                  code: notConfigured.code,
                  settingsPath: notConfigured.settingsPath,
                  ...(receipt ? { task: receipt } : {}),
                },
              },
            },
            409,
          );
        }
        // The handler produces a truthful failed task when no provider is available.
      }
    }

    // llmClient is typed as unknown because it comes from dynamically imported Pro packages;
    // the runtime type is LLMClient when present.
    type HandleParams = Parameters<typeof aiMod.handleA2AJsonRpc>;
    let result: Awaited<ReturnType<typeof aiMod.handleA2AJsonRpc>>;
    try {
      result = await aiMod.handleA2AJsonRpc(
        req,
        agentId ?? undefined,
        llmClient as HandleParams[2],
        { paymentVerified, scope, preparedTask },
      );
    } catch {
      if (preparedTask) aiMod.updateTaskState(preparedTask.id, 'failed');
      const failed = preparedTask ? aiMod.getTask(preparedTask.id, scope) : null;
      return c.json(
        {
          jsonrpc: '2.0',
          id: req.id,
          error: {
            code: -32603,
            message: 'Task execution could not complete',
            ...(failed ? { data: { task: await persistTask(failed, scope) } } : {}),
          },
        },
        500,
      );
    }
    if (result.error && preparedTask) aiMod.updateTaskState(preparedTask.id, 'failed');

    const parsedTask = A2ATaskSchema.safeParse(result.result);
    let actual = parsedTask.success
      ? parsedTask.data
      : preparedTask
        ? aiMod.getTask(preparedTask.id, scope)
        : null;
    if (actual && preparedTask && actual.id !== preparedTask.id) {
      actual = aiMod.updateTaskState(preparedTask.id, 'failed', {
        role: 'agent',
        parts: [
          {
            type: 'text',
            text: 'Execution returned an inconsistent task identity. No successful result can be acknowledged.',
          },
        ],
      });
    }
    if (actual?.status.state === 'submitted' && preparedTask) {
      actual = aiMod.updateTaskState(preparedTask.id, 'failed', {
        role: 'agent',
        parts: [
          {
            type: 'text',
            text: 'Execution returned without starting or completing the task. No successful result is available.',
          },
        ],
      });
    }
    if (actual) {
      const receipt = await persistTask(actual, scope);
      if (result.error) result.error.data = { ...jsonObject(result.error.data), task: receipt };
      else result.result = receipt;
    }
    const taskResult = result.result as A2ATask | undefined;
    const taskState = taskResult?.status?.state;

    // Pending-payment tasks: convert to HTTP 402 with X-PAYMENT-REQUIRED.
    // The route owns this protocol-layer wrapper because verifyPayment lives
    // in apps/server middleware and must not leak into the @revealui/ai package.
    if (taskState === 'pending-payment') {
      const baseUrl = getBaseUrl(c.req.raw);
      const resource = `${baseUrl}${new URL(c.req.url).pathname}`;
      const paymentRequired = buildPaymentRequired(
        resource,
        typeof jsonObject(taskResult?.metadata?.pricing).usdc === 'string'
          ? (jsonObject(taskResult?.metadata?.pricing).usdc as string)
          : undefined,
      );
      trackX402PaymentRequired('a2a-pending-payment', getAdvertisedCurrencyLabel());
      return c.json(result, 402, {
        'X-PAYMENT-REQUIRED': encodePaymentRequired(paymentRequired),
      });
    }

    return c.json(result, result.error?.code === -32001 ? 404 : 200);
  },
);

export { a2a as a2aRoutes, app as wellKnownRoutes };
