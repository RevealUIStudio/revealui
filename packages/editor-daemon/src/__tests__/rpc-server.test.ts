import { randomUUID } from 'node:crypto'
import { createConnection } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { EditorAdapter, EditorCommand } from '@revealui/editor-sdk'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { EditorRegistry } from '../registry/editor-registry.js'
import { RpcServer } from '../server/rpc-server.js'

function createMockAdapter(overrides: Partial<EditorAdapter> = {}): EditorAdapter {
  return {
    id: 'test-editor',
    name: 'Test Editor',
    getCapabilities: () => ({
      openProject: true,
      openFile: true,
      jumpToLine: false,
      applyConfig: false,
      installExtension: false,
      getRunningInstances: false,
    }),
    getInfo: async () => ({
      id: 'test-editor',
      name: 'Test Editor',
      version: '1.0.0',
      capabilities: {
        openProject: true,
        openFile: true,
        jumpToLine: false,
        applyConfig: false,
        installExtension: false,
        getRunningInstances: false,
      },
    }),
    isAvailable: async () => true,
    execute: async (cmd: EditorCommand) => ({
      success: true,
      command: cmd.type,
    }),
    onEvent: () => () => {},
    dispose: async () => {},
    ...overrides,
  }
}

function sendRpc(socketPath: string, request: object): Promise<object> {
  return new Promise((resolve, reject) => {
    const client = createConnection(socketPath, () => {
      client.write(`${JSON.stringify(request)}\n`)
    })
    let data = ''
    client.on('data', (chunk) => {
      data += chunk.toString()
      if (data.includes('\n')) {
        client.end()
        resolve(JSON.parse(data.trim()))
      }
    })
    client.on('error', reject)
    setTimeout(() => {
      client.end()
      reject(new Error('Timeout'))
    }, 3000)
  })
}

describe('RpcServer', () => {
  let registry: EditorRegistry
  let server: RpcServer
  let socketPath: string

  beforeEach(async () => {
    socketPath = join(tmpdir(), `revealui-test-${randomUUID()}.sock`)
    registry = new EditorRegistry()
    registry.register(createMockAdapter())
    server = new RpcServer(registry, socketPath)
    await server.start()
  })

  afterEach(async () => {
    await server.stop()
    await registry.disposeAll()
  })

  it('responds to editor.list', async () => {
    const response = (await sendRpc(socketPath, {
      jsonrpc: '2.0',
      id: 1,
      method: 'editor.list',
    })) as { result: unknown[] }
    expect(response.result).toHaveLength(1)
    expect((response.result[0] as { id: string }).id).toBe('test-editor')
  })

  it('responds to editor.info', async () => {
    const response = (await sendRpc(socketPath, {
      jsonrpc: '2.0',
      id: 2,
      method: 'editor.info',
      params: { editorId: 'test-editor' },
    })) as { result: { name: string } }
    expect(response.result.name).toBe('Test Editor')
  })

  it('responds to editor.execute', async () => {
    const response = (await sendRpc(socketPath, {
      jsonrpc: '2.0',
      id: 3,
      method: 'editor.execute',
      params: { editorId: 'test-editor', command: { type: 'get-status' } },
    })) as { result: { success: boolean } }
    expect(response.result.success).toBe(true)
  })

  it('returns error for unknown editor', async () => {
    const response = (await sendRpc(socketPath, {
      jsonrpc: '2.0',
      id: 4,
      method: 'editor.info',
      params: { editorId: 'nonexistent' },
    })) as { error: { code: number; message: string } }
    expect(response.error.code).toBe(-32602)
    expect(response.error.message).toContain('Unknown editor')
  })

  it('returns error for unknown method', async () => {
    const response = (await sendRpc(socketPath, {
      jsonrpc: '2.0',
      id: 5,
      method: 'editor.bogus',
    })) as { error: { code: number; message: string } }
    expect(response.error.code).toBe(-32601)
  })

  it('responds to editor.openFile with preferred editor', async () => {
    const response = (await sendRpc(socketPath, {
      jsonrpc: '2.0',
      id: 10,
      method: 'editor.openFile',
      params: { path: '/tmp/test.ts', line: 5, editorId: 'test-editor' },
    })) as { result: { success: boolean; command: string } }
    expect(response.result.success).toBe(true)
    expect(response.result.command).toBe('open-file')
  })

  it('responds to editor.openFile with auto-selected editor', async () => {
    const response = (await sendRpc(socketPath, {
      jsonrpc: '2.0',
      id: 11,
      method: 'editor.openFile',
      params: { path: '/tmp/test.ts' },
    })) as { result: { success: boolean } }
    expect(response.result.success).toBe(true)
  })

  it('responds to editor.installExtension', async () => {
    const response = (await sendRpc(socketPath, {
      jsonrpc: '2.0',
      id: 12,
      method: 'editor.installExtension',
      params: { editorId: 'test-editor', extensionId: 'some.extension' },
    })) as { result: { success: boolean; command: string } }
    expect(response.result.success).toBe(true)
    expect(response.result.command).toBe('install-extension')
  })

  it('editor.installExtension returns error for unknown editor', async () => {
    const response = (await sendRpc(socketPath, {
      jsonrpc: '2.0',
      id: 13,
      method: 'editor.installExtension',
      params: { editorId: 'nonexistent', extensionId: 'some.extension' },
    })) as { error: { code: number } }
    expect(response.error.code).toBe(-32602)
  })

  it('returns parse error for invalid JSON', async () => {
    const response = (await new Promise<object>((resolve, reject) => {
      const client = createConnection(socketPath, () => {
        client.write('not-json\n')
      })
      let data = ''
      client.on('data', (chunk) => {
        data += chunk.toString()
        if (data.includes('\n')) {
          client.end()
          resolve(JSON.parse(data.trim()))
        }
      })
      client.on('error', reject)
      setTimeout(() => {
        client.end()
        reject(new Error('Timeout'))
      }, 3000)
    })) as { error: { code: number } }
    expect(response.error.code).toBe(-32700)
  })
})
