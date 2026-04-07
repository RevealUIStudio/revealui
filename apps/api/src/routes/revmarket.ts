/**
 * RevMarket — Autonomous Agent Marketplace Routes (Phase 5.16)
 *
 * Extends the MCP Marketplace (Phase 5.5) with autonomous agent task execution.
 * Agents register with skills and pricing, users submit tasks, the system
 * matches tasks to capable agents, and results are delivered with billing.
 *
 * Routes:
 *   GET    /api/revmarket/agents              — browse published agents (public)
 *   GET    /api/revmarket/agents/:id          — agent detail + skills (public)
 *   POST   /api/revmarket/agents              — publish an agent (auth required)
 *   PATCH  /api/revmarket/agents/:id          — update own agent (auth required)
 *   DELETE /api/revmarket/agents/:id          — unpublish own agent (auth required)
 *   POST   /api/revmarket/agents/:id/skills   — add a skill to agent (auth required)
 *   POST   /api/revmarket/tasks               — submit a task (auth required)
 *   GET    /api/revmarket/tasks/:id           — get task status/result (auth required)
 *   POST   /api/revmarket/tasks/:id/cancel    — cancel a pending task (auth required)
 *   POST   /api/revmarket/agents/:id/reviews  — leave a review (auth required)
 *   GET    /api/revmarket/agents/:id/reviews  — list reviews for an agent (public)
 */

import { logger } from '@revealui/core/observability/logger';
import { getClient } from '@revealui/db';
import {
  agentReviews,
  agentSkills,
  marketplaceAgents,
  type NewAgentReview,
  type NewAgentSkill,
  type NewMarketplaceAgent,
  type NewTaskSubmission,
  taskSubmissions,
} from '@revealui/db/schema';
import { createRoute, OpenAPIHono, z } from '@revealui/openapi';
import { and, desc, eq, ilike, sql } from 'drizzle-orm';
import { HTTPException } from 'hono/http-exception';
import { authMiddleware } from '../middleware/auth.js';

// =============================================================================
// Helpers
// =============================================================================

interface UserContext {
  id: string;
  email: string | null;
  name: string;
  role: string;
}

const app = new OpenAPIHono<{ Variables: { user: UserContext | undefined } }>();

/** Generate a short RevMarket ID with a given prefix */
function generateId(prefix: string): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = `${prefix}_`;
  const targetLength = prefix.length + 1 + 12; // prefix + underscore + 12 chars
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  let i = 0;
  while (id.length < targetLength && i < bytes.length) {
    const idx = bytes[i++] & 63;
    if (idx < chars.length) {
      id += chars[idx];
    }
  }
  while (id.length < targetLength) {
    const [b] = crypto.getRandomValues(new Uint8Array(1));
    const idx = b & 63;
    if (idx < chars.length) id += chars[idx];
  }
  return id;
}

const VALID_CATEGORIES = ['coding', 'writing', 'data', 'design', 'other'] as const;
const VALID_PRICING_MODELS = ['per-task', 'per-minute', 'flat'] as const;
const VALID_STATUSES = ['draft', 'published', 'suspended', 'deprecated'] as const;

// =============================================================================
// Agent Browse & Discovery (public)
// =============================================================================

/** GET /agents — browse published agents */
app.openapi(
  createRoute({
    method: 'get',
    path: '/agents',
    tags: ['revmarket'],
    summary: 'Browse published marketplace agents',
    request: {
      query: z.object({
        category: z.enum(VALID_CATEGORIES).optional(),
        search: z.string().max(100).optional(),
        sortBy: z.enum(['rating', 'taskCount', 'createdAt']).optional(),
        limit: z.string().optional(),
        offset: z.string().optional(),
      }),
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              agents: z.array(z.unknown()),
              total: z.number(),
              limit: z.number(),
              offset: z.number(),
            }),
          },
        },
        description: 'List of published agents',
      },
    },
  }),
  async (c) => {
    const db = getClient();
    const query = c.req.valid('query');

    const rawLimit = Number(query.limit ?? 20);
    const rawOffset = Number(query.offset ?? 0);
    const limit =
      Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), 50) : 20;
    const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? Math.floor(rawOffset) : 0;

    const conditions = [eq(marketplaceAgents.status, 'published')];
    if (query.category) {
      conditions.push(eq(marketplaceAgents.category, query.category));
    }
    if (query.search) {
      conditions.push(ilike(marketplaceAgents.name, `%${query.search}%`));
    }

    const sortColumn =
      query.sortBy === 'rating'
        ? desc(marketplaceAgents.rating)
        : query.sortBy === 'taskCount'
          ? desc(marketplaceAgents.taskCount)
          : desc(marketplaceAgents.createdAt);

    const [rows, countResult] = await Promise.all([
      db
        .select({
          id: marketplaceAgents.id,
          name: marketplaceAgents.name,
          description: marketplaceAgents.description,
          category: marketplaceAgents.category,
          tags: marketplaceAgents.tags,
          pricingModel: marketplaceAgents.pricingModel,
          basePriceUsdc: marketplaceAgents.basePriceUsdc,
          rating: marketplaceAgents.rating,
          reviewCount: marketplaceAgents.reviewCount,
          taskCount: marketplaceAgents.taskCount,
          version: marketplaceAgents.version,
          createdAt: marketplaceAgents.createdAt,
        })
        .from(marketplaceAgents)
        .where(and(...conditions))
        .orderBy(sortColumn)
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(marketplaceAgents)
        .where(and(...conditions)),
    ]);

    return c.json({ agents: rows, total: countResult[0]?.count ?? 0, limit, offset });
  },
);

/** GET /agents/:id — agent detail with skills */
app.openapi(
  createRoute({
    method: 'get',
    path: '/agents/{id}',
    tags: ['revmarket'],
    summary: 'Get agent detail with skills',
    request: {
      params: z.object({ id: z.string() }),
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ agent: z.unknown(), skills: z.array(z.unknown()) }),
          },
        },
        description: 'Agent detail',
      },
      404: {
        content: {
          'application/json': {
            schema: z.object({ error: z.string() }),
          },
        },
        description: 'Agent not found',
      },
    },
  }),
  // @ts-expect-error -- OpenAPI response union narrowing
  async (c) => {
    const { id } = c.req.valid('param');
    const db = getClient();

    const [agent] = await db
      .select()
      .from(marketplaceAgents)
      .where(eq(marketplaceAgents.id, id))
      .limit(1);
    if (!agent) throw new HTTPException(404, { message: 'Agent not found' });

    const skills = await db.select().from(agentSkills).where(eq(agentSkills.agentId, id));

    return c.json({ agent, skills });
  },
);

// =============================================================================
// Agent Publishing (auth required)
// =============================================================================

const PublishAgentSchema = z.object({
  name: z.string().min(3).max(80),
  description: z.string().min(10).max(500),
  definition: z.record(z.string(), z.unknown()),
  category: z.enum(VALID_CATEGORIES).optional().default('other'),
  tags: z.array(z.string().max(30)).max(10).optional().default([]),
  pricingModel: z.enum(VALID_PRICING_MODELS).optional().default('per-task'),
  basePriceUsdc: z.string().optional().default('0.10'),
  maxExecutionSecs: z.number().int().min(10).max(3600).optional().default(300),
  resourceLimits: z
    .object({
      maxMemoryMb: z.number().int().min(64).max(4096),
      maxCpuPercent: z.number().int().min(5).max(100),
    })
    .optional()
    .default({ maxMemoryMb: 512, maxCpuPercent: 50 }),
});

/** POST /agents — publish a new agent */
app.openapi(
  createRoute({
    method: 'post',
    path: '/agents',
    tags: ['revmarket'],
    summary: 'Publish a new marketplace agent',
    request: {
      body: {
        content: {
          'application/json': { schema: PublishAgentSchema },
        },
      },
    },
    middleware: [authMiddleware({ required: true })] as const,
    responses: {
      201: {
        content: {
          'application/json': {
            schema: z.object({ agent: z.unknown() }),
          },
        },
        description: 'Agent published',
      },
      401: {
        content: {
          'application/json': { schema: z.object({ error: z.string() }) },
        },
        description: 'Unauthorized',
      },
    },
  }),
  async (c) => {
    const user = c.get('user');
    if (!user) throw new HTTPException(401, { message: 'Unauthorized' });

    const data = c.req.valid('json');
    const id = generateId('agent');
    const now = new Date();

    const newAgent: NewMarketplaceAgent = {
      id,
      name: data.name,
      description: data.description,
      publisherId: user.id,
      definition: data.definition,
      category: data.category,
      tags: data.tags,
      pricingModel: data.pricingModel,
      basePriceUsdc: data.basePriceUsdc,
      maxExecutionSecs: data.maxExecutionSecs,
      resourceLimits: data.resourceLimits,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };

    const db = getClient();
    const [created] = await db.insert(marketplaceAgents).values(newAgent).returning();

    logger.info('RevMarket agent published', { agentId: id, publisherId: user.id });

    return c.json({ agent: created }, 201);
  },
);

const UpdateAgentSchema = z.object({
  name: z.string().min(3).max(80).optional(),
  description: z.string().min(10).max(500).optional(),
  definition: z.record(z.string(), z.unknown()).optional(),
  category: z.enum(VALID_CATEGORIES).optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
  pricingModel: z.enum(VALID_PRICING_MODELS).optional(),
  basePriceUsdc: z.string().optional(),
  maxExecutionSecs: z.number().int().min(10).max(3600).optional(),
  status: z.enum(VALID_STATUSES).optional(),
});

/** PATCH /agents/:id — update own agent */
app.openapi(
  createRoute({
    method: 'patch',
    path: '/agents/{id}',
    tags: ['revmarket'],
    summary: 'Update own marketplace agent',
    request: {
      params: z.object({ id: z.string() }),
      body: {
        content: {
          'application/json': { schema: UpdateAgentSchema },
        },
      },
    },
    middleware: [authMiddleware({ required: true })] as const,
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ agent: z.unknown() }),
          },
        },
        description: 'Agent updated',
      },
      401: {
        content: {
          'application/json': { schema: z.object({ error: z.string() }) },
        },
        description: 'Unauthorized',
      },
      403: {
        content: {
          'application/json': { schema: z.object({ error: z.string() }) },
        },
        description: 'Forbidden',
      },
      404: {
        content: {
          'application/json': { schema: z.object({ error: z.string() }) },
        },
        description: 'Agent not found',
      },
    },
  }),
  // @ts-expect-error -- OpenAPI response union narrowing
  async (c) => {
    const user = c.get('user');
    if (!user) throw new HTTPException(401, { message: 'Unauthorized' });

    const { id } = c.req.valid('param');
    const data = c.req.valid('json');
    const db = getClient();

    const [existing] = await db
      .select({ publisherId: marketplaceAgents.publisherId })
      .from(marketplaceAgents)
      .where(eq(marketplaceAgents.id, id))
      .limit(1);

    if (!existing) throw new HTTPException(404, { message: 'Agent not found' });
    if (existing.publisherId !== user.id && user.role !== 'admin') {
      throw new HTTPException(403, { message: 'Forbidden' });
    }

    const [updated] = await db
      .update(marketplaceAgents)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(marketplaceAgents.id, id))
      .returning();

    return c.json({ agent: updated });
  },
);

/** DELETE /agents/:id — unpublish own agent */
app.openapi(
  createRoute({
    method: 'delete',
    path: '/agents/{id}',
    tags: ['revmarket'],
    summary: 'Unpublish own marketplace agent',
    request: {
      params: z.object({ id: z.string() }),
    },
    middleware: [authMiddleware({ required: true })] as const,
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.boolean() }),
          },
        },
        description: 'Agent unpublished',
      },
      401: {
        content: {
          'application/json': { schema: z.object({ error: z.string() }) },
        },
        description: 'Unauthorized',
      },
      403: {
        content: {
          'application/json': { schema: z.object({ error: z.string() }) },
        },
        description: 'Forbidden',
      },
      404: {
        content: {
          'application/json': { schema: z.object({ error: z.string() }) },
        },
        description: 'Agent not found',
      },
    },
  }),
  // @ts-expect-error -- OpenAPI response union narrowing
  async (c) => {
    const user = c.get('user');
    if (!user) throw new HTTPException(401, { message: 'Unauthorized' });

    const { id } = c.req.valid('param');
    const db = getClient();

    const [existing] = await db
      .select({ publisherId: marketplaceAgents.publisherId })
      .from(marketplaceAgents)
      .where(eq(marketplaceAgents.id, id))
      .limit(1);

    if (!existing) throw new HTTPException(404, { message: 'Agent not found' });
    if (existing.publisherId !== user.id && user.role !== 'admin') {
      throw new HTTPException(403, { message: 'Forbidden' });
    }

    await db
      .update(marketplaceAgents)
      .set({ status: 'suspended', updatedAt: new Date() })
      .where(eq(marketplaceAgents.id, id));

    logger.info('RevMarket agent unpublished', { agentId: id, by: user.id });
    return c.json({ success: true });
  },
);

// =============================================================================
// Agent Skills
// =============================================================================

const AddSkillSchema = z.object({
  name: z.string().min(2).max(60),
  description: z.string().min(10).max(300),
  inputSchema: z.record(z.string(), z.unknown()).optional(),
  outputSchema: z.record(z.string(), z.unknown()).optional(),
  examples: z
    .array(z.object({ input: z.unknown(), output: z.unknown() }))
    .max(5)
    .optional()
    .default([]),
});

/** POST /agents/:id/skills — add a skill to an agent */
app.openapi(
  createRoute({
    method: 'post',
    path: '/agents/{id}/skills',
    tags: ['revmarket'],
    summary: 'Add a skill to a marketplace agent',
    request: {
      params: z.object({ id: z.string() }),
      body: {
        content: {
          'application/json': { schema: AddSkillSchema },
        },
      },
    },
    middleware: [authMiddleware({ required: true })] as const,
    responses: {
      201: {
        content: {
          'application/json': {
            schema: z.object({ skill: z.unknown() }),
          },
        },
        description: 'Skill added',
      },
      401: {
        content: {
          'application/json': { schema: z.object({ error: z.string() }) },
        },
        description: 'Unauthorized',
      },
      403: {
        content: {
          'application/json': { schema: z.object({ error: z.string() }) },
        },
        description: 'Forbidden',
      },
      404: {
        content: {
          'application/json': { schema: z.object({ error: z.string() }) },
        },
        description: 'Agent not found',
      },
    },
  }),
  async (c) => {
    const user = c.get('user');
    if (!user) throw new HTTPException(401, { message: 'Unauthorized' });

    const { id: agentId } = c.req.valid('param');
    const data = c.req.valid('json');
    const db = getClient();

    const [agent] = await db
      .select({ publisherId: marketplaceAgents.publisherId })
      .from(marketplaceAgents)
      .where(eq(marketplaceAgents.id, agentId))
      .limit(1);

    if (!agent) throw new HTTPException(404, { message: 'Agent not found' });
    if (agent.publisherId !== user.id && user.role !== 'admin') {
      throw new HTTPException(403, { message: 'Forbidden' });
    }

    const skillId = generateId('skill');
    const newSkill: NewAgentSkill = {
      id: skillId,
      agentId,
      name: data.name,
      description: data.description,
      inputSchema: data.inputSchema as Record<string, unknown> | undefined,
      outputSchema: data.outputSchema as Record<string, unknown> | undefined,
      examples: data.examples as Array<{ input: unknown; output: unknown }>,
      createdAt: new Date(),
    };

    const [created] = await db.insert(agentSkills).values(newSkill).returning();

    logger.info('RevMarket skill added', { skillId, agentId });
    return c.json({ skill: created }, 201);
  },
);

// =============================================================================
// Task Submission & Lifecycle
// =============================================================================

const SubmitTaskSchema = z.object({
  agentId: z.string().optional(),
  skillName: z.string().min(2).max(60),
  input: z.record(z.string(), z.unknown()),
  priority: z.number().int().min(1).max(5).optional().default(3),
  paymentMethod: z.string().optional(),
});

/** POST /tasks — submit a task */
app.openapi(
  createRoute({
    method: 'post',
    path: '/tasks',
    tags: ['revmarket'],
    summary: 'Submit a task to the agent marketplace',
    request: {
      body: {
        content: {
          'application/json': { schema: SubmitTaskSchema },
        },
      },
    },
    middleware: [authMiddleware({ required: true })] as const,
    responses: {
      201: {
        content: {
          'application/json': {
            schema: z.object({ task: z.unknown() }),
          },
        },
        description: 'Task submitted',
      },
      401: {
        content: {
          'application/json': { schema: z.object({ error: z.string() }) },
        },
        description: 'Unauthorized',
      },
      404: {
        content: {
          'application/json': { schema: z.object({ error: z.string() }) },
        },
        description: 'Agent not found',
      },
    },
  }),
  async (c) => {
    const user = c.get('user');
    if (!user) throw new HTTPException(401, { message: 'Unauthorized' });

    const data = c.req.valid('json');
    const db = getClient();

    // If a specific agent is requested, verify it exists and is published
    let assignedAgentId = data.agentId ?? null;
    let costUsdc: string | null = null;

    if (assignedAgentId) {
      const [agent] = await db
        .select({
          id: marketplaceAgents.id,
          status: marketplaceAgents.status,
          basePriceUsdc: marketplaceAgents.basePriceUsdc,
        })
        .from(marketplaceAgents)
        .where(eq(marketplaceAgents.id, assignedAgentId))
        .limit(1);

      if (!agent || agent.status !== 'published') {
        throw new HTTPException(404, { message: 'Agent not found or unavailable' });
      }
      costUsdc = agent.basePriceUsdc;
    } else {
      // Auto-match: find a published agent with the requested skill
      const matched = await db
        .select({
          agentId: agentSkills.agentId,
          basePriceUsdc: marketplaceAgents.basePriceUsdc,
        })
        .from(agentSkills)
        .innerJoin(marketplaceAgents, eq(agentSkills.agentId, marketplaceAgents.id))
        .where(and(eq(agentSkills.name, data.skillName), eq(marketplaceAgents.status, 'published')))
        .orderBy(desc(marketplaceAgents.rating))
        .limit(1);

      if (matched.length > 0) {
        assignedAgentId = matched[0].agentId;
        costUsdc = matched[0].basePriceUsdc;
      }
    }

    const taskId = generateId('task');
    const now = new Date();

    const newTask: NewTaskSubmission = {
      id: taskId,
      submitterId: user.id,
      agentId: assignedAgentId,
      skillName: data.skillName,
      input: data.input,
      priority: data.priority,
      costUsdc,
      paymentMethod: data.paymentMethod ?? null,
      status: assignedAgentId ? 'queued' : 'pending',
      createdAt: now,
      updatedAt: now,
    };

    const [created] = await db.insert(taskSubmissions).values(newTask).returning();

    logger.info('RevMarket task submitted', {
      taskId,
      submitterId: user.id,
      agentId: assignedAgentId,
      skillName: data.skillName,
    });

    return c.json({ task: created }, 201);
  },
);

/** GET /tasks/:id — get task status and result */
app.openapi(
  createRoute({
    method: 'get',
    path: '/tasks/{id}',
    tags: ['revmarket'],
    summary: 'Get task status and result',
    request: {
      params: z.object({ id: z.string() }),
    },
    middleware: [authMiddleware({ required: true })] as const,
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ task: z.unknown() }),
          },
        },
        description: 'Task detail',
      },
      401: {
        content: {
          'application/json': { schema: z.object({ error: z.string() }) },
        },
        description: 'Unauthorized',
      },
      403: {
        content: {
          'application/json': { schema: z.object({ error: z.string() }) },
        },
        description: 'Forbidden',
      },
      404: {
        content: {
          'application/json': { schema: z.object({ error: z.string() }) },
        },
        description: 'Task not found',
      },
    },
  }),
  // @ts-expect-error -- OpenAPI response union narrowing
  async (c) => {
    const user = c.get('user');
    if (!user) throw new HTTPException(401, { message: 'Unauthorized' });

    const { id } = c.req.valid('param');
    const db = getClient();

    const [task] = await db
      .select()
      .from(taskSubmissions)
      .where(eq(taskSubmissions.id, id))
      .limit(1);

    if (!task) throw new HTTPException(404, { message: 'Task not found' });
    if (task.submitterId !== user.id && user.role !== 'admin') {
      throw new HTTPException(403, { message: 'Forbidden' });
    }

    return c.json({ task });
  },
);

/** POST /tasks/:id/cancel — cancel a pending/queued task */
app.openapi(
  createRoute({
    method: 'post',
    path: '/tasks/{id}/cancel',
    tags: ['revmarket'],
    summary: 'Cancel a pending or queued task',
    request: {
      params: z.object({ id: z.string() }),
    },
    middleware: [authMiddleware({ required: true })] as const,
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({ success: z.boolean() }),
          },
        },
        description: 'Task cancelled',
      },
      400: {
        content: {
          'application/json': { schema: z.object({ error: z.string() }) },
        },
        description: 'Task cannot be cancelled',
      },
      401: {
        content: {
          'application/json': { schema: z.object({ error: z.string() }) },
        },
        description: 'Unauthorized',
      },
      403: {
        content: {
          'application/json': { schema: z.object({ error: z.string() }) },
        },
        description: 'Forbidden',
      },
      404: {
        content: {
          'application/json': { schema: z.object({ error: z.string() }) },
        },
        description: 'Task not found',
      },
    },
  }),
  // @ts-expect-error -- OpenAPI response union narrowing
  async (c) => {
    const user = c.get('user');
    if (!user) throw new HTTPException(401, { message: 'Unauthorized' });

    const { id } = c.req.valid('param');
    const db = getClient();

    const [task] = await db
      .select({ submitterId: taskSubmissions.submitterId, status: taskSubmissions.status })
      .from(taskSubmissions)
      .where(eq(taskSubmissions.id, id))
      .limit(1);

    if (!task) throw new HTTPException(404, { message: 'Task not found' });
    if (task.submitterId !== user.id && user.role !== 'admin') {
      throw new HTTPException(403, { message: 'Forbidden' });
    }

    const cancellable: string[] = ['pending', 'queued'];
    if (!cancellable.includes(task.status)) {
      throw new HTTPException(400, {
        message: `Cannot cancel task in '${task.status}' state`,
      });
    }

    await db
      .update(taskSubmissions)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(taskSubmissions.id, id));

    logger.info('RevMarket task cancelled', { taskId: id, by: user.id });
    return c.json({ success: true });
  },
);

// =============================================================================
// Reviews
// =============================================================================

const SubmitReviewSchema = z.object({
  taskId: z.string().optional(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

/** POST /agents/:id/reviews — leave a review */
app.openapi(
  createRoute({
    method: 'post',
    path: '/agents/{id}/reviews',
    tags: ['revmarket'],
    summary: 'Leave a review for an agent',
    request: {
      params: z.object({ id: z.string() }),
      body: {
        content: {
          'application/json': { schema: SubmitReviewSchema },
        },
      },
    },
    middleware: [authMiddleware({ required: true })] as const,
    responses: {
      201: {
        content: {
          'application/json': {
            schema: z.object({ review: z.unknown() }),
          },
        },
        description: 'Review submitted',
      },
      401: {
        content: {
          'application/json': { schema: z.object({ error: z.string() }) },
        },
        description: 'Unauthorized',
      },
      404: {
        content: {
          'application/json': { schema: z.object({ error: z.string() }) },
        },
        description: 'Agent not found',
      },
    },
  }),
  async (c) => {
    const user = c.get('user');
    if (!user) throw new HTTPException(401, { message: 'Unauthorized' });

    const { id: agentId } = c.req.valid('param');
    const data = c.req.valid('json');
    const db = getClient();

    // Verify the agent exists
    const [agent] = await db
      .select({ id: marketplaceAgents.id })
      .from(marketplaceAgents)
      .where(eq(marketplaceAgents.id, agentId))
      .limit(1);

    if (!agent) throw new HTTPException(404, { message: 'Agent not found' });

    // Check if this is a verified purchase (user completed a task with this agent)
    let verified = 0;
    if (data.taskId) {
      const [task] = await db
        .select({ submitterId: taskSubmissions.submitterId, status: taskSubmissions.status })
        .from(taskSubmissions)
        .where(
          and(
            eq(taskSubmissions.id, data.taskId),
            eq(taskSubmissions.agentId, agentId),
            eq(taskSubmissions.submitterId, user.id),
          ),
        )
        .limit(1);

      if (task?.status === 'completed') {
        verified = 1;
      }
    }

    const reviewId = generateId('rev');
    const newReview: NewAgentReview = {
      id: reviewId,
      agentId,
      reviewerId: user.id,
      taskId: data.taskId ?? null,
      rating: data.rating,
      comment: data.comment ?? null,
      verified,
      createdAt: new Date(),
    };

    const [created] = await db.insert(agentReviews).values(newReview).returning();

    // Update agent's aggregate rating
    const [agg] = await db
      .select({
        avgRating: sql<number>`AVG(${agentReviews.rating})`,
        count: sql<number>`COUNT(*)`,
      })
      .from(agentReviews)
      .where(eq(agentReviews.agentId, agentId));

    if (agg) {
      await db
        .update(marketplaceAgents)
        .set({
          rating: Number(agg.avgRating?.toFixed(2) ?? 0),
          reviewCount: Number(agg.count ?? 0),
          updatedAt: new Date(),
        })
        .where(eq(marketplaceAgents.id, agentId));
    }

    logger.info('RevMarket review submitted', { reviewId, agentId, rating: data.rating });
    return c.json({ review: created }, 201);
  },
);

/** GET /agents/:id/reviews — list reviews for an agent */
app.openapi(
  createRoute({
    method: 'get',
    path: '/agents/{id}/reviews',
    tags: ['revmarket'],
    summary: 'List reviews for an agent',
    request: {
      params: z.object({ id: z.string() }),
      query: z.object({
        limit: z.string().optional(),
        offset: z.string().optional(),
      }),
    },
    responses: {
      200: {
        content: {
          'application/json': {
            schema: z.object({
              reviews: z.array(z.unknown()),
              limit: z.number(),
              offset: z.number(),
            }),
          },
        },
        description: 'Reviews list',
      },
    },
  }),
  async (c) => {
    const { id: agentId } = c.req.valid('param');
    const query = c.req.valid('query');
    const db = getClient();

    const rawLimit = Number(query.limit ?? 20);
    const rawOffset = Number(query.offset ?? 0);
    const limit =
      Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), 50) : 20;
    const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? Math.floor(rawOffset) : 0;

    const reviews = await db
      .select({
        id: agentReviews.id,
        rating: agentReviews.rating,
        comment: agentReviews.comment,
        verified: agentReviews.verified,
        createdAt: agentReviews.createdAt,
      })
      .from(agentReviews)
      .where(eq(agentReviews.agentId, agentId))
      .orderBy(desc(agentReviews.createdAt))
      .limit(limit)
      .offset(offset);

    return c.json({ reviews, limit, offset });
  },
);

export default app;
