import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { HarnessAdapter } from '../types/adapter.js';
import type {
  HarnessCapabilities,
  HarnessCommand,
  HarnessCommandResult,
  HarnessEvent,
  HarnessInfo,
} from '../types/core.js';
import { WorkboardManager } from '../workboard/workboard-manager.js';

const execFileAsync = promisify(execFile);

/**
 * Adapter for Cursor IDE.
 *
 * Cursor is a VS Code fork with built-in AI capabilities.
 * This adapter detects Cursor via `cursor --version` and provides
 * workboard read/write when REVEALUI_WORKBOARD_PATH is set.
 */
export class CursorAdapter implements HarnessAdapter {
  readonly id = 'cursor';
  readonly name = 'Cursor';

  private readonly eventHandlers = new Set<(event: HarnessEvent) => void>();
  private readonly workboardPath: string | undefined;

  constructor(workboardPath?: string) {
    this.workboardPath = workboardPath ?? process.env.REVEALUI_WORKBOARD_PATH;
  }

  getCapabilities(): HarnessCapabilities {
    return {
      generateCode: false,
      analyzeCode: false,
      applyEdit: false,
      applyConfig: false,
      readWorkboard: this.workboardPath !== undefined,
      writeWorkboard: this.workboardPath !== undefined,
    };
  }

  async getInfo(): Promise<HarnessInfo> {
    let version: string | undefined;
    try {
      const { stdout } = await execFileAsync('cursor', ['--version'], {
        timeout: 5000,
      });
      version = stdout.trim().split('\n')[0];
    } catch {
      // Not installed or version flag unsupported.
    }
    return { id: this.id, name: this.name, version, capabilities: this.getCapabilities() };
  }

  async isAvailable(): Promise<boolean> {
    try {
      await execFileAsync('cursor', ['--version'], { timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }

  notifyRegistered(): void {
    this.emit({ type: 'harness-connected', harnessId: this.id });
  }

  notifyUnregistering(): void {
    this.emit({ type: 'harness-disconnected', harnessId: this.id });
  }

  async execute(command: HarnessCommand): Promise<HarnessCommandResult> {
    try {
      return await this.executeInner(command);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.emit({ type: 'error', harnessId: this.id, message });
      return { success: false, command: command.type, message };
    }
  }

  private async executeInner(command: HarnessCommand): Promise<HarnessCommandResult> {
    switch (command.type) {
      case 'get-status': {
        const available = await this.isAvailable();
        return { success: true, command: command.type, data: { available } };
      }
      case 'read-workboard': {
        if (!this.workboardPath) {
          return {
            success: false,
            command: command.type,
            message: 'REVEALUI_WORKBOARD_PATH is not set',
          };
        }
        const manager = new WorkboardManager(this.workboardPath);
        const state = await manager.readAsync();
        return { success: true, command: command.type, data: state };
      }
      case 'update-workboard': {
        if (!this.workboardPath) {
          return {
            success: false,
            command: command.type,
            message: 'REVEALUI_WORKBOARD_PATH is not set',
          };
        }
        const manager = new WorkboardManager(this.workboardPath);
        manager.updateAgent(command.sessionId, {
          ...(command.task !== undefined && { task: command.task }),
          ...(command.files !== undefined && { files: command.files.join(', ') }),
          updated: `${new Date().toISOString().slice(0, 16)}Z`,
        });
        return { success: true, command: command.type };
      }
      default: {
        return {
          success: false,
          command: (command as HarnessCommand).type,
          message: `Command not supported by ${this.name}`,
        };
      }
    }
  }

  onEvent(handler: (event: HarnessEvent) => void): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  async dispose(): Promise<void> {
    this.eventHandlers.clear();
  }

  private emit(event: HarnessEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch {
        // Swallow subscriber errors — never let a listener crash the adapter
      }
    }
  }
}
