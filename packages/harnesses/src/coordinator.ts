import { join } from 'node:path'
import { autoDetectHarnesses } from './detection/auto-detector.js'
import { HarnessRegistry } from './registry/harness-registry.js'
import { RpcServer } from './server/rpc-server.js'
import type { HarnessAdapter } from './types/adapter.js'
import { deriveSessionId, detectSessionType } from './workboard/session-identity.js'
import { WorkboardManager } from './workboard/workboard-manager.js'

export interface CoordinatorOptions {
  /** Absolute path to the project root (where .claude/workboard.md lives) */
  projectRoot: string
  /** Unix socket path for the RPC server */
  socketPath?: string
  /** Session task description shown in the workboard */
  task?: string
}

/**
 * HarnessCoordinator — single entry point for harness-to-harness coordination.
 *
 * On start:
 *   1. Auto-detects installed AI harnesses and registers them
 *   2. Registers this session in the workboard
 *   3. Starts the RPC server
 *
 * On stop:
 *   1. Unregisters this session from the workboard
 *   2. Stops the RPC server
 *   3. Disposes all adapters
 */
export class HarnessCoordinator {
  private readonly registry = new HarnessRegistry()
  private rpcServer: RpcServer | null = null
  private sessionId: string | null = null
  private readonly workboard: WorkboardManager

  constructor(private readonly options: CoordinatorOptions) {
    const workboardPath = join(options.projectRoot, '.claude', 'workboard.md')
    this.workboard = new WorkboardManager(workboardPath)
  }

  async start(): Promise<void> {
    // 1. Auto-detect harnesses
    await autoDetectHarnesses(this.registry)

    // 2. Register in workboard
    const type = detectSessionType()
    const state = this.workboard.read()
    const existingIds = state.sessions.map((s) => s.id)
    this.sessionId = deriveSessionId(type, existingIds)

    const envLabels: Record<string, string> = {
      zed: 'Zed/ACP',
      cursor: 'Cursor',
      terminal: 'WSL/bash',
    }

    this.workboard.registerSession({
      id: this.sessionId,
      env: envLabels[type] ?? type,
      started: `${new Date().toISOString().slice(0, 16)}Z`,
      task: this.options.task ?? 'Harness coordination active',
      files: '',
      updated: `${new Date().toISOString().slice(0, 16)}Z`,
    })

    // 3. Start RPC server
    const socketPath =
      this.options.socketPath ??
      join(process.env.HOME ?? '/tmp', '.local', 'share', 'revealui', 'harness.sock')

    this.rpcServer = new RpcServer(this.registry, socketPath)
    await this.rpcServer.start()
  }

  async stop(): Promise<void> {
    // Unregister from workboard
    if (this.sessionId) {
      this.workboard.unregisterSession(this.sessionId)
      this.workboard.addRecentEntry({
        timestamp: new Date().toISOString().slice(0, 16).replace('T', ' '),
        sessionId: this.sessionId,
        description: `Session ended — ${this.options.task ?? 'harness coordination'}`,
      })
    }

    // Stop RPC server
    if (this.rpcServer) {
      await this.rpcServer.stop()
      this.rpcServer = null
    }

    // Dispose all adapters
    await this.registry.disposeAll()
  }

  /** The registry of detected harnesses. Available after start(). */
  getRegistry(): HarnessRegistry {
    return this.registry
  }

  /** The workboard manager. */
  getWorkboard(): WorkboardManager {
    return this.workboard
  }

  /** Register a custom adapter (must be called before start()). */
  registerAdapter(adapter: HarnessAdapter): void {
    this.registry.register(adapter)
  }
}
