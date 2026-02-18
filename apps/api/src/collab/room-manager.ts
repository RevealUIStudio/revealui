import * as decoding from 'lib0/decoding'
import * as encoding from 'lib0/encoding'
import * as syncProtocol from 'y-protocols/sync'
import * as Y from 'yjs'
import type { YjsPersistence } from './persistence.js'

const MESSAGE_SYNC = 0
const DEBOUNCE_MS = 2000

interface Client {
  id: string
  send: (data: Uint8Array) => void
}

interface Room {
  doc: Y.Doc
  clients: Map<string, Client>
  persistTimer: ReturnType<typeof setTimeout> | null
}

export interface RoomManager {
  handleConnection(documentId: string, clientId: string, send: (data: Uint8Array) => void): void
  handleMessage(documentId: string, clientId: string, message: Uint8Array): void
  handleDisconnect(documentId: string, clientId: string): void
  destroy(): void
}

export function createRoomManager(persistence: YjsPersistence): RoomManager {
  const rooms = new Map<string, Room>()

  function getOrCreateRoom(documentId: string): Room {
    let room = rooms.get(documentId)
    if (!room) {
      const doc = new Y.Doc()
      room = { doc, clients: new Map(), persistTimer: null }
      rooms.set(documentId, room)

      const currentRoom = room
      doc.on('update', (update: Uint8Array, origin: string | null) => {
        const encoder = encoding.createEncoder()
        encoding.writeVarUint(encoder, MESSAGE_SYNC)
        syncProtocol.writeUpdate(encoder, update)
        const msg = encoding.toUint8Array(encoder)

        for (const [id, client] of currentRoom.clients) {
          if (id !== origin) {
            client.send(msg)
          }
        }

        schedulePersist(documentId)
      })
    }
    return room
  }

  function schedulePersist(documentId: string): void {
    const room = rooms.get(documentId)
    if (!room) return

    if (room.persistTimer) {
      clearTimeout(room.persistTimer)
    }

    room.persistTimer = setTimeout(() => {
      persistence.saveDocument(documentId, room.doc)
      room.persistTimer = null
    }, DEBOUNCE_MS)
  }

  return {
    handleConnection(documentId: string, clientId: string, send: (data: Uint8Array) => void): void {
      const room = getOrCreateRoom(documentId)
      const isFirstClient = room.clients.size === 0

      room.clients.set(clientId, { id: clientId, send })

      if (isFirstClient) {
        persistence.loadDocument(documentId, room.doc).then(() => {
          const encoder = encoding.createEncoder()
          encoding.writeVarUint(encoder, MESSAGE_SYNC)
          syncProtocol.writeSyncStep1(encoder, room.doc)
          send(encoding.toUint8Array(encoder))
        })
      } else {
        const encoder = encoding.createEncoder()
        encoding.writeVarUint(encoder, MESSAGE_SYNC)
        syncProtocol.writeSyncStep1(encoder, room.doc)
        send(encoding.toUint8Array(encoder))
      }

      persistence.updateClientCount(documentId, room.clients.size)
    },

    handleMessage(documentId: string, clientId: string, message: Uint8Array): void {
      const room = rooms.get(documentId)
      if (!room) return

      const decoder = decoding.createDecoder(message)
      const messageType = decoding.readVarUint(decoder)

      if (messageType === MESSAGE_SYNC) {
        const encoder = encoding.createEncoder()
        encoding.writeVarUint(encoder, MESSAGE_SYNC)
        syncProtocol.readSyncMessage(decoder, encoder, room.doc, clientId)

        if (encoding.length(encoder) > 1) {
          const client = room.clients.get(clientId)
          if (client) {
            client.send(encoding.toUint8Array(encoder))
          }
        }
      }
    },

    handleDisconnect(documentId: string, clientId: string): void {
      const room = rooms.get(documentId)
      if (!room) return

      room.clients.delete(clientId)
      persistence.updateClientCount(documentId, room.clients.size)

      if (room.clients.size === 0) {
        if (room.persistTimer) {
          clearTimeout(room.persistTimer)
          room.persistTimer = null
        }

        persistence.saveDocument(documentId, room.doc).then(() => {
          room.doc.destroy()
          rooms.delete(documentId)
        })
      }
    },

    destroy(): void {
      for (const [documentId, room] of rooms) {
        if (room.persistTimer) {
          clearTimeout(room.persistTimer)
        }
        persistence.saveDocument(documentId, room.doc)
        room.doc.destroy()
      }
      rooms.clear()
    },
  }
}
