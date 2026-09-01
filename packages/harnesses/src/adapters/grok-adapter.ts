/**
 * Grok Adapter (Level 2)
 *
 * Thin control-plane wrapper around the `grok` CLI. Interactive Grok sessions
 * stay on RevKit `rfg`. This adapter is for programmatic dispatch
 * (`grok -p` / `--single`), the same execFile pattern as OpenCodeAdapter.
 *
 * Headless shape pinned against grok 1.0.13: `-p <prompt>` prints the
 * response and exits; `--output-format json` is the structured mode.
 * `parseGrokSingleOutput` is defensive (unknown JSON keys fall back to
 * stdout) because xAI has not published a stable JSON schema for `-p`.
 *
 * Does not grant RevealUI data-plane authority -- that stays on the
 * governed MCP endpoint (`rfg` mint / device token).
 */

import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import { diffConfig, syncConfig } from '../config/config-sync.js';
import { findHarnessProcesses } from '../detection/process-detector.js';
import type { ProtocolCapabilities } from '../protocol/capabilities.js';
import { TOOL_PROFILES } from '../protocol/capabilities.js';
import type { ProtocolEventEnvelope } from '../protocol/event-envelope.js';
import { EventNormalizer } from '../protocol/event-normalizer.js';
import type { HarnessAdapter } from '../types/adapter.js';
import type {
  HarnessCapabilities,
  HarnessCommand,
  HarnessCommandResult,
  HarnessEvent,
  HarnessInfo,
} from '../types/core.js';

const execFileAsync = promisify(execFile);

const DEFAULT_RUN_TIMEOUT_MS = 120_000;
const AVAILABILITY_TIMEOUT_MS = 3_000;
const MAX_BUFFER_BYTES = 10 * 1024 * 1024;

export interface GrokAdapterConfig {
  projectRoot?: string;
  model?: string;
  timeoutMs?: number;
  binaryPath?: string;
}

const DEFAULT_CONFIG: Required<Pick<GrokAdapterConfig, 'timeoutMs' | 'binaryPath'>> = {
  timeoutMs: DEFAULT_RUN_TIMEOUT_MS,
  binaryPath: 'grok',
};

/**
 * Parse `grok -p --output-format json` stdout into a plain-text string.
 *
 * Defensive (not a pinned vendor schema): prefer known text-bearing keys,
 * else return trimmed stdout. Exported for unit tests without execFile.
 */
export function parseGrokSingleOutput(stdout: string): string {
  const trimmed = stdout.trim();
  if (trimmed.length === 0) return '';

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (typeof parsed === 'string') return parsed;
    if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>;
      for (const key of ['result', 'output', 'text', 'message', 'content']) {
        const value = obj[key];
        if (typeof value === 'string') return value;
      }
    }
    return trimmed;
  } catch {
    return trimmed;
  }
}

/** Turn an execFile rejection into a helpful message. Exported for tests. */
export function describeGrokExecError(err: unknown): string {
  if (
    err &&
    typeof err === 'object' &&
    'code' in err &&
    (err as { code?: string }).code === 'ENOENT'
  ) {
    return 'grok CLI not found on PATH. Install Grok Build TUI, then launch interactive sessions with rfg.';
  }
  const message = err instanceof Error ? err.message : String(err);
  const stderr =
    err && typeof err === 'object' && 'stderr' in err
      ? String((err as { stderr: unknown }).stderr)
      : '';
  return stderr ? `${message}\n${stderr}`.trim() : message;
}

export class GrokAdapter implements HarnessAdapter {
  readonly id = 'grok';
  readonly name = 'Grok';

  private readonly config: GrokAdapterConfig;
  private readonly binary: string;
  private readonly eventHandlers = new Set<(event: HarnessEvent) => void>();
  private readonly protocolEventHandlers = new Set<(event: ProtocolEventEnvelope) => void>();
  private protocolNormalizer: EventNormalizer | null = null;

  constructor(config?: GrokAdapterConfig) {
    this.config = { ...config };
    this.binary = config?.binaryPath ?? DEFAULT_CONFIG.binaryPath;
  }

  getCapabilities(): HarnessCapabilities {
    return {
      generateCode: true,
      analyzeCode: true,
      applyEdit: false,
      applyConfig: true,
      readWorkboard: false,
      writeWorkboard: false,
    };
  }

  async getInfo(): Promise<HarnessInfo> {
    return {
      id: this.id,
      name: this.name,
      version: await this.getVersion(),
      capabilities: this.getCapabilities(),
    };
  }

  getProtocolCapabilities(): ProtocolCapabilities {
    return TOOL_PROFILES.grok as ProtocolCapabilities;
  }

  onProtocolEvent(handler: (event: ProtocolEventEnvelope) => void): () => void {
    this.protocolEventHandlers.add(handler);
    if (!this.protocolNormalizer) {
      this.protocolNormalizer = new EventNormalizer('grok', this.id, `session-${Date.now()}`);
    }
    return () => this.protocolEventHandlers.delete(handler);
  }

  async isAvailable(): Promise<boolean> {
    try {
      await execFileAsync(this.binary, ['--version'], { timeout: AVAILABILITY_TIMEOUT_MS });
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
        return {
          success: true,
          command: command.type,
          data: {
            available,
            model: this.config.model ?? 'auto',
            projectRoot: this.config.projectRoot ?? process.cwd(),
          },
        };
      }

      case 'headless-prompt': {
        return this.runGrokSingle(command.type, command.prompt, {
          timeoutMs: command.timeoutMs,
          maxTurns: command.maxTurns,
        });
      }

      case 'generate-code': {
        const prompt = `Generate code: ${command.prompt}${command.language ? ` (language: ${command.language})` : ''}${command.context ? `\n\nContext:\n${command.context}` : ''}`;
        return this.runGrokSingle(command.type, prompt);
      }

      case 'analyze-code': {
        const question = command.question ?? 'Analyze this file and explain what it does.';
        const prompt = `Read the file at ${command.filePath} and answer: ${question}`;
        return this.runGrokSingle(command.type, prompt);
      }

      case 'apply-edit': {
        return {
          success: false,
          command: command.type,
          message:
            'apply-edit is not supported by the Grok adapter -- grok -p applies edits itself; there is no CLI surface for an externally-supplied diff. Interactive sessions stay on rfg.',
        };
      }

      case 'apply-config': {
        return this.applyConfig(command.configPath, command.content);
      }

      case 'sync-config': {
        const result = syncConfig(this.id, command.direction);
        return { success: result.success, command: command.type, message: result.message };
      }

      case 'diff-config': {
        const diff = diffConfig(this.id);
        return { success: true, command: command.type, data: diff };
      }

      case 'read-workboard':
      case 'update-workboard': {
        return {
          success: false,
          command: command.type,
          message: 'Workboard support not yet wired  -  use WorkboardManager directly',
        };
      }

      case 'get-running-instances': {
        const instances = await findHarnessProcesses(this.id);
        return { success: true, command: command.type, data: { instances } };
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

  private async applyConfig(configPath: string, content: string): Promise<HarnessCommandResult> {
    const projectRoot = resolve(this.config.projectRoot ?? process.cwd());
    const resolved = resolve(projectRoot, configPath);
    const rootWithSep = projectRoot.endsWith(sep) ? projectRoot : projectRoot + sep;

    if (!(resolved === projectRoot || resolved.startsWith(rootWithSep))) {
      return {
        success: false,
        command: 'apply-config',
        message: `Refusing to write outside the project root: ${configPath}`,
      };
    }

    try {
      await mkdir(dirname(resolved), { recursive: true });
      await writeFile(resolved, content, 'utf8');
      return { success: true, command: 'apply-config', data: { path: resolved } };
    } catch (err) {
      return {
        success: false,
        command: 'apply-config',
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * One-shot `grok -p` (headless). Interactive TUI stays on `rfg`.
   * `--permission-mode dontAsk` avoids a hung TTY prompt; this is not
   * bypassPermissions.
   */
  private async runGrokSingle(
    commandType: HarnessCommand['type'],
    prompt: string,
    opts?: { timeoutMs?: number; maxTurns?: number },
  ): Promise<HarnessCommandResult> {
    const taskId = `task-${Date.now()}`;
    this.emit({ type: 'generation-started', taskId });

    const args = [
      '-p',
      prompt,
      '--output-format',
      'json',
      '--permission-mode',
      'dontAsk',
      '--no-alt-screen',
    ];
    if (this.config.model) args.push('--model', this.config.model);
    if (opts?.maxTurns !== undefined) args.push('--max-turns', String(opts.maxTurns));
    const cwd = this.config.projectRoot ?? process.cwd();
    args.push('--cwd', cwd);

    try {
      const { stdout } = await execFileAsync(this.binary, args, {
        cwd,
        timeout: opts?.timeoutMs ?? this.config.timeoutMs ?? DEFAULT_CONFIG.timeoutMs,
        maxBuffer: MAX_BUFFER_BYTES,
      });

      const output = parseGrokSingleOutput(stdout);
      this.emit({ type: 'generation-completed', taskId, output });

      return {
        success: true,
        command: commandType,
        message: output,
        data: { taskId, output },
      };
    } catch (err) {
      return { success: false, command: commandType, message: describeGrokExecError(err) };
    }
  }

  private async getVersion(): Promise<string | undefined> {
    try {
      const { stdout } = await execFileAsync(this.binary, ['--version'], {
        timeout: AVAILABILITY_TIMEOUT_MS,
      });
      const version = stdout.trim();
      return version.length > 0 ? version : undefined;
    } catch {
      return undefined;
    }
  }

  onEvent(handler: (event: HarnessEvent) => void): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  async dispose(): Promise<void> {
    this.eventHandlers.clear();
    this.protocolEventHandlers.clear();
    this.protocolNormalizer = null;
  }

  private emit(event: HarnessEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch {
        // Swallow subscriber errors
      }
    }

    if (this.protocolNormalizer && this.protocolEventHandlers.size > 0) {
      const envelope = this.protocolNormalizer.normalizeToEnvelope(event);
      if (envelope) {
        for (const handler of this.protocolEventHandlers) {
          try {
            handler(envelope);
          } catch {
            // Swallow subscriber errors
          }
        }
      }
    }
  }
}
