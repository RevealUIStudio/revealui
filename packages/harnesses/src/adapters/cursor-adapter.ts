/**
 * Cursor Adapter
 *
 * Wraps the Cursor CLI, promoting the `cursor` data-only roadmap profile
 * (`../protocol/roadmap-profiles.ts`) into a working adapter, the same way
 * `OpenCodeAdapter` promoted `opencode` (revealui#1911). Like OpenCodeAdapter,
 * this is a thin control-plane wrapper -- it detects, drives, and observes a
 * locally-installed Cursor CLI. It grants no RevealUI data-plane authority;
 * that flows through the governed MCP endpoint via `.cursor/mcp.json`
 * (`../content/generators/cursor.ts` + `protocolConfigToCursorMcpConfig`),
 * and receipt/policy enforcement flows through `.cursor/hooks.json` +
 * `revealui-harnesses hook cursor` (`../hooks/`), not through this adapter.
 *
 * Binary + flags verified 2026-07-17 against cursor.com/docs/cli/installation
 * and cursor.com/docs/cli/headless: the installed executable is `agent`
 * (installed via `curl https://cursor.com/install -fsSL | bash`), supporting
 * `--version`, `-p`/`--print` (headless), `--output-format json|text`, and
 * `--force` (apply changes directly rather than only proposing them). The
 * exact `--output-format json` response shape is UNVERIFIED against a real
 * binary, same posture as `opencode-adapter.ts`'s `parseOpenCodeRunOutput` --
 * `parseCursorAgentOutput` below is defensive for the same reason.
 *
 * `agent` is deliberately NOT added to `process-detector.ts`'s
 * `HARNESS_PROCESS_PATTERNS` -- it is too generic a substring for `pgrep -a`
 * (it would false-match `ssh-agent`, `gpg-agent`, and similar unrelated
 * processes). `isAvailable()` below checks the binary directly via
 * `execFile`, which does not have that hazard.
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

/** Default timeout for a one-shot `agent -p` invocation (2 minutes). */
const DEFAULT_RUN_TIMEOUT_MS = 120_000;
/** Timeout for availability/version checks -- these must be fast (3s). */
const AVAILABILITY_TIMEOUT_MS = 3_000;
/** Cap stdout/stderr buffering for `agent -p` (10 MB). */
const MAX_BUFFER_BYTES = 10 * 1024 * 1024;

/** Configuration for the Cursor adapter. All fields are optional. */
export interface CursorAdapterConfig {
  /** Project root the `agent` CLI runs against (default: cwd) */
  projectRoot?: string;
  /** Model override passed as `--model` (default: Cursor's own default) */
  model?: string;
  /** Timeout for `agent -p` invocations in ms (default: 120000) */
  timeoutMs?: number;
  /** Path/name of the Cursor CLI executable (default: 'agent', resolved via PATH) */
  binaryPath?: string;
}

const DEFAULT_CONFIG: Required<Pick<CursorAdapterConfig, 'timeoutMs' | 'binaryPath'>> = {
  timeoutMs: DEFAULT_RUN_TIMEOUT_MS,
  binaryPath: 'agent',
};

/**
 * Parse `agent -p --output-format json` stdout into a plain-text output
 * string. Shape UNVERIFIED against a real binary (see module doc) --
 * mirrors `parseOpenCodeRunOutput`'s defensive multi-key extraction.
 */
export function parseCursorAgentOutput(stdout: string): string {
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

/**
 * Turn an `execFile` rejection into a helpful message, special-casing the
 * "binary not on PATH" case. Exported for direct unit testing.
 */
export function describeCursorAgentExecError(err: unknown): string {
  if (
    err &&
    typeof err === 'object' &&
    'code' in err &&
    (err as { code?: string }).code === 'ENOENT'
  ) {
    return 'Cursor CLI ("agent") not found on PATH. Install via `curl https://cursor.com/install -fsSL | bash`, then retry.';
  }
  const message = err instanceof Error ? err.message : String(err);
  const stderr =
    err && typeof err === 'object' && 'stderr' in err
      ? String((err as { stderr: unknown }).stderr)
      : '';
  return stderr ? `${message}\n${stderr}`.trim() : message;
}

/**
 * Cursor harness adapter -- promotes the `cursor` data-only roadmap profile
 * to a working adapter, mirroring `OpenCodeAdapter`'s structure exactly.
 */
export class CursorAdapter implements HarnessAdapter {
  readonly id = 'cursor';
  readonly name = 'Cursor';

  private readonly config: CursorAdapterConfig;
  private readonly binary: string;
  private readonly eventHandlers = new Set<(event: HarnessEvent) => void>();
  private readonly protocolEventHandlers = new Set<(event: ProtocolEventEnvelope) => void>();
  private protocolNormalizer: EventNormalizer | null = null;

  constructor(config?: CursorAdapterConfig) {
    this.config = { ...config };
    this.binary = config?.binaryPath ?? DEFAULT_CONFIG.binaryPath;
  }

  getCapabilities(): HarnessCapabilities {
    return {
      generateCode: true,
      analyzeCode: true,
      // `agent -p --force` applies edits itself during generation; there is
      // no clean CLI surface for the adapter to apply an externally-supplied
      // diff (same reasoning as OpenCodeAdapter).
      applyEdit: false,
      applyConfig: true,
      // Workboard support is not wired -- same honest posture as
      // RevealUIAgentAdapter / OpenCodeAdapter.
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

  /** Get the Harness Protocol capability profile for this adapter. */
  getProtocolCapabilities(): ProtocolCapabilities {
    // cursor is promoted into TOOL_PROFILES when CursorAdapter ships.
    return TOOL_PROFILES.cursor as ProtocolCapabilities;
  }

  /** Subscribe to protocol-normalized events. */
  onProtocolEvent(handler: (event: ProtocolEventEnvelope) => void): () => void {
    this.protocolEventHandlers.add(handler);
    if (!this.protocolNormalizer) {
      this.protocolNormalizer = new EventNormalizer('cursor', this.id, `session-${Date.now()}`);
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
        return this.runCursorAgent(command.type, command.prompt, {
          timeoutMs: command.timeoutMs,
          force: false,
        });
      }

      case 'generate-code': {
        const prompt = `Generate code: ${command.prompt}${command.language ? ` (language: ${command.language})` : ''}${command.context ? `\n\nContext:\n${command.context}` : ''}`;
        return this.runCursorAgent(command.type, prompt, { force: true });
      }

      case 'analyze-code': {
        const question = command.question ?? 'Analyze this file and explain what it does.';
        const prompt = `Read the file at ${command.filePath} and answer: ${question}`;
        return this.runCursorAgent(command.type, prompt, { force: false });
      }

      case 'apply-edit': {
        return {
          success: false,
          command: command.type,
          message:
            'apply-edit is not supported by the Cursor adapter -- the CLI applies edits itself during a forced run; there is no clean CLI surface for an externally-supplied diff.',
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

  /** Write `content` to `configPath`, resolved under the configured project root. */
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
   * Run a one-shot `agent -p` invocation and normalize its output. Emits
   * `generation-started` / `generation-completed` around the call, mirroring
   * `opencode-adapter.ts`'s event pattern. `opts.force` maps to `--force`
   * (apply edits directly) -- omitted for analyze/headless prompts, which
   * should not mutate the project.
   */
  private async runCursorAgent(
    commandType: HarnessCommand['type'],
    prompt: string,
    opts: { timeoutMs?: number; force: boolean },
  ): Promise<HarnessCommandResult> {
    const taskId = `task-${Date.now()}`;
    this.emit({ type: 'generation-started', taskId });

    const args = ['-p', prompt, '--output-format', 'json'];
    if (opts.force) args.push('--force');
    if (this.config.model) args.push('--model', this.config.model);

    try {
      const { stdout } = await execFileAsync(this.binary, args, {
        cwd: this.config.projectRoot ?? process.cwd(),
        timeout: opts.timeoutMs ?? this.config.timeoutMs ?? DEFAULT_CONFIG.timeoutMs,
        maxBuffer: MAX_BUFFER_BYTES,
      });

      const output = parseCursorAgentOutput(stdout);
      this.emit({ type: 'generation-completed', taskId, output });

      return {
        success: true,
        command: commandType,
        message: output,
        data: { taskId, output },
      };
    } catch (err) {
      return { success: false, command: commandType, message: describeCursorAgentExecError(err) };
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
