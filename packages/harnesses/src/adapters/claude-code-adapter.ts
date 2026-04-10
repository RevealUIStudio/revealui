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
 * Adapter for Anthropic Claude Code (CLI: `claude`).
 *
 * Claude Code communicates via its CLI. Config lives at
 * ~/.claude/settings.json and project-level .claude/settings.json.
 * MCP integration is handled separately by @revealui/mcp.
 *
 * Workboard read/write requires REVEALUI_WORKBOARD_PATH to be set to the
 * absolute path of the workboard.md file.
 */
export class ClaudeCodeAdapter implements HarnessAdapter {
  readonly id = 'claude-code';
  readonly name = 'Claude Code';

  private readonly eventHandlers = new Set<(event: HarnessEvent) => void>();
  private readonly workboardPath: string | undefined;

  constructor(workboardPath?: string) {
    this.workboardPath = workboardPath ?? process.env.REVEALUI_WORKBOARD_PATH;
  }

  getCapabilities(): HarnessCapabilities {
    return {
      generateCode: true, // via `claude --print` CLI mode
      analyzeCode: true, // via `claude --print` CLI mode
      applyEdit: false, // interactive only — edits are applied inside Claude Code sessions
      applyConfig: false, // config managed interactively via ~/.claude/settings.json
      readWorkboard: this.workboardPath !== undefined,
      writeWorkboard: this.workboardPath !== undefined,
    };
  }

  async getInfo(): Promise<HarnessInfo> {
    let version: string | undefined;
    try {
      const { stdout } = await execFileAsync('claude', ['--version'], {
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
      await execFileAsync('claude', ['--version'], { timeout: 3000 });
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
      case 'get-running-instances': {
        // Claude Code process enumeration is not supported.
        return { success: true, command: command.type, data: [] };
      }
      case 'generate-code': {
        const genArgs = ['--print', command.prompt];
        if (command.context) {
          genArgs.push('--context', command.context);
        }
        try {
          const { stdout } = await execFileAsync('claude', genArgs, { timeout: 120_000 });
          return { success: true, command: command.type, data: stdout.trim() };
        } catch (err) {
          return {
            success: false,
            command: command.type,
            message: err instanceof Error ? err.message : String(err),
          };
        }
      }
      case 'analyze-code': {
        const analyzePrompt = `Analyze the file ${command.filePath}${command.question ? `: ${command.question}` : ''}`;
        try {
          const { stdout } = await execFileAsync('claude', ['--print', analyzePrompt], {
            timeout: 120_000,
          });
          return { success: true, command: command.type, data: stdout.trim() };
        } catch (err) {
          return {
            success: false,
            command: command.type,
            message: err instanceof Error ? err.message : String(err),
          };
        }
      }
      case 'apply-config': {
        return {
          success: false,
          command: command.type,
          message: 'Config is managed interactively via ~/.claude/settings.json',
        };
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
