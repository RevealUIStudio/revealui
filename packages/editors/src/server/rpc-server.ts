import { createServer, type Server } from 'node:net'
import { diffConfig, syncConfig } from '../config/config-sync.js'
import { findAllEditorProcesses } from '../detection/process-detector.js'
import type { EditorRegistry } from '../registry/editor-registry.js'
import type { ConfigSyncDirection, EditorCommand } from '../types/index.js'

interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: number | string
  method: string
  params?: unknown
}

interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: number | string
  result?: unknown
  error?: { code: number; message: string }
}

export class RpcServer {
  private server: Server | null = null

  constructor(
    private registry: EditorRegistry,
    private socketPath: string,
  ) {}

  async start(): Promise<void> {
    this.server = createServer((socket) => {
      let buffer = ''
      socket.on('data', (data) => {
        buffer += data.toString()
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (line.trim()) {
            this.handleMessage(line.trim()).then((response) => {
              socket.write(`${JSON.stringify(response)}\n`)
            })
          }
        }
      })
    })

    return new Promise((resolve, reject) => {
      this.server?.listen(this.socketPath, () => resolve())
      this.server?.on('error', reject)
    })
  }

  private async handleMessage(raw: string): Promise<JsonRpcResponse> {
    let request: JsonRpcRequest
    try {
      request = JSON.parse(raw)
    } catch {
      return { jsonrpc: '2.0', id: 0, error: { code: -32700, message: 'Parse error' } }
    }

    try {
      switch (request.method) {
        case 'editor.list': {
          const editors = await this.registry.listAvailable()
          return { jsonrpc: '2.0', id: request.id, result: editors }
        }
        case 'editor.execute': {
          const { editorId, command } = request.params as {
            editorId: string
            command: EditorCommand
          }
          const adapter = this.registry.get(editorId)
          if (!adapter)
            return {
              jsonrpc: '2.0',
              id: request.id,
              error: { code: -32602, message: `Unknown editor: ${editorId}` },
            }
          const result = await adapter.execute(command)
          return { jsonrpc: '2.0', id: request.id, result }
        }
        case 'editor.info': {
          const { editorId: id } = request.params as { editorId: string }
          const adapter = this.registry.get(id)
          if (!adapter)
            return {
              jsonrpc: '2.0',
              id: request.id,
              error: { code: -32602, message: `Unknown editor: ${id}` },
            }
          return { jsonrpc: '2.0', id: request.id, result: await adapter.getInfo() }
        }
        case 'editor.listRunning': {
          const processes = await findAllEditorProcesses()
          return { jsonrpc: '2.0', id: request.id, result: processes }
        }
        case 'editor.openFile': {
          const {
            path,
            line,
            column,
            editorId: preferredId,
          } = request.params as { path: string; line?: number; column?: number; editorId?: string }
          let adapter = preferredId ? this.registry.get(preferredId) : undefined
          if (!adapter) {
            const available = await this.registry.listAvailable()
            if (available.length === 0)
              return {
                jsonrpc: '2.0',
                id: request.id,
                error: { code: -32602, message: 'No editors available' },
              }
            const firstAvailable = available[0]
            if (firstAvailable) {
              adapter = this.registry.get(firstAvailable.id)
            }
          }
          if (!adapter)
            return {
              jsonrpc: '2.0',
              id: request.id,
              error: { code: -32602, message: 'No editors available' },
            }
          const result = await adapter.execute({ type: 'open-file', path, line, column })
          return { jsonrpc: '2.0', id: request.id, result }
        }
        case 'editor.syncConfig': {
          const { editorId: syncId, direction } = request.params as {
            editorId: string
            direction: ConfigSyncDirection
          }
          const syncResult = await syncConfig(syncId, direction)
          return { jsonrpc: '2.0', id: request.id, result: syncResult }
        }
        case 'editor.diffConfig': {
          const { editorId: diffId } = request.params as { editorId: string }
          const diffResult = await diffConfig(diffId)
          return { jsonrpc: '2.0', id: request.id, result: diffResult }
        }
        case 'editor.installExtension': {
          const { editorId: extId, extensionId } = request.params as {
            editorId: string
            extensionId: string
          }
          const extAdapter = this.registry.get(extId)
          if (!extAdapter)
            return {
              jsonrpc: '2.0',
              id: request.id,
              error: { code: -32602, message: `Unknown editor: ${extId}` },
            }
          const extResult = await extAdapter.execute({ type: 'install-extension', extensionId })
          return { jsonrpc: '2.0', id: request.id, result: extResult }
        }
        default:
          return {
            jsonrpc: '2.0',
            id: request.id,
            error: { code: -32601, message: `Unknown method: ${request.method}` },
          }
      }
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: { code: -32603, message: error instanceof Error ? error.message : 'Internal error' },
      }
    }
  }

  async stop(): Promise<void> {
    if (this.server) {
      this.server.close()
      this.server = null
    }
  }
}
