import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { HarnessAdapter } from '../types/adapter.js'
import type {
  HarnessCapabilities,
  HarnessCommand,
  HarnessCommandResult,
  HarnessEvent,
  HarnessInfo,
} from '../types/core.js'

const execFileAsync = promisify(execFile)

/**
 * Adapter for Cursor AI editor (CLI: `cursor`).
 *
 * Cursor wraps VS Code and adds AI coding capabilities.
 * Config lives at ~/.cursor/settings.json.
 * The `cursor` CLI accepts the same flags as the `code` CLI.
 */
export class CursorAdapter implements HarnessAdapter {
  readonly id = 'cursor'
  readonly name = 'Cursor'

  private readonly eventHandlers = new Set<(event: HarnessEvent) => void>()

  getCapabilities(): HarnessCapabilities {
    return {
      generateCode: true,
      analyzeCode: true,
      applyEdit: false,
      applyConfig: true,
      readWorkboard: false,
      writeWorkboard: false,
    }
  }

  async getInfo(): Promise<HarnessInfo> {
    let version: string | undefined
    try {
      const { stdout } = await execFileAsync('cursor', ['--version'], {
        timeout: 5000,
      })
      version = stdout.trim().split('\n')[0]
    } catch {
      // Not installed.
    }
    return { id: this.id, name: this.name, version, capabilities: this.getCapabilities() }
  }

  async isAvailable(): Promise<boolean> {
    try {
      await execFileAsync('cursor', ['--version'], { timeout: 3000 })
      return true
    } catch {
      return false
    }
  }

  async execute(command: HarnessCommand): Promise<HarnessCommandResult> {
    switch (command.type) {
      case 'get-status': {
        const available = await this.isAvailable()
        return { success: true, command: command.type, data: { available } }
      }
      case 'get-running-instances': {
        return { success: true, command: command.type, data: [] }
      }
      case 'generate-code': {
        return {
          success: false,
          command: command.type,
          message: 'Cursor does not support headless code generation via CLI',
        }
      }
      default: {
        return {
          success: false,
          command: (command as HarnessCommand).type,
          message: `Command not supported by ${this.name}`,
        }
      }
    }
  }

  onEvent(handler: (event: HarnessEvent) => void): () => void {
    this.eventHandlers.add(handler)
    return () => this.eventHandlers.delete(handler)
  }

  async dispose(): Promise<void> {
    this.eventHandlers.clear()
  }
}
