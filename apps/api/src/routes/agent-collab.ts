import { createRoute, OpenAPIHono, z } from '@revealui/openapi';
import { HTTPException } from 'hono/http-exception';
import * as Y from 'yjs';
import { getSharedRoomManager } from '../collab/shared-room-manager.js';

type Variables = {
  db: Parameters<typeof getSharedRoomManager>[0];
  user?: { id: string; role: string };
};

const AGENT_COLLAB_ROLES = new Set(['admin', 'owner', 'editor', 'agent']);

const DEFAULT_AGENT_COLOR = '#8B5CF6';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const ConnectRequestSchema = z
  .object({
    documentId: z.string().min(1),
    agentName: z.string().min(1).max(100),
    agentModel: z.string().min(1).max(100),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
  })
  .openapi('AgentConnectRequest');

const AgentIdentitySchema = z.object({
  type: z.literal('agent'),
  name: z.string(),
  model: z.string(),
  color: z.string(),
});

const ConnectResponseSchema = z
  .object({
    success: z.literal(true),
    wsUrl: z.string().openapi({ description: 'WebSocket URL for real-time collaboration' }),
    documentId: z.string(),
    identity: AgentIdentitySchema,
  })
  .openapi('AgentConnectResponse');

const EditRequestSchema = z
  .object({
    documentId: z.string().min(1),
    edit: z.object({
      type: z.enum(['insert', 'delete', 'replace-all']),
      textName: z.string().optional(),
      index: z.number().int().nonnegative().optional(),
      content: z.string().optional(),
      length: z.number().int().positive().optional(),
    }),
  })
  .openapi('AgentEditRequest');

const EditResponseSchema = z
  .object({
    success: z.literal(true),
    documentId: z.string(),
    textLength: z.number(),
  })
  .openapi('AgentEditResponse');

const DocumentIdParam = z.object({
  documentId: z.string().openapi({
    param: { name: 'documentId', in: 'path' },
    example: 'doc-001',
  }),
});

const AgentSnapshotResponseSchema = z
  .object({
    success: z.literal(true),
    documentId: z.string(),
    content: z.string(),
    textLength: z.number(),
    connectedClients: z.array(
      z.object({
        type: z.string(),
        id: z.string(),
        name: z.string(),
        color: z.string(),
        agentModel: z.string().optional(),
      }),
    ),
  })
  .openapi('AgentSnapshotResponse');

// ---------------------------------------------------------------------------
// Route definitions
// ---------------------------------------------------------------------------

const connectRoute = createRoute({
  method: 'post',
  path: '/api/collab/agent/connect',
  tags: ['Agent Collaboration'],
  summary: 'Get WebSocket URL for agent collaboration',
  request: {
    body: {
      content: { 'application/json': { schema: ConnectRequestSchema } },
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: ConnectResponseSchema } },
      description: 'WebSocket connection details',
    },
  },
});

const editRoute = createRoute({
  method: 'post',
  path: '/api/collab/agent/edit',
  tags: ['Agent Collaboration'],
  summary: 'Apply server-side edit to agent document',
  request: {
    body: {
      content: { 'application/json': { schema: EditRequestSchema } },
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: EditResponseSchema } },
      description: 'Edit applied successfully',
    },
  },
});

const agentSnapshotRoute = createRoute({
  method: 'get',
  path: '/api/collab/agent/snapshot/{documentId}',
  tags: ['Agent Collaboration'],
  summary: 'Get agent document state and connected clients',
  request: {
    params: DocumentIdParam,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: AgentSnapshotResponseSchema } },
      description: 'Agent document snapshot',
    },
  },
});

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export function createAgentCollabRoute(): OpenAPIHono<{ Variables: Variables }> {
  const app = new OpenAPIHono<{ Variables: Variables }>();
  const wsBaseUrl = process.env.WS_BASE_URL ?? 'ws://localhost:3004';

  app.openapi(connectRoute, async (c) => {
    const user = c.get('user');
    if (!user) {
      throw new HTTPException(401, { message: 'Authentication required' });
    }
    if (!AGENT_COLLAB_ROLES.has(user.role)) {
      throw new HTTPException(403, { message: 'Agent or editor role required' });
    }

    const { documentId, agentName, agentModel, color } = c.req.valid('json');
    const agentColor = color ?? DEFAULT_AGENT_COLOR;

    const identity = {
      type: 'agent' as const,
      name: agentName,
      model: agentModel,
      color: agentColor,
    };

    const params = new URLSearchParams({
      name: identity.name,
      color: identity.color,
      type: 'agent',
      agentModel: identity.model,
    });

    const wsUrl = `${wsBaseUrl}/ws/collab/${documentId}?${params.toString()}`;

    return c.json({
      success: true as const,
      wsUrl,
      documentId,
      identity,
    });
  });

  app.openapi(editRoute, async (c) => {
    const user = c.get('user');
    if (!user) {
      throw new HTTPException(401, { message: 'Authentication required' });
    }
    if (!AGENT_COLLAB_ROLES.has(user.role)) {
      throw new HTTPException(403, { message: 'Agent or editor role required' });
    }

    const { documentId, edit } = c.req.valid('json');
    const db = c.get('db');
    const manager = getSharedRoomManager(db);

    try {
      await manager.applyServerEdit(documentId, edit);

      const doc = await manager.getOrLoadDocument(documentId);
      const textName = edit.textName ?? 'content';
      const textLength = doc.getText(textName).length;

      return c.json({
        success: true as const,
        documentId,
        textLength,
      });
    } catch {
      throw new HTTPException(500, {
        message: 'Collaboration edit failed',
      });
    }
  });

  app.openapi(agentSnapshotRoute, async (c) => {
    const user = c.get('user');
    if (!user) {
      throw new HTTPException(401, { message: 'Authentication required' });
    }
    if (!AGENT_COLLAB_ROLES.has(user.role)) {
      throw new HTTPException(403, { message: 'Agent or editor role required' });
    }

    const { documentId } = c.req.valid('param');
    const db = c.get('db');
    const manager = getSharedRoomManager(db);

    const snapshot = await manager.getDocumentSnapshot(documentId);
    if (!snapshot) {
      throw new HTTPException(404, { message: 'Document not found' });
    }

    // Cap snapshot size to prevent unbounded memory allocation (10 MB)
    const MaxSnapshotBytes = 10 * 1024 * 1024;
    if (snapshot.byteLength > MaxSnapshotBytes) {
      throw new HTTPException(413, {
        message: `Document snapshot too large (${Math.round(snapshot.byteLength / 1024 / 1024)}MB exceeds ${MaxSnapshotBytes / 1024 / 1024}MB limit)`,
      });
    }

    const tempDoc = new Y.Doc();
    Y.applyUpdate(tempDoc, snapshot);
    const content = tempDoc.getText('content').toString();
    const textLength = content.length;
    tempDoc.destroy();

    const connectedClients = manager.getConnectedClients(documentId);

    return c.json({
      success: true as const,
      documentId,
      content,
      textLength,
      connectedClients,
    });
  });

  return app;
}
