/**
 * OpenCode Adapter
 *
 * Wraps the external `opencode` CLI (execFile), following the CLI-wrapping
 * pattern in `translation-layer.ts`. Unlike `RevealUIAgentAdapter` (which IS
 * the runtime), this adapter is a thin control-plane wrapper: it detects,
 * drives, and observes a locally-installed `opencode` binary. It grants no
 * RevealUI data-plane authority -- that flows through the governed MCP
 * endpoint with its own bearer token (design doc §3, "bridging rule B-1").
 *
 * `opencode run <prompt> --format json` output shape is UNVERIFIED against a
 * real binary (design doc §2.4) -- `parseRunOutput` below is defensive and
 * documents exactly what it assumes.
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

/** Default timeout for a one-shot `opencode run` invocation (2 minutes). */
const DEFAULT_RUN_TIMEOUT_MS = 120_000;
/** Timeout for availability/version checks -- these must be fast (3s). */
const AVAILABILITY_TIMEOUT_MS = 3_000;
/** Cap stdout/stderr buffering for `opencode run` (10 MB). */
const MAX_BUFFER_BYTES = 10 * 1024 * 1024;

/**
 * Configuration for the OpenCode adapter. All fields are optional -- sensible
 * defaults are applied.
 */
export interface OpenCodeAdapterConfig {
  /** Project root the `opencode` CLI runs against (default: cwd) */
  projectRoot?: string;
  /** Model override passed as `--model` (default: OpenCode's own default) */
  model?: string;
  /** Agent override passed as `--agent` */
  agent?: string;
  /** Timeout for `opencode run` invocations in ms (default: 120000) */
  timeoutMs?: number;
  /** Path/name of the `opencode` executable (default: 'opencode', resolved via PATH) */
  binaryPath?: string;
}

const DEFAULT_CONFIG: Required<Pick<OpenCodeAdapterConfig, 'timeoutMs' | 'binaryPath'>> = {
  timeoutMs: DEFAULT_RUN_TIMEOUT_MS,
  binaryPath: 'opencode',
};

/**
 * Parse `opencode run --format json` stdout into a plain-text output string.
 * The exact shape is UNVERIFIED against a real binary (design doc §2.4) --
 * this deliberately degrades gracefully:
 *   1. Valid JSON object with a known text-bearing key (`output`, `text`,
 *      `message`, `content`) -- return that string.
 *   2. Valid JSON of any other shape -- return the raw JSON text so no
 *      information is lost.
 *   3. Not JSON at all -- treat stdout as plain text (opencode's non-JSON
 *      `run` mode is plain text; `--format json` failing silently to emit
 *      JSON should not throw away the response).
 *
 * Exported (rather than a private method) so the parsing logic is directly
 * unit-testable against the documented-but-unverified shape without
 * mocking `execFile`.
 */
export function parseOpenCodeRunOutput(stdout: string): string {
  const trimmed = stdout.trim();
  if (trimmed.length === 0) return '';

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (typeof parsed === 'string') return parsed;
    if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>;
      for (const key of ['output', 'text', 'message', 'content']) {
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
export function describeOpenCodeExecError(err: unknown): string {
  if (
    err &&
    typeof err === 'object' &&
    'code' in err &&
    (err as { code?: string }).code === 'ENOENT'
  ) {
    return 'opencode CLI not found on PATH. Install via the curl script, `npm install -g opencode-ai`, or brew, then retry.';
  }
  const message = err instanceof Error ? err.message : String(err);
  const stderr =
    err && typeof err === 'object' && 'stderr' in err
      ? String((err as { stderr: unknown }).stderr)
      : '';
  return stderr ? `${message}\n${stderr}`.trim() : message;
}

/**
 * OpenCode harness adapter -- the first external-CLI adapter in this package
 * (`RevealUIAgentAdapter` IS the runtime; `translation-layer.ts` shows the
 * `execFile` pattern this adapter follows).
 */
export class OpenCodeAdapter implements HarnessAdapter {
  readonly id = 'opencode';
  readonly name = 'OpenCode';

  private readonly config: OpenCodeAdapterConfig;
  private readonly binary: string;
  private readonly eventHandlers = new Set<(event: HarnessEvent) => void>();
  private readonly protocolEventHandlers = new Set<(event: ProtocolEventEnvelope) => void>();
  private protocolNormalizer: EventNormalizer | null = null;

  constructor(config?: OpenCodeAdapterConfig) {
    this.config = { ...config };
    this.binary = config?.binaryPath ?? DEFAULT_CONFIG.binaryPath;
  }

  getCapabilities(): HarnessCapabilities {
    return {
      generateCode: true,
      analyzeCode: true,
      // `opencode run` applies edits itself during generation; there is no
      // clean CLI surface for the adapter to apply an externally-supplied
      // diff (design doc §8.2).
      applyEdit: false,
      applyConfig: true,
      // Workboard support is not wired -- same honest posture as
      // RevealUIAgentAdapter (`execute()` below returns success:false for
      // both read-workboard and update-workboard).
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
    // opencode is always defined in TOOL_PROFILES (promoted from
    // ROADMAP_PROFILES when this adapter shipped).
    return TOOL_PROFILES.opencode as ProtocolCapabilities;
  }

  /** Subscribe to protocol-normalized events. */
  onProtocolEvent(handler: (event: ProtocolEventEnvelope) => void): () => void {
    this.protocolEventHandlers.add(handler);
    if (!this.protocolNormalizer) {
      this.protocolNormalizer = new EventNormalizer('opencode', this.id, `session-${Date.now()}`);
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
            agent: this.config.agent ?? 'auto',
            projectRoot: this.config.projectRoot ?? process.cwd(),
          },
        };
      }

      case 'headless-prompt': {
        return this.runOpenCodeRun(command.type, command.prompt, { timeoutMs: command.timeoutMs });
      }

      case 'generate-code': {
        const prompt = `Generate code: ${command.prompt}${command.language ? ` (language: ${command.language})` : ''}${command.context ? `\n\nContext:\n${command.context}` : ''}`;
        return this.runOpenCodeRun(command.type, prompt);
      }

      case 'analyze-code': {
        const question = command.question ?? 'Analyze this file and explain what it does.';
        const prompt = `Read the file at ${command.filePath} and answer: ${question}`;
        return this.runOpenCodeRun(command.type, prompt);
      }

      case 'apply-edit': {
        return {
          success: false,
          command: command.type,
          message:
            'apply-edit is not supported by the OpenCode adapter -- opencode applies edits itself during `run`; there is no clean CLI surface for an externally-supplied diff.',
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
        // Workboard support delegated to WorkboardManager (same posture as
        // revealui-agent-adapter.ts) -- not wired at the adapter level.
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
   * Run a one-shot `opencode run` invocation and normalize its output.
   * Emits `generation-started` / `generation-completed` around the call,
   * mirroring `revealui-agent-adapter.ts`'s event pattern.
   */
  private async runOpenCodeRun(
    commandType: HarnessCommand['type'],
    prompt: string,
    opts?: { timeoutMs?: number },
  ): Promise<HarnessCommandResult> {
    const taskId = `task-${Date.now()}`;
    this.emit({ type: 'generation-started', taskId });

    const args = ['run', prompt, '--format', 'json'];
    if (this.config.model) args.push('--model', this.config.model);
    if (this.config.agent) args.push('--agent', this.config.agent);

    try {
      const { stdout } = await execFileAsync(this.binary, args, {
        cwd: this.config.projectRoot ?? process.cwd(),
        timeout: opts?.timeoutMs ?? this.config.timeoutMs ?? DEFAULT_CONFIG.timeoutMs,
        maxBuffer: MAX_BUFFER_BYTES,
      });

      const output = parseOpenCodeRunOutput(stdout);
      this.emit({ type: 'generation-completed', taskId, output });

      return {
        success: true,
        command: commandType,
        message: output,
        data: { taskId, output },
      };
    } catch (err) {
      return { success: false, command: commandType, message: describeOpenCodeExecError(err) };
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
