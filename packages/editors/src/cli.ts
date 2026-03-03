#!/usr/bin/env node
import { mkdirSync } from 'node:fs'
import { createConnection } from 'node:net'
import { homedir } from 'node:os'
import { resolve } from 'node:path'
import { autoDetectEditors } from './detection/auto-detector.js'
import { checkEditorsLicense } from './index.js'
import { EditorRegistry } from './registry/editor-registry.js'
import { RpcServer } from './server/rpc-server.js'

const SOCKET_DIR = resolve(homedir(), '.local', 'share', 'revealui')
const SOCKET_PATH = resolve(SOCKET_DIR, 'editor.sock')

function out(msg: string): void {
  process.stdout.write(`${msg}\n`)
}

function err(msg: string): void {
  process.stderr.write(`${msg}\n`)
}

function sendRpcRequest(method: string, params?: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const socket = createConnection(SOCKET_PATH, () => {
      const request = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
      socket.write(`${request}\n`)
    })
    let buffer = ''
    socket.on('data', (data) => {
      buffer += data.toString()
      const newlineIdx = buffer.indexOf('\n')
      if (newlineIdx !== -1) {
        const response = JSON.parse(buffer.substring(0, newlineIdx))
        socket.end()
        if (response.error) reject(new Error(response.error.message))
        else resolve(response.result)
      }
    })
    socket.on('error', reject)
  })
}

async function startDaemon() {
  mkdirSync(SOCKET_DIR, { recursive: true })
  const registry = new EditorRegistry()

  out('Auto-detecting editors...')
  const detected = await autoDetectEditors(registry)
  if (detected.length === 0) {
    out('No editors detected. Daemon will start but no editors are available.')
  } else {
    out(`Detected editors: ${detected.join(', ')}`)
  }

  const server = new RpcServer(registry, SOCKET_PATH)

  const shutdown = async () => {
    await server.stop()
    await registry.disposeAll()
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  await server.start()
  out(`RevealUI Editor Daemon listening on ${SOCKET_PATH}`)
}

async function main() {
  const args = process.argv.slice(2)
  const command = args[0] ?? 'start'

  switch (command) {
    case 'start':
      if (!(await checkEditorsLicense())) {
        process.exit(1)
      }
      await startDaemon()
      break

    case 'status': {
      const result = await sendRpcRequest('editor.list')
      out('Available editors:')
      const editors = result as { id: string; name: string; version?: string }[]
      if (editors.length === 0) {
        out('  (none)')
      } else {
        for (const e of editors) {
          out(`  ${e.name} (${e.id})${e.version ? ` — ${e.version}` : ''}`)
        }
      }
      break
    }

    case 'list': {
      const result = await sendRpcRequest('editor.list')
      const editors = result as { id: string; name: string; version?: string }[]
      for (const e of editors) {
        out(`${e.id}\t${e.name}\t${e.version ?? 'unknown'}`)
      }
      break
    }

    case 'open': {
      const path = args[1]
      if (!path) {
        err('Usage: revealui-editor-daemon open <path> [--editor <id>]')
        process.exit(1)
      }
      const editorIdx = args.indexOf('--editor')
      const editorId = editorIdx !== -1 ? args[editorIdx + 1] : undefined
      const result = await sendRpcRequest('editor.openFile', { path: resolve(path), editorId })
      out(JSON.stringify(result, null, 2))
      break
    }

    case 'sync': {
      const editorId = args[1]
      const direction = args[2]
      if (!(editorId && direction && ['push', 'pull'].includes(direction))) {
        err('Usage: revealui-editor-daemon sync <editorId> <push|pull>')
        process.exit(1)
      }
      const result = await sendRpcRequest('editor.syncConfig', { editorId, direction })
      out(JSON.stringify(result, null, 2))
      break
    }

    default:
      err(`Unknown command: ${command}`)
      err('Commands: start, status, list, open, sync')
      process.exit(1)
  }
}

main().catch((error) => {
  err(`Failed: ${error.message ?? error}`)
  process.exit(1)
})
