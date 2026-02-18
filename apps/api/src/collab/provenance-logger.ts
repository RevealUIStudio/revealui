import { collabEdits } from '@revealui/db/schema/collab-edits'
import type { ClientIdentity } from './room-manager.js'

interface DrizzleDb {
  insert(table: unknown): {
    values(data: unknown[]): Promise<unknown>
  }
}

interface ProvenanceEntry {
  documentId: string
  clientType: 'human' | 'agent'
  clientId: string
  clientName: string
  agentModel: string | undefined
  updateData: Buffer
  updateSize: number
  timestamp: Date
}

export interface ProvenanceLogger {
  logEdit(documentId: string, identity: ClientIdentity, update: Uint8Array): void
  flush(): Promise<void>
  destroy(): Promise<void>
}

const BATCH_INTERVAL_MS = 5000
const BATCH_SIZE_LIMIT = 50

export function createProvenanceLogger(db: DrizzleDb): ProvenanceLogger {
  const buffer: ProvenanceEntry[] = []
  let flushTimer: ReturnType<typeof setInterval> | null = null
  let destroyed = false

  function startTimer(): void {
    if (flushTimer !== null) return
    flushTimer = setInterval(() => {
      flushBuffer()
    }, BATCH_INTERVAL_MS)
  }

  function stopTimer(): void {
    if (flushTimer !== null) {
      clearInterval(flushTimer)
      flushTimer = null
    }
  }

  async function flushBuffer(): Promise<void> {
    if (buffer.length === 0) return

    const entries = buffer.splice(0, buffer.length)

    try {
      await db.insert(collabEdits).values(
        entries.map((entry) => ({
          documentId: entry.documentId,
          clientType: entry.clientType,
          clientId: entry.clientId,
          clientName: entry.clientName,
          agentModel: entry.agentModel ?? null,
          updateData: entry.updateData,
          updateSize: entry.updateSize,
          timestamp: entry.timestamp,
        })),
      )
    } catch {
      buffer.unshift(...entries)
    }
  }

  return {
    logEdit(documentId: string, identity: ClientIdentity, update: Uint8Array): void {
      if (destroyed) return

      buffer.push({
        documentId,
        clientType: identity.type,
        clientId: identity.id,
        clientName: identity.name,
        agentModel: identity.agentModel,
        updateData: Buffer.from(update),
        updateSize: update.byteLength,
        timestamp: new Date(),
      })

      startTimer()

      if (buffer.length >= BATCH_SIZE_LIMIT) {
        flushBuffer()
      }
    },

    async flush(): Promise<void> {
      await flushBuffer()
    },

    async destroy(): Promise<void> {
      destroyed = true
      stopTimer()
      await flushBuffer()
    },
  }
}
