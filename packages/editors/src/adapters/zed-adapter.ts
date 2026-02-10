import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { diffConfig, syncConfig } from '../config/config-sync.js'
import { findEditorProcesses } from '../detection/process-detector.js'
import type {
  EditorAdapter,
  EditorCapabilities,
  EditorCommand,
  EditorCommandResult,
  EditorEvent,
  EditorInfo,
} from '../types/index.js'

const execFileAsync = promisify(execFile)

export class ZedAdapter implements EditorAdapter {
  readonly id = 'zed'
  readonly name = 'Zed'

  private eventHandlers = new Set<(event: EditorEvent) => void>()
  private zedPath: string

  constructor(zedPath = 'zed') {
    this.zedPath = zedPath
  }

  getCapabilities(): EditorCapabilities {
    return {
      openProject: true,
      openFile: true,
      jumpToLine: true,
      applyConfig: true,
      installExtension: false,
      getRunningInstances: true,
    }
  }

  async getInfo(): Promise<EditorInfo> {
    let version: string | undefined
    try {
      const { stdout } = await execFileAsync(this.zedPath, ['--version'])
      version = stdout.trim()
    } catch {
      // Zed not available
    }
    return { id: this.id, name: this.name, version, capabilities: this.getCapabilities() }
  }

  async isAvailable(): Promise<boolean> {
    try {
      await execFileAsync(this.zedPath, ['--version'])
      return true
    } catch {
      return false
    }
  }

  async execute(command: EditorCommand): Promise<EditorCommandResult> {
    try {
      switch (command.type) {
        case 'open-project': {
          await execFileAsync(this.zedPath, [command.path])
          return { success: true, command: command.type }
        }
        case 'open-file': {
          const target =
            command.line !== undefined
              ? `${command.path}:${command.line}${command.column !== undefined ? `:${command.column}` : ''}`
              : command.path
          await execFileAsync(this.zedPath, [target])
          return { success: true, command: command.type }
        }
        case 'get-status': {
          const info = await this.getInfo()
          return { success: true, command: command.type, data: info }
        }
        case 'get-running-instances': {
          const instances = await findEditorProcesses(this.id)
          return { success: true, command: command.type, data: instances }
        }
        case 'sync-config': {
          const result = await syncConfig(this.id, command.direction)
          return {
            success: result.success,
            command: command.type,
            message: result.message,
            data: result,
          }
        }
        case 'diff-config': {
          const diff = await diffConfig(this.id)
          return { success: true, command: command.type, data: diff }
        }
        default:
          return { success: false, command: command.type, message: `Unsupported: ${command.type}` }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.emit({ type: 'error', editorId: this.id, error: message })
      return { success: false, command: command.type, message }
    }
  }

  onEvent(handler: (event: EditorEvent) => void): () => void {
    this.eventHandlers.add(handler)
    return () => this.eventHandlers.delete(handler)
  }

  private emit(event: EditorEvent): void {
    for (const handler of this.eventHandlers) handler(event)
  }

  async dispose(): Promise<void> {
    this.eventHandlers.clear()
  }
}
