import { logger } from '@revealui/core/observability/logger';
import { createRoute, OpenAPIHono, z } from '@revealui/openapi';
import { HTTPException } from 'hono/http-exception';
import * as Y from 'yjs';
import { createYjsPersistence } from '../collab/persistence.js';
import type { getSharedRoomManager } from '../collab/shared-room-manager.js';

type Variables = {
  db: Parameters<typeof getSharedRoomManager>[0];
  user?: { id: string; role: string };
};

const COLLAB_ROLES = new Set(['admin', 'owner', 'editor']);

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const UpdateRequestSchema = z
  .object({
    documentId: z.string().min(1),
    update: z.string().min(1).openapi({ description: 'Base64-encoded Yjs binary update' }),
  })
  .openapi('CollabUpdateRequest');

const UpdateResponseSchema = z
  .object({
    success: z.literal(true),
  })
  .openapi('CollabUpdateResponse');

const DocumentIdParam = z.object({
  documentId: z.string().openapi({
    param: { name: 'documentId', in: 'path' },
    example: 'doc-001',
  }),
});

const SnapshotResponseSchema = z
  .object({
    success: z.literal(true),
    documentId: z.string(),
    state: z.string().openapi({ description: 'Base64-encoded Yjs document state' }),
  })
  .openapi('CollabSnapshotResponse');

// ---------------------------------------------------------------------------
// Route definitions
// ---------------------------------------------------------------------------

const updateRoute = createRoute({
  method: 'post',
  path: '/api/collab/update',
  tags: ['Collaboration'],
  summary: 'Apply a Yjs binary update to a document',
  request: {
    body: {
      content: { 'application/json': { schema: UpdateRequestSchema } },
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: UpdateResponseSchema } },
      description: 'Update applied successfully',
    },
  },
});

const snapshotRoute = createRoute({
  method: 'get',
  path: '/api/collab/snapshot/{documentId}',
  tags: ['Collaboration'],
  summary: 'Get current Yjs document state as base64',
  request: {
    params: DocumentIdParam,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SnapshotResponseSchema } },
      description: 'Document snapshot',
    },
  },
});

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export function createCollabRoute(): OpenAPIHono<{ Variables: Variables }> {
  const app = new OpenAPIHono<{ Variables: Variables }>();

  app.openapi(updateRoute, async (c) => {
    const user = c.get('user');
    if (!user) {
      throw new HTTPException(401, { message: 'Authentication required' });
    }
    if (!COLLAB_ROLES.has(user.role)) {
      throw new HTTPException(403, { message: 'Editor role or higher required for collaboration' });
    }

    const { documentId, update } = c.req.valid('json');

    let updateBytes: Uint8Array;
    try {
      updateBytes = new Uint8Array(Buffer.from(update, 'base64'));
    } catch {
      throw new HTTPException(400, { message: 'Invalid update encoding — expected base64' });
    }

    const db = c.get('db');
    const persistence = createYjsPersistence(db);

    try {
      const doc = new Y.Doc();
      await persistence.loadDocument(documentId, doc);
      Y.applyUpdate(doc, updateBytes);
      await persistence.saveDocument(documentId, doc);
      doc.destroy();
      return c.json({ success: true as const });
    } catch (err) {
      logger.error(
        'Failed to apply collab update',
        err instanceof Error ? err : new Error(String(err)),
        { documentId },
      );
      throw new HTTPException(500, { message: 'Failed to apply update' });
    }
  });

  app.openapi(snapshotRoute, async (c) => {
    const user = c.get('user');
    if (!user) {
      throw new HTTPException(401, { message: 'Authentication required' });
    }
    if (!COLLAB_ROLES.has(user.role)) {
      throw new HTTPException(403, { message: 'Editor role or higher required for collaboration' });
    }
    const { documentId } = c.req.valid('param');
    const db = c.get('db');
    const persistence = createYjsPersistence(db);

    try {
      const doc = new Y.Doc();
      await persistence.loadDocument(documentId, doc);
      const state = Y.encodeStateAsUpdate(doc);
      doc.destroy();

      // Yjs empty doc encodes as ≤2 bytes (version header only)
      const YjsEmptyDocSize = 2;
      if (state.length <= YjsEmptyDocSize) {
        throw new HTTPException(404, { message: 'Document not found' });
      }

      return c.json({
        success: true as const,
        documentId,
        state: Buffer.from(state).toString('base64'),
      });
    } catch (err) {
      if (err instanceof HTTPException) throw err;
      logger.error(
        'Failed to get collab snapshot',
        err instanceof Error ? err : new Error(String(err)),
        { documentId },
      );
      throw new HTTPException(500, { message: 'Failed to get snapshot' });
    }
  });

  return app;
}
