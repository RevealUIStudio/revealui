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

export class NeovimAdapter implements EditorAdapter {
  readonly id = 'neovim'
  readonly name = 'Neovim'

  private eventHandlers = new Set<(event: EditorEvent) => void>()
  private nvimPath: string
  private serverAddress: string | undefined

  constructor(nvimPath = 'nvim', serverAddress?: string) {
    this.nvimPath = nvimPath
    this.serverAddress = serverAddress
  }

  getCapabilities(): EditorCapabilities {
    return {
      openProject: true,
      openFile: true,
      jumpToLine: true,
      applyConfig: false,
      installExtension: false,
      getRunningInstances: true,
    }
  }

  async getInfo(): Promise<EditorInfo> {
    let version: string | undefined
    try {
      const { stdout } = await execFileAsync(this.nvimPath, ['--version'])
      // First line: "NVIM v0.10.0"
      version = stdout.trim().split('\n')[0]
    } catch {
      // Neovim not available
    }
    return { id: this.id, name: this.name, version, capabilities: this.getCapabilities() }
  }

  async isAvailable(): Promise<boolean> {
    try {
      await execFileAsync(this.nvimPath, ['--version'])
      return true
    } catch {
      return false
    }
  }

  async execute(command: EditorCommand): Promise<EditorCommandResult> {
    try {
      switch (command.type) {
        case 'open-project': {
          if (this.serverAddress) {
            await execFileAsync(this.nvimPath, [
              '--server',
              this.serverAddress,
              '--remote-send',
              `:cd ${command.path}<CR>`,
            ])
          } else {
            await execFileAsync(this.nvimPath, [command.path])
          }
          return { success: true, command: command.type }
        }
        case 'open-file': {
          if (this.serverAddress) {
            const remoteCmd =
              command.line !== undefined
                ? `:e +${command.line} ${command.path}<CR>`
                : `:e ${command.path}<CR>`
            await execFileAsync(this.nvimPath, [
              '--server',
              this.serverAddress,
              '--remote-send',
              remoteCmd,
            ])
          } else {
            const args =
              command.line !== undefined ? [`+${command.line}`, command.path] : [command.path]
            await execFileAsync(this.nvimPath, args)
          }
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
