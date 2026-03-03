import { createServer } from 'node:net'
import { diffConfig, syncConfig } from '../config/config-sync.js'
import type { HarnessRegistry } from '../registry/harness-registry.js'
import type { ConfigSyncDirection } from '../types/core.js'

interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: number | string | null
  method: string
  params?: unknown
}

interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: number | string | null
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
}

const ERR_PARSE = -32700
const ERR_INVALID_PARAMS = -32602
const ERR_METHOD_NOT_FOUND = -32601
const ERR_INTERNAL = -32603

/**
 * JSON-RPC 2.0 server over a Unix domain socket.
 * Mirrors RpcServer from packages/editors.
 *
 * Methods:
 *   harness.list              → HarnessInfo[]
 *   harness.execute           → HarnessCommandResult
 *   harness.info              → HarnessInfo
 *   harness.listRunning       → HarnessProcessInfo[]
 *   harness.syncConfig        → ConfigSyncResult
 *   harness.diffConfig        → ConfigDiffEntry
 */
export class RpcServer {
  private server = createServer()

  constructor(
    private readonly registry: HarnessRegistry,
    private readonly socketPath: string,
  ) {
    this.server.on('connection', (socket) => {
      let buffer = ''
      socket.on('data', (chunk) => {
        buffer += chunk.toString()
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          this.handleLine(line.trim(), (response) => {
            socket.write(`${JSON.stringify(response)}\n`)
          })
        }
      })
    })
  }

  private handleLine(line: string, reply: (r: JsonRpcResponse) => void): void {
    let req: JsonRpcRequest
    try {
      req = JSON.parse(line) as JsonRpcRequest
    } catch {
      reply({ jsonrpc: '2.0', id: null, error: { code: ERR_PARSE, message: 'Parse error' } })
      return
    }

    this.dispatch(req)
      .then(reply)
      .catch((err) => {
        reply({
          jsonrpc: '2.0',
          id: req.id,
          error: { code: ERR_INTERNAL, message: err instanceof Error ? err.message : String(err) },
        })
      })
  }

  private async dispatch(req: JsonRpcRequest): Promise<JsonRpcResponse> {
    const { id, method, params } = req
    const p = (params ?? {}) as Record<string, unknown>

    switch (method) {
      case 'harness.list': {
        const ids = await this.registry.listAvailable()
        const infos = await Promise.all(ids.map((id) => this.registry.get(id)?.getInfo()))
        return { jsonrpc: '2.0', id, result: infos }
      }

      case 'harness.info': {
        const harnessId = p.harnessId as string | undefined
        if (!harnessId) {
          return {
            jsonrpc: '2.0',
            id,
            error: { code: ERR_INVALID_PARAMS, message: 'harnessId required' },
          }
        }
        const adapter = this.registry.get(harnessId)
        if (!adapter) {
          return {
            jsonrpc: '2.0',
            id,
            error: { code: ERR_INVALID_PARAMS, message: `Harness not found: ${harnessId}` },
          }
        }
        return { jsonrpc: '2.0', id, result: await adapter.getInfo() }
      }

      case 'harness.execute': {
        const harnessId = p.harnessId as string | undefined
        const command = p.command as Record<string, unknown> | undefined
        if (!(harnessId && command)) {
          return {
            jsonrpc: '2.0',
            id,
            error: { code: ERR_INVALID_PARAMS, message: 'harnessId and command required' },
          }
        }
        const adapter = this.registry.get(harnessId)
        if (!adapter) {
          return {
            jsonrpc: '2.0',
            id,
            error: { code: ERR_INVALID_PARAMS, message: `Harness not found: ${harnessId}` },
          }
        }
        const result = await adapter.execute(command as Parameters<typeof adapter.execute>[0])
        return { jsonrpc: '2.0', id, result }
      }

      case 'harness.syncConfig': {
        const harnessId = p.harnessId as string | undefined
        const direction = p.direction as ConfigSyncDirection | undefined
        if (!(harnessId && direction)) {
          return {
            jsonrpc: '2.0',
            id,
            error: { code: ERR_INVALID_PARAMS, message: 'harnessId and direction required' },
          }
        }
        return { jsonrpc: '2.0', id, result: syncConfig(harnessId, direction) }
      }

      case 'harness.diffConfig': {
        const harnessId = p.harnessId as string | undefined
        if (!harnessId) {
          return {
            jsonrpc: '2.0',
            id,
            error: { code: ERR_INVALID_PARAMS, message: 'harnessId required' },
          }
        }
        return { jsonrpc: '2.0', id, result: diffConfig(harnessId) }
      }

      default:
        return {
          jsonrpc: '2.0',
          id,
          error: { code: ERR_METHOD_NOT_FOUND, message: `Method not found: ${method}` },
        }
    }
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.listen(this.socketPath, () => resolve())
      this.server.once('error', reject)
    })
  }

  stop(): Promise<void> {
    return new Promise((resolve) => this.server.close(() => resolve()))
  }
}
