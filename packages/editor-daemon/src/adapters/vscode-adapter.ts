import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type {
  EditorAdapter,
  EditorCapabilities,
  EditorCommand,
  EditorCommandResult,
  EditorEvent,
  EditorInfo,
} from '@revealui/editor-sdk'
import { diffConfig, syncConfig } from '../config/config-sync.js'
import { findEditorProcesses } from '../detection/process-detector.js'

const execFileAsync = promisify(execFile)

export class VscodeAdapter implements EditorAdapter {
  readonly id = 'vscode'
  readonly name = 'VS Code'

  private eventHandlers = new Set<(event: EditorEvent) => void>()
  private codePath: string

  constructor(codePath = 'code') {
    this.codePath = codePath
  }

  getCapabilities(): EditorCapabilities {
    return {
      openProject: true,
      openFile: true,
      jumpToLine: true,
      applyConfig: true,
      installExtension: true,
      getRunningInstances: true,
    }
  }

  async getInfo(): Promise<EditorInfo> {
    let version: string | undefined
    try {
      const { stdout } = await execFileAsync(this.codePath, ['--version'])
      // code --version outputs multiline: "1.85.0\nhash\nx64" — take first line
      version = stdout.trim().split('\n')[0]
    } catch {
      // VS Code not available
    }
    return { id: this.id, name: this.name, version, capabilities: this.getCapabilities() }
  }

  async isAvailable(): Promise<boolean> {
    try {
      await execFileAsync(this.codePath, ['--version'])
      return true
    } catch {
      return false
    }
  }

  async execute(command: EditorCommand): Promise<EditorCommandResult> {
    try {
      switch (command.type) {
        case 'open-project': {
          await execFileAsync(this.codePath, [command.path])
          return { success: true, command: command.type }
        }
        case 'open-file': {
          const target =
            command.line !== undefined
              ? `${command.path}:${command.line}${command.column !== undefined ? `:${command.column}` : ''}`
              : command.path
          await execFileAsync(this.codePath, ['--goto', target])
          return { success: true, command: command.type }
        }
        case 'install-extension': {
          await execFileAsync(this.codePath, ['--install-extension', command.extensionId])
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
