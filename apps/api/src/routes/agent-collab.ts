import { Hono } from 'hono';
import * as Y from 'yjs';
import { z } from 'zod';
import { getSharedRoomManager } from '../collab/shared-room-manager.js';

type Variables = {
  db: Parameters<typeof getSharedRoomManager>[0];
};

const DEFAULT_AGENT_COLOR = '#8B5CF6';

const ConnectRequestSchema = z.object({
  documentId: z.string().min(1),
  agentName: z.string().min(1).max(100),
  agentModel: z.string().min(1).max(100),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
});

const EditRequestSchema = z.object({
  documentId: z.string().min(1),
  edit: z.object({
    type: z.enum(['insert', 'delete', 'replace-all']),
    textName: z.string().optional(),
    index: z.number().int().nonnegative().optional(),
    content: z.string().optional(),
    length: z.number().int().positive().optional(),
  }),
});

// biome-ignore lint/style/useNamingConvention: Hono requires PascalCase `Variables` key in generic context
export function createAgentCollabRoute(): Hono<{ Variables: Variables }> {
  // biome-ignore lint/style/useNamingConvention: Hono requires PascalCase `Variables` key in generic context
  const app = new Hono<{ Variables: Variables }>();
  const wsBaseUrl = process.env.WS_BASE_URL ?? 'ws://localhost:3004';

  app.post('/api/collab/agent/connect', async (c) => {
    const body = await c.req.json();
    const parsed = ConnectRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ success: false, error: parsed.error.message }, 400);
    }

    const { documentId, agentName, agentModel, color } = parsed.data;
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
      success: true,
      wsUrl,
      documentId,
      identity,
    });
  });

  app.post('/api/collab/agent/edit', async (c) => {
    const body = await c.req.json();
    const parsed = EditRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ success: false, error: parsed.error.message }, 400);
    }

    const { documentId, edit } = parsed.data;
    const db = c.get('db');
    const manager = getSharedRoomManager(db);

    try {
      await manager.applyServerEdit(documentId, edit);

      const doc = await manager.getOrLoadDocument(documentId);
      const textName = edit.textName ?? 'content';
      const textLength = doc.getText(textName).length;

      return c.json({
        success: true,
        documentId,
        textLength,
      });
    } catch (err) {
      return c.json(
        {
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        },
        500,
      );
    }
  });

  app.get('/api/collab/agent/snapshot/:documentId', async (c) => {
    const documentId = c.req.param('documentId');
    const db = c.get('db');
    const manager = getSharedRoomManager(db);

    const snapshot = await manager.getDocumentSnapshot(documentId);
    if (!snapshot) {
      return c.json({ success: false, error: 'Document not found' }, 404);
    }

    const tempDoc = new Y.Doc();
    Y.applyUpdate(tempDoc, snapshot);
    const content = tempDoc.getText('content').toString();
    const textLength = content.length;
    tempDoc.destroy();

    const connectedClients = manager.getConnectedClients(documentId);

    return c.json({
      success: true,
      documentId,
      content,
      textLength,
      connectedClients,
    });
  });

  return app;
}
