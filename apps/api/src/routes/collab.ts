import { logger } from '@revealui/core/observability/logger'
import { Hono } from 'hono'
import * as Y from 'yjs'
import { z } from 'zod'
import { createYjsPersistence } from '../collab/persistence.js'
import type { getSharedRoomManager } from '../collab/shared-room-manager.js'

type Variables = {
  db: Parameters<typeof getSharedRoomManager>[0]
  user?: { id: string; role: string }
}

const UpdateSchema = z.object({
  documentId: z.string().min(1),
  // base64-encoded Yjs binary update (Y.encodeStateAsUpdate output)
  update: z.string().min(1),
})

// biome-ignore lint/style/useNamingConvention: Hono requires PascalCase Variables key
export function createCollabRoute(): Hono<{ Variables: Variables }> {
  // biome-ignore lint/style/useNamingConvention: Hono requires PascalCase Variables key
  const app = new Hono<{ Variables: Variables }>()

  /**
   * Accept a Yjs binary update from a client, merge it with the current
   * document state in the DB, and persist the result.
   *
   * Clients subscribe to the yjs_documents ElectricSQL shape to receive
   * state changes in real time. On receiving a new state blob they call
   * Y.applyUpdate() to sync their local document.
   *
   * Known limitation (Phase 0): concurrent updates to the same document
   * race on the state column (last-write-wins). Yjs CRDT convergence
   * ensures no data is silently discarded — re-applying a missed update is
   * safe. Serialization via DB advisory locks and a proper operation log
   * (crdt_operations table) is planned for Phase 2.
   */
  app.post('/api/collab/update', async (c) => {
    if (!c.get('user')) {
      return c.json({ success: false, error: 'Authentication required' }, 401)
    }
    const body = await c.req.json()
    const parsed = UpdateSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ success: false, error: parsed.error.message }, 400)
    }

    const { documentId, update } = parsed.data

    let updateBytes: Uint8Array
    try {
      updateBytes = new Uint8Array(Buffer.from(update, 'base64'))
    } catch {
      return c.json({ success: false, error: 'Invalid update encoding — expected base64' }, 400)
    }

    const db = c.get('db')
    const persistence = createYjsPersistence(db)

    try {
      const doc = new Y.Doc()
      await persistence.loadDocument(documentId, doc)
      Y.applyUpdate(doc, updateBytes)
      await persistence.saveDocument(documentId, doc)
      doc.destroy()
      return c.json({ success: true })
    } catch (err) {
      logger.error(
        'Failed to apply collab update',
        err instanceof Error ? err : new Error(String(err)),
        { documentId },
      )
      return c.json({ success: false, error: 'Failed to apply update' }, 500)
    }
  })

  /**
   * Return the current Yjs document state as a base64-encoded binary blob.
   * Used by clients for the initial load before the ElectricSQL shape
   * subscription catches up.
   */
  app.get('/api/collab/snapshot/:documentId', async (c) => {
    if (!c.get('user')) {
      return c.json({ success: false, error: 'Authentication required' }, 401)
    }
    const documentId = c.req.param('documentId')
    const db = c.get('db')
    const persistence = createYjsPersistence(db)

    try {
      const doc = new Y.Doc()
      await persistence.loadDocument(documentId, doc)
      const state = Y.encodeStateAsUpdate(doc)
      doc.destroy()

      if (state.length <= 2) {
        return c.json({ success: false, error: 'Document not found' }, 404)
      }

      return c.json({
        success: true,
        documentId,
        state: Buffer.from(state).toString('base64'),
      })
    } catch (err) {
      logger.error(
        'Failed to get collab snapshot',
        err instanceof Error ? err : new Error(String(err)),
        { documentId },
      )
      return c.json({ success: false, error: 'Failed to get snapshot' }, 500)
    }
  })

  return app
}
