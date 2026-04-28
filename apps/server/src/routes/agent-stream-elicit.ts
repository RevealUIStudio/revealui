/**
 * Agent-stream elicitation response endpoint.
 *
 * `POST /api/agent-stream/elicit`
 *
 * When an MCP server connected to an agent run at `/api/agent-stream`
 * calls `elicitation/create`, the route's elicitation handler writes an
 * `elicitation_request` chunk to the SSE stream and parks on a pending
 * promise keyed on `(sessionId, elicitationId)`. The client POSTs the
 * user's decision here; this route resolves the pending promise so the
 * MCP server's request returns and the agent turn continues.
 *
 * Auth is required. The session's `userId` must match the caller's
 * session so one admin can't resolve another admin's elicitation. When
 * the session was created by a guest-path agent run (no `userId`), any
 * authenticated admin may resolve — no per-admin scoping to enforce.
 *
 * A.2b of the post-v1 MCP arc.
 */

import { createRoute, OpenAPIHono, z } from '@revealui/openapi';
import { getAgentRunSession, resolveElicitation } from '../lib/agent-run-sessions.js';

type Variables = {
  user?: { id: string; role: string };
};

const app = new OpenAPIHono<{ Variables: Variables }>();

/**
 * MCP elicitation content is restricted by the spec's `ElicitResult`
 * schema to primitive values + arrays of strings. No nested objects, no
 * numbers-as-strings. Matches `@modelcontextprotocol/sdk`'s shape.
 */
const ElicitContentValue = z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]);

const ElicitResponseBody = z.object({
  sessionId: z.string().uuid(),
  elicitationId: z.string().min(1).max(128),
  action: z.enum(['accept', 'decline', 'cancel']),
  content: z.record(z.string(), ElicitContentValue).optional(),
});

const elicitRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['agent'],
  summary: 'Submit an elicitation response for an in-flight agent run',
  description:
    'Resolves a pending `elicitation/create` request issued by an MCP server during an agent-stream run. The client provides `{ sessionId, elicitationId, action, content? }`; the server maps the session to the pending handler promise and resolves it.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: ElicitResponseBody,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({ success: z.literal(true) }),
        },
      },
      description: 'Elicitation resolved',
    },
    401: {
      content: {
        'application/json': {
          schema: z.object({ success: z.literal(false), error: z.string() }),
        },
      },
      description: 'Authentication required',
    },
    403: {
      content: {
        'application/json': {
          schema: z.object({ success: z.literal(false), error: z.string() }),
        },
      },
      description: 'Session belongs to a different user',
    },
    404: {
      content: {
        'application/json': {
          schema: z.object({ success: z.literal(false), error: z.string() }),
        },
      },
      description: 'No pending elicitation matching the supplied ids',
    },
  },
});

app.openapi(elicitRoute, async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false as const, error: 'Authentication required' }, 401);
  }

  const body = c.req.valid('json');

  const session = getAgentRunSession(body.sessionId);
  if (!session) {
    return c.json(
      { success: false as const, error: 'No pending elicitation for this session' },
      404,
    );
  }
  if (session.userId !== user.id) {
    return c.json({ success: false as const, error: 'Session belongs to a different user' }, 403);
  }

  const resolved = resolveElicitation(body.sessionId, body.elicitationId, {
    action: body.action,
    ...(body.action === 'accept' && body.content ? { content: body.content } : {}),
  });
  if (!resolved) {
    return c.json(
      { success: false as const, error: 'Elicitation id not found or already resolved' },
      404,
    );
  }

  return c.json({ success: true as const }, 200);
});

export default app;
