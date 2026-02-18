import type { NodeWebSocket } from '@hono/node-ws'
import { Hono } from 'hono'
import type { ClientIdentity } from '../collab/room-manager.js'
import { getSharedRoomManager } from '../collab/shared-room-manager.js'

const CURSOR_COLORS = [
  '#E06C75',
  '#98C379',
  '#E5C07B',
  '#61AFEF',
  '#C678DD',
  '#56B6C2',
  '#BE5046',
  '#D19A66',
  '#ABB2BF',
  '#528BFF',
]

function assignColor(clientId: string): string {
  let hash = 0
  for (let i = 0; i < clientId.length; i++) {
    hash = (hash * 31 + clientId.charCodeAt(i)) | 0
  }
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length]
}

export function createCollabRoute(upgradeWebSocket: NodeWebSocket['upgradeWebSocket']): Hono {
  const app = new Hono()

  app.get(
    '/ws/collab/:documentId',
    upgradeWebSocket((c) => {
      const documentId = c.req.param('documentId')
      const clientId = crypto.randomUUID()
      const db = c.get('db') as Parameters<typeof getSharedRoomManager>[0]
      const manager = getSharedRoomManager(db)

      // Extract identity from query params (Phase 3 will use JWT auth instead)
      const name = c.req.query('name') ?? 'Anonymous'
      const color = c.req.query('color') ?? assignColor(clientId)
      const clientType = (c.req.query('type') ?? 'human') as 'human' | 'agent'
      const agentModel = c.req.query('agentModel')

      const identity: ClientIdentity = {
        type: clientType,
        id: clientId,
        name,
        color,
        ...(agentModel ? { agentModel } : {}),
      }

      return {
        onOpen(_evt, ws) {
          manager.handleConnection(
            documentId,
            clientId,
            (data: Uint8Array) => {
              ws.send(new Uint8Array(data))
            },
            identity,
          )
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
