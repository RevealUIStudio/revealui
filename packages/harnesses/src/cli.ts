#!/usr/bin/env node

/**
 * revealui-harnesses — CLI daemon and RPC client for AI harness coordination.
 *
 * Commands:
 *   start [--project <path>]         Detect harnesses, register in workboard, start RPC server
 *   status                           List available harnesses via RPC
 *   list                             List harnesses in TSV format
 *   sync <harnessId> <push|pull>     Sync harness config to/from SSD
 *   coordinate [--print]             Print current workboard state
 *   coordinate --init <path>         Register this session in the workboard and start daemon
 *
 * License: Pro tier required (isFeatureEnabled("harnesses"))
 */

import { createConnection } from 'node:net'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { isFeatureEnabled } from '@revealui/core/features'
import { initializeLicense } from '@revealui/core/license'
import { HarnessCoordinator } from './coordinator.js'
import { WorkboardManager } from './workboard/workboard-manager.js'

async function checkLicense(): Promise<boolean> {
  await initializeLicense()
  return isFeatureEnabled('harnesses')
}

const DEFAULT_SOCKET = join(homedir(), '.local', 'share', 'revealui', 'harness.sock')
const DEFAULT_PROJECT = process.cwd()

const [, , command, ...args] = process.argv

async function rpcCall(method: string, params: unknown = {}): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const socket = createConnection(DEFAULT_SOCKET)
    let buffer = ''
    socket.on('connect', () => {
      const req = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
      socket.write(`${req}\n`)
    })
    socket.on('data', (chunk) => {
      buffer += chunk.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const resp = JSON.parse(line) as { result?: unknown; error?: { message: string } }
          socket.destroy()
          if (resp.error) reject(new Error(resp.error.message))
          else resolve(resp.result)
        } catch {
          reject(new Error(`Invalid JSON: ${line}`))
        }
      }
    })
    socket.on('error', reject)
    setTimeout(() => {
      socket.destroy()
      reject(new Error('RPC timeout'))
    }, 5000)
  })
}

async function main() {
  switch (command) {
    case 'start': {
      const licensed = await checkLicense()
      if (!licensed) {
        process.stderr.write(
          '⚠  @revealui/harnesses requires a Pro license. Visit https://revealui.com/pricing\n',
        )
        process.exit(2)
      }

      const projectIdx = args.indexOf('--project')
      const projectRoot =
        projectIdx >= 0 ? (args[projectIdx + 1] ?? DEFAULT_PROJECT) : DEFAULT_PROJECT

      const coordinator = new HarnessCoordinator({
        projectRoot,
        task: 'Harness coordination active',
      })

      await coordinator.start()
      const ids = await coordinator.getRegistry().listAvailable()
      process.stdout.write(`✓ Detected harnesses: ${ids.length > 0 ? ids.join(', ') : 'none'}\n`)
      process.stdout.write(`✓ RPC server listening on ${DEFAULT_SOCKET}\n`)
      process.stdout.write(`✓ Session registered in workboard\n`)

      const shutdown = async () => {
        await coordinator.stop()
        process.exit(0)
      }
      process.on('SIGINT', shutdown)
      process.on('SIGTERM', shutdown)
      break
    }

    case 'status': {
      try {
        const infos = (await rpcCall('harness.list')) as Array<{
          id: string
          name: string
          version?: string
        }>
        if (infos.length === 0) {
          process.stdout.write('No harnesses available\n')
        } else {
          for (const info of infos) {
            process.stdout.write(
              `${info.id}\t${info.name}${info.version ? `\t${info.version}` : ''}\n`,
            )
          }
        }
      } catch (err) {
        process.stderr.write(`RPC error: ${err instanceof Error ? err.message : String(err)}\n`)
        process.exit(1)
      }
      break
    }

    case 'list': {
      try {
        const infos = (await rpcCall('harness.list')) as Array<{ id: string; name: string }>
        for (const info of infos) {
          process.stdout.write(`${info.id}\t${info.name}\n`)
        }
      } catch (err) {
        process.stderr.write(`RPC error: ${err instanceof Error ? err.message : String(err)}\n`)
        process.exit(1)
      }
      break
    }

    case 'sync': {
      const [harnessId, direction] = args
      if (!(harnessId && direction && ['push', 'pull'].includes(direction))) {
        process.stderr.write('Usage: revealui-harnesses sync <harnessId> <push|pull>\n')
        process.exit(1)
      }
      try {
        const result = (await rpcCall('harness.syncConfig', { harnessId, direction })) as {
          success: boolean
          message?: string
        }
        process.stdout.write(result.success ? `✓ ${result.message}\n` : `✗ ${result.message}\n`)
        if (!result.success) process.exit(1)
      } catch (err) {
        process.stderr.write(`RPC error: ${err instanceof Error ? err.message : String(err)}\n`)
        process.exit(1)
      }
      break
    }

    case 'coordinate': {
      if (args.includes('--init')) {
        const pathIdx = args.indexOf('--init')
        const projectRoot = args[pathIdx + 1] ?? DEFAULT_PROJECT
        const coordinator = new HarnessCoordinator({ projectRoot, task: 'Coordinate harnesses' })
        await coordinator.start()
        const workboard = coordinator.getWorkboard()
        const conflicts = workboard.checkConflicts('', [])
        process.stdout.write(
          `✓ Session registered. Conflicts: ${conflicts.clean ? 'none' : conflicts.conflicts.length}\n`,
        )
        await coordinator.stop()
      } else {
        // --print: dump current workboard to stdout
        const projectRoot = args[args.indexOf('--project') + 1] ?? DEFAULT_PROJECT
        const workboardPath = join(projectRoot, '.claude', 'workboard.md')
        const manager = new WorkboardManager(workboardPath)
        const state = manager.read()
        process.stdout.write(`Sessions (${state.sessions.length}):\n`)
        for (const s of state.sessions) {
          const stale = Date.now() - new Date(s.updated).getTime() > 4 * 60 * 60 * 1000
          process.stdout.write(`  ${s.id} [${s.env}] — ${s.task}${stale ? ' (STALE)' : ''}\n`)
          if (s.files) process.stdout.write(`    files: ${s.files}\n`)
        }
        if (state.sessions.length === 0) process.stdout.write('  (no active sessions)\n')
      }
      break
    }

    default:
      process.stdout.write(`revealui-harnesses — AI harness coordination for RevealUI

Commands:
  start [--project <path>]          Start daemon (detects harnesses, registers session)
  status                            List available harnesses (requires daemon)
  list                              List harnesses in TSV format (requires daemon)
  sync <id> <push|pull>             Sync harness config to/from SSD (requires daemon)
  coordinate [--project <path>]     Print workboard state
  coordinate --init [<path>]        Register + start daemon
`)
      break
  }
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
