import { Hono } from 'hono'
import type { WSContext } from 'hono/ws'
import { createYjsPersistence } from '../collab/persistence.js'
import { createRoomManager } from '../collab/room-manager.js'

type UpgradeWebSocket = (
  handler: (c: unknown) => {
    onOpen?: (evt: Event, ws: WSContext) => void
    onMessage?: (evt: MessageEvent, ws: WSContext) => void
    onClose?: (evt: CloseEvent, ws: WSContext) => void
    onError?: (evt: Event, ws: WSContext) => void
  },
) => (c: unknown) => Response | Promise<Response>

export function createCollabRoute(upgradeWebSocket: UpgradeWebSocket): Hono {
  const app = new Hono()
  let roomManager: ReturnType<typeof createRoomManager> | null = null

  function getRoomManager(c: Record<string, unknown>): ReturnType<typeof createRoomManager> {
    if (!roomManager) {
      const db = (c as Record<string, unknown>).get?.('db') ?? c.db
      const persistence = createYjsPersistence(db as Parameters<typeof createYjsPersistence>[0])
      roomManager = createRoomManager(persistence)
    }
    return roomManager
  }

  app.get(
    '/ws/collab/:documentId',
    upgradeWebSocket((c) => {
      const documentId = (
        c as Record<string, unknown> & { req: { param: (key: string) => string } }
      ).req.param('documentId')
      const clientId = crypto.randomUUID()
      const manager = getRoomManager(c as Record<string, unknown>)

      return {
        onOpen(_evt: Event, ws: WSContext) {
          manager.handleConnection(documentId, clientId, (data: Uint8Array) => {
            ws.send(data as unknown as ArrayBuffer)
          })
        },
        onMessage(evt: MessageEvent, _ws: WSContext) {
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
        onClose(_evt: CloseEvent, _ws: WSContext) {
          manager.handleDisconnect(documentId, clientId)
        },
        onError(_evt: Event, _ws: WSContext) {
          manager.handleDisconnect(documentId, clientId)
        },
      }
    }),
  )

  return app
}
