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
 * Adapter for Anthropic Claude Code (CLI: `claude`).
 *
 * Claude Code communicates via its CLI. Config lives at
 * ~/.claude/settings.json and project-level .claude/settings.json.
 * MCP integration is handled separately by @revealui/mcp.
 */
export class ClaudeCodeAdapter implements HarnessAdapter {
  readonly id = 'claude-code'
  readonly name = 'Claude Code'

  private readonly eventHandlers = new Set<(event: HarnessEvent) => void>()

  getCapabilities(): HarnessCapabilities {
    return {
      generateCode: true,
      analyzeCode: true,
      applyEdit: false, // Claude Code applies edits interactively, not via CLI flags
      applyConfig: true,
      readWorkboard: true,
      writeWorkboard: true,
    }
  }

  async getInfo(): Promise<HarnessInfo> {
    let version: string | undefined
    try {
      const { stdout } = await execFileAsync('claude', ['--version'], {
        timeout: 5000,
      })
      version = stdout.trim().split('\n')[0]
    } catch {
      // Not installed or version flag unsupported.
    }
    return { id: this.id, name: this.name, version, capabilities: this.getCapabilities() }
  }

  async isAvailable(): Promise<boolean> {
    try {
      await execFileAsync('claude', ['--version'], { timeout: 3000 })
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
        // Claude Code is interactive; generation is not supported via this adapter.
        return {
          success: false,
          command: command.type,
          message: 'Claude Code does not support headless code generation via this adapter',
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
