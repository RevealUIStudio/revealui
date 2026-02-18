import type { NodeWebSocket } from '@hono/node-ws'
import { Hono } from 'hono'
import { createYjsPersistence } from '../collab/persistence.js'
import { createRoomManager } from '../collab/room-manager.js'

export function createCollabRoute(upgradeWebSocket: NodeWebSocket['upgradeWebSocket']): Hono {
  const app = new Hono()
  let roomManager: ReturnType<typeof createRoomManager> | null = null

  function getRoomManager(c: { get(key: string): unknown }): ReturnType<typeof createRoomManager> {
    if (!roomManager) {
      const db = c.get('db') as Parameters<typeof createYjsPersistence>[0]
      const persistence = createYjsPersistence(db)
      roomManager = createRoomManager(persistence)
    }
    return roomManager
  }

  app.get(
    '/ws/collab/:documentId',
    upgradeWebSocket((c) => {
      const documentId = c.req.param('documentId')
      const clientId = crypto.randomUUID()
      const manager = getRoomManager(c)

      return {
        onOpen(_evt, ws) {
          manager.handleConnection(documentId, clientId, (data: Uint8Array) => {
            ws.send(new Uint8Array(data))
          })
        },
        onMessage(evt, _ws) {
          let data: Uint8Array
          if (evt.data instanceof ArrayBuffer) {
            data = new Uint8Array(evt.data)
          } else if (evt.data instanceof Uint8Array) {
            data = evt.data
          } else {
            return
          }
          manager.handleMessage(documentId, clientId, data)
        },
        onClose(_evt, _ws) {
          manager.handleDisconnect(documentId, clientId)
        },
        onError(_evt, _ws) {
          manager.handleDisconnect(documentId, clientId)
        },
      }
    }),
  )

  return app
}
