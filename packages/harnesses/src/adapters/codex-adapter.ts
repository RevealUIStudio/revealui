/**
 * Codex app-server v2 over newline-delimited JSON on stdio.
 * Wire fields verified against codex-cli 0.160.0 generated protocol types.
 * One isolated child per dispatch; threads may resume by project-scoped id.
 */
import { type ChildProcessWithoutNullStreams, execFile, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { findHarnessProcesses } from '../detection/process-detector.js';
import { checkCodexDelivery, codexPointerText } from '../manager/codex.js';
import { loadManager, managerPath } from '../manager/paths.js';
import type { McpServerConfig } from '../protocol/adapter.js';
import { type ProtocolCapabilities, TOOL_PROFILES } from '../protocol/capabilities.js';
import type { HarnessAdapter } from '../types/adapter.js';
import type {
  HarnessCapabilities,
  HarnessCommand,
  HarnessCommandResult,
  HarnessEvent,
  HarnessInfo,
} from '../types/core.js';

const execFileAsync = promisify(execFile);
const CLEANUP_MS = 500;
const MAX_WIRE_BYTES = 10 * 1024 * 1024;
type ObjectValue = Record<string, unknown>;
function object(value: unknown): ObjectValue {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid Codex protocol object');
  return value as ObjectValue;
}
function identifier(value: unknown): string {
  if (typeof value !== 'string' || !value) throw new Error('Missing Codex protocol identifier');
  return value;
}
function deferred<T>() {
  let resolvePromise!: (value: T) => void;
  let rejectPromise!: (error: Error) => void;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  // The terminal notification can arrive while initialization requests await.
  void promise.catch(() => undefined);
  return { promise, resolve: resolvePromise, reject: rejectPromise };
}
function milliseconds(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0 || value > 2_147_483_647)
    throw new Error('Codex timeout must be a positive timer-safe integer');
  return value;
}

export interface CodexApprovalRequest {
  taskId: string;
  requestId: string | number;
  method: 'item/commandExecution/requestApproval' | 'item/fileChange/requestApproval';
  /** Full native request, including command, reason and network context. */
  params: Readonly<ObjectValue>;
}
export type CodexApprovalDecision = 'accept' | 'decline' | 'cancel';

export interface CodexAdapterConfig {
  projectRoot?: string;
  binaryPath?: string;
  /** Omitted model inherits the user's Codex configuration. */
  model?: string;
  reasoningEffort?: 'low' | 'medium' | 'high';
  timeoutMs?: number;
  /** Canonical stdio MCP entries; supplied servers are required at startup.
   * Shared memory uses studioLocalKnowledgeGraphMcpServer(), with the existing
   * server principal provider. No identity or memory store is created here.
   */
  mcpServers?: McpServerConfig[];
  /** Host review for this request only. Missing, failed or expired review declines. */
  onApproval?: (
    request: CodexApprovalRequest,
    signal: AbortSignal,
  ) => CodexApprovalDecision | Promise<CodexApprovalDecision>;
  approvalTimeoutMs?: number;
  /** Read-only by default; workspace writes require explicit configuration. */
  sandbox?: 'read-only' | 'workspace-write';
}

interface ActiveRun {
  taskId: string;
  threadId?: string;
  turnId?: string;
  stopped?: string;
  terminal: boolean;
  done: ReturnType<typeof deferred<void>>;
  stop: (reason: string) => void;
}

export class CodexAdapter implements HarnessAdapter {
  readonly id = 'codex';
  readonly name = 'Codex';
  private readonly config: CodexAdapterConfig;
  private readonly root: string;
  private readonly binary: string;
  private active?: ActiveRun;
  private disposed = false;
  private readonly handlers = new Set<(event: HarnessEvent) => void>();

  constructor(config: CodexAdapterConfig = {}) {
    this.config = {
      ...config,
      timeoutMs: milliseconds(config.timeoutMs ?? 120_000),
      approvalTimeoutMs: milliseconds(config.approvalTimeoutMs ?? 30_000),
      mcpServers: config.mcpServers?.map((server) => ({
        ...server,
        args: server.args ? [...server.args] : undefined,
        env: server.env ? { ...server.env } : undefined,
      })),
    };
    const names = new Set<string>();
    for (const server of this.config.mcpServers ?? []) {
      if (!/^[a-zA-Z0-9_-]+$/.test(server.name) || names.has(server.name) || !server.command.trim())
        throw new Error('Codex MCP entries require unique safe names and non-empty commands');
      names.add(server.name);
    }
    this.root = resolve(config.projectRoot ?? process.cwd());
    this.binary = config.binaryPath ?? 'codex';
    if (config.sandbox && config.sandbox !== 'read-only' && config.sandbox !== 'workspace-write')
      throw new Error('Unsupported Codex sandbox');
  }

  getCapabilities(): HarnessCapabilities {
    return {
      generateCode: true,
      analyzeCode: true,
      applyEdit: false,
      applyConfig: false,
      readWorkboard: false,
      writeWorkboard: false,
    };
  }
  getProtocolCapabilities(): ProtocolCapabilities {
    return TOOL_PROFILES.codex as ProtocolCapabilities;
  }
  async getInfo(): Promise<HarnessInfo> {
    return {
      id: this.id,
      name: this.name,
      version: await this.version(),
      capabilities: this.getCapabilities(),
    };
  }
  private async version(): Promise<string | undefined> {
    try {
      const { stdout } = await execFileAsync(this.binary, ['--version'], {
        timeout: 3000,
        maxBuffer: 4096,
      });
      return stdout.trim() || undefined;
    } catch {
      return undefined;
    }
  }
  async isAvailable(): Promise<boolean> {
    if (this.disposed || !(await this.version())) return false;
    try {
      await execFileAsync(this.binary, ['app-server', '--help'], {
        timeout: 3000,
        maxBuffer: 64 * 1024,
      });
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
  onEvent(handler: (event: HarnessEvent) => void): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }
  private emit(event: HarnessEvent): void {
    // Subscribers cannot control process cleanup by throwing.
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch {
        /* Observer isolation. */
      }
    }
  }
  async dispose(): Promise<void> {
    this.disposed = true;
    const run = this.active;
    run?.stop('Codex adapter disposed');
    if (run) await run.done.promise;
    this.handlers.clear();
  }

  async execute(command: HarnessCommand): Promise<HarnessCommandResult> {
    if (this.disposed)
      return { success: false, command: command.type, message: 'Codex adapter is disposed' };
    if (command.type === 'cancel-generation') {
      const run = this.active;
      if (!run || run.terminal || (command.taskId && command.taskId !== run.taskId))
        return {
          success: false,
          command: command.type,
          message: 'No matching active Codex generation',
        };
      run.stop('Codex generation cancelled');
      await run.done.promise;
      return { success: true, command: command.type, data: { taskId: run.taskId } };
    }
    if (command.type === 'get-status')
      return {
        success: true,
        command: command.type,
        data: {
          available: await this.isAvailable(),
          projectRoot: this.root,
          taskId: this.active?.taskId,
          threadId: this.active?.threadId,
          turnId: this.active?.turnId,
          model: this.config.model ?? 'configured',
          sandbox: this.config.sandbox ?? 'read-only',
        },
      };
    if (command.type === 'get-running-instances')
      return {
        success: true,
        command: command.type,
        data: { instances: await findHarnessProcesses(this.id) },
      };
    let prompt: string;
    let timeoutMs: number;
    try {
      timeoutMs = milliseconds(
        command.type === 'headless-prompt'
          ? (command.timeoutMs ?? (this.config.timeoutMs as number))
          : (this.config.timeoutMs as number),
      );
      switch (command.type) {
        case 'headless-prompt':
          if (command.maxTurns !== undefined)
            return {
              success: false,
              command: command.type,
              message: 'Codex maxTurns is not supported; use timeoutMs to bound the dispatch',
            };
          prompt = command.prompt;
          break;
        case 'generate-code':
          prompt = `Generate code: ${command.prompt}${command.language ? ` (language: ${command.language})` : ''}${command.context ? `\n\nContext:\n${command.context}` : ''}`;
          break;
        case 'analyze-code':
          prompt = `Read the file at ${command.filePath} and answer: ${command.question ?? 'Explain what this file does.'}`;
          break;
        default:
          return {
            success: false,
            command: command.type,
            message: `Command not supported by ${this.name}`,
          };
      }
      if (!prompt.trim()) throw new Error('Codex prompt must not be empty');
    } catch (error) {
      return { success: false, command: command.type, message: String(error) };
    }
    if (this.active)
      return {
        success: false,
        command: command.type,
        message: 'A Codex generation is already active',
      };
    const threadId = command.type === 'headless-prompt' ? command.threadId : undefined;
    if (threadId !== undefined && (!threadId.trim() || threadId.length > 512))
      return { success: false, command: command.type, message: 'Invalid Codex thread id' };
    return this.dispatch(command.type, prompt, timeoutMs, threadId);
  }

  private async dispatch(
    command: HarnessCommand['type'],
    prompt: string,
    timeoutMs: number,
    resumeThreadId?: string,
  ): Promise<HarnessCommandResult> {
    const terminal = deferred<ObjectValue>();
    const pending = new Map<number, ReturnType<typeof deferred<ObjectValue>>>();
    let child: ChildProcessWithoutNullStreams | undefined;
    let sequence = 0;
    let wireBytes = 0;
    let buffer = '';
    let fatal: Error | undefined;
    let turnRequested = false;
    let notifiedReady = false;
    let interruptTimer: ReturnType<typeof setTimeout> | undefined;
    const approvals = new Map<string | number, AbortController>();
    const abortApprovals = () => {
      for (const controller of approvals.values()) controller.abort();
      approvals.clear();
    };
    const items = new Map<string, { text: string; phase?: string }>();
    const closed = deferred<void>();
    const fail = (error: Error) => {
      fatal ??= error;
      abortApprovals();
      terminal.reject(error);
      for (const request of pending.values()) request.reject(error);
      pending.clear();
    };
    const send = (message: ObjectValue) => {
      if (fatal) throw fatal;
      if (!child || child.stdin.destroyed) throw new Error('Codex transport is closed');
      child.stdin.write(`${JSON.stringify(message)}\n`);
    };
    const request = (method: string, params: ObjectValue) => {
      const id = ++sequence;
      const result = deferred<ObjectValue>();
      pending.set(id, result);
      try {
        send({ id, method, params });
      } catch (error) {
        pending.delete(id);
        result.reject(error as Error);
      }
      return result.promise;
    };
    const run: ActiveRun = {
      taskId: randomUUID(),
      terminal: false,
      done: deferred<void>(),
      stop: (reason) => {
        if (run.terminal || run.stopped) return;
        run.stopped = reason;
        abortApprovals();
        if (run.threadId && run.turnId) {
          void request('turn/interrupt', { threadId: run.threadId, turnId: run.turnId }).catch(
            (error: Error) => fail(error),
          );
          interruptTimer = setTimeout(() => fail(new Error(reason)), CLEANUP_MS);
        } else {
          fail(new Error(reason));
        }
      },
    };
    this.active = run;
    const ready = () => {
      if (notifiedReady || run.terminal || run.stopped || !run.threadId || !run.turnId) return;
      notifiedReady = true;
      this.emit({
        type: 'generation-ready',
        taskId: run.taskId,
        threadId: run.threadId,
        turnId: run.turnId,
      });
    };
    const timeout = setTimeout(
      () => run.stop(`Codex generation timed out after ${timeoutMs}ms`),
      timeoutMs,
    );
    this.emit({ type: 'generation-started', taskId: run.taskId });
    try {
      if (run.stopped) throw new Error(run.stopped);
      if (
        existsSync(managerPath(this.root)) &&
        loadManager(this.root).adapters.some((adapter) => adapter.id === this.id)
      ) {
        const errors = checkCodexDelivery(this.root);
        if (errors.length)
          throw new Error(`Codex project delivery is incomplete: ${errors.join('; ')}`);
      }
      child = spawn(this.binary, ['app-server', '--listen', 'stdio://'], {
        cwd: this.root,
        stdio: 'pipe',
        detached: process.platform !== 'win32',
      });
      child.on('error', (error) => {
        closed.resolve();
        fail(error);
      });
      child.on('exit', () => closed.resolve());
      child.on('close', (code, signal) => {
        closed.resolve();
        fail(new Error(`Codex app-server closed before turn completion (${code ?? signal})`));
      });
      child.stdin.on('error', fail);
      child.stderr.on('data', (chunk: Buffer) => {
        wireBytes += chunk.length;
        if (wireBytes > MAX_WIRE_BYTES) fail(new Error('Codex transport exceeded output limit'));
      });
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk: string) => {
        if (fatal) return;
        try {
          wireBytes += Buffer.byteLength(chunk);
          if (wireBytes > MAX_WIRE_BYTES) throw new Error('Codex transport exceeded output limit');
          buffer += chunk;
          let end = buffer.indexOf('\n');
          while (end !== -1) {
            const line = buffer.slice(0, end).trim();
            buffer = buffer.slice(end + 1);
            if (line) handle(object(JSON.parse(line)));
            end = buffer.indexOf('\n');
          }
        } catch (error) {
          fail(error as Error);
        }
      });
      const handle = (message: ObjectValue) => {
        if ('method' in message && 'id' in message) {
          if (typeof message.id !== 'string' && typeof message.id !== 'number')
            throw new Error('Invalid Codex server request id');
          const id = message.id;
          if (
            message.method === 'item/commandExecution/requestApproval' ||
            message.method === 'item/fileChange/requestApproval'
          ) {
            const params = object(message.params);
            if (
              !this.config.onApproval ||
              run.stopped ||
              run.terminal ||
              params.threadId !== run.threadId ||
              params.turnId !== run.turnId ||
              typeof params.itemId !== 'string' ||
              !params.itemId ||
              params.grantRoot
            ) {
              send({ id, result: { decision: 'decline' } });
              return;
            }
            if (approvals.has(id)) throw new Error('Duplicate Codex approval request');
            const controller = new AbortController();
            approvals.set(id, controller);
            const timer = setTimeout(() => controller.abort(), this.config.approvalTimeoutMs);
            const expired = new Promise<CodexApprovalDecision>((resolve) => {
              controller.signal.addEventListener('abort', () => resolve('decline'), { once: true });
            });
            const review = Promise.resolve()
              .then(() => {
                if (controller.signal.aborted) return 'decline' as const;
                return (
                  this.config.onApproval?.(
                    {
                      taskId: run.taskId,
                      requestId: id,
                      method: message.method as CodexApprovalRequest['method'],
                      params,
                    },
                    controller.signal,
                  ) ?? 'decline'
                );
              })
              .catch(() => 'decline' as const);
            void Promise.race([review, expired])
              .then((decision) => {
                if (approvals.get(id) !== controller || fatal || run.stopped || run.terminal)
                  return;
                approvals.delete(id);
                send({
                  id,
                  result: {
                    decision: ['accept', 'decline', 'cancel'].includes(decision)
                      ? decision
                      : 'decline',
                  },
                });
                if (decision === 'cancel') run.stop('Codex approval cancelled');
              })
              .catch((error: Error) => fail(error))
              .finally(() => {
                clearTimeout(timer);
                controller.abort();
              });
          } else {
            send({
              id,
              error: {
                code: -32601,
                message: 'RevealUI Codex adapter does not support this server request',
              },
            });
          }
          return;
        }
        if ('id' in message) {
          const waiter = pending.get(message.id as number);
          if (!waiter) return;
          if ('error' in message) {
            const error = object(message.error);
            waiter.reject(
              new Error(typeof error.message === 'string' ? error.message : 'Codex RPC failed'),
            );
          } else waiter.resolve(object(message.result));
          pending.delete(message.id as number);
          return;
        }
        if (message.method === 'serverRequest/resolved') {
          const params = object(message.params);
          if (params.threadId === run.threadId) {
            const id = params.requestId as string | number;
            approvals.get(id)?.abort();
            approvals.delete(id);
          }
          return;
        }
        if (
          !['turn/started', 'turn/completed', 'item/agentMessage/delta', 'item/completed'].includes(
            message.method as string,
          )
        )
          return;
        const params = object(message.params);
        if (params.threadId !== run.threadId) return;
        if (message.method === 'turn/started') {
          if (turnRequested && !run.turnId) {
            run.turnId = identifier(object(params.turn).id);
            ready();
          }
          return;
        }
        if (message.method === 'turn/completed') {
          const turn = object(params.turn);
          if (turnRequested && !run.turnId) run.turnId = identifier(turn.id);
          if (turn.id === run.turnId) {
            run.terminal = true;
            abortApprovals();
            terminal.resolve(turn);
          }
          return;
        }
        if (params.turnId !== run.turnId) return;
        if (message.method === 'item/agentMessage/delta') {
          const id = identifier(params.itemId);
          if (typeof params.delta !== 'string') throw new Error('Invalid Codex message delta');
          const previous = items.get(id);
          items.set(id, { ...previous, text: (previous?.text ?? '') + params.delta });
          this.emit({ type: 'generation-progress', taskId: run.taskId, delta: params.delta });
        } else {
          const item = object(params.item);
          if (item.type !== 'agentMessage') return;
          if (typeof item.text !== 'string') throw new Error('Invalid Codex agent message');
          items.set(identifier(item.id), {
            text: item.text,
            phase: typeof item.phase === 'string' ? item.phase : undefined,
          });
        }
      };
      await request('initialize', {
        clientInfo: { name: 'revealfleet', title: 'RevealUI Harnesses', version: '0.1.0' },
      });
      send({ method: 'initialized', params: {} });
      if (resumeThreadId) {
        const stored = object(
          (
            await request('thread/read', {
              threadId: resumeThreadId,
              includeTurns: false,
            })
          ).thread,
        );
        if (
          stored.id !== resumeThreadId ||
          typeof stored.cwd !== 'string' ||
          resolve(stored.cwd) !== this.root
        )
          throw new Error('Codex thread does not belong to this project root');
      }
      const started = await request(resumeThreadId ? 'thread/resume' : 'thread/start', {
        ...(resumeThreadId ? { threadId: resumeThreadId } : {}),
        ...(this.config.mcpServers?.length
          ? {
              config: Object.fromEntries(
                this.config.mcpServers.map(({ name, command, args, env }) => [
                  `mcp_servers.${name}`,
                  {
                    command,
                    args: args ?? [],
                    ...(env ? { env } : {}),
                    enabled: true,
                    required: true,
                  },
                ]),
              ),
            }
          : {}),
        cwd: this.root,
        sandbox: this.config.sandbox ?? 'read-only',
        approvalPolicy: 'on-request',
        approvalsReviewer: 'user',
        ...(this.config.model ? { model: this.config.model } : {}),
        ...(existsSync(managerPath(this.root))
          ? { developerInstructions: codexPointerText(this.root) }
          : {}),
      });
      run.threadId = identifier(object(started.thread).id);
      if (resumeThreadId && run.threadId !== resumeThreadId)
        throw new Error('Codex resumed a different thread');
      turnRequested = true;
      const response = await Promise.race([
        request('turn/start', {
          threadId: run.threadId,
          input: [{ type: 'text', text: prompt }],
          ...(this.config.reasoningEffort ? { effort: this.config.reasoningEffort } : {}),
        }),
        terminal.promise.then((turn) => ({ turn })),
      ]);
      const turn = object(response.turn);
      if (run.turnId && run.turnId !== turn.id)
        throw new Error('Codex turn identifier changed during dispatch');
      run.turnId = identifier(turn.id);
      if (!(run.terminal || run.stopped) && turn.status === 'inProgress') {
        ready();
      }
      if (['completed', 'failed', 'interrupted'].includes(turn.status as string))
        terminal.resolve(turn);
      const completed = await terminal.promise;
      run.terminal = true;
      if (run.stopped || completed.status === 'interrupted')
        throw new Error(run.stopped ?? 'Codex turn interrupted');
      if (completed.status !== 'completed')
        throw new Error(
          completed.error
            ? String(object(completed.error).message ?? 'Codex turn failed')
            : 'Codex turn failed',
        );
      for (const value of Array.isArray(completed.items) ? completed.items : []) {
        const item = object(value);
        if (item.type === 'agentMessage' && typeof item.text === 'string') {
          items.set(identifier(item.id), {
            text: item.text,
            phase: typeof item.phase === 'string' ? item.phase : undefined,
          });
        }
      }
      const messages = [...items.values()];
      const final = messages.filter((item) => item.phase === 'final_answer');
      const output = (final.length ? final : messages.filter((item) => !item.phase))
        .map((item) => item.text)
        .join('\n');
      this.emit({ type: 'generation-completed', taskId: run.taskId, output });
      return {
        success: true,
        command,
        message: output,
        data: {
          taskId: run.taskId,
          threadId: run.threadId,
          turnId: run.turnId,
          output,
          status: 'completed',
        },
      };
    } catch (error) {
      run.terminal = true;
      const message = run.stopped ?? (error instanceof Error ? error.message : String(error));
      this.emit({
        type: run.stopped ? 'generation-cancelled' : 'generation-failed',
        taskId: run.taskId,
        message,
      });
      return {
        success: false,
        command,
        message,
        data: {
          taskId: run.taskId,
          threadId: run.threadId,
          turnId: run.turnId,
          status: run.stopped ? 'interrupted' : 'failed',
        },
      };
    } finally {
      clearTimeout(timeout);
      clearTimeout(interruptTimer);
      fail(new Error('Codex dispatch finished'));
      try {
        if (child) await this.cleanup(child, closed.promise);
      } finally {
        if (this.active === run) this.active = undefined;
        run.done.resolve();
      }
    }
  }

  private async cleanup(
    child: ChildProcessWithoutNullStreams,
    closed: Promise<void>,
  ): Promise<void> {
    const signal = (value: NodeJS.Signals) => {
      try {
        if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, value);
        else child.kill(value);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
      }
    };
    child.stdin.end();
    signal('SIGTERM');
    // Descendants may keep pipes open after their parent exits. Kill the group
    // after the grace period even when the leader has already closed.
    await new Promise((resolve) => setTimeout(resolve, CLEANUP_MS));
    signal('SIGKILL');
    child.stdin.destroy();
    child.stdout.destroy();
    child.stderr.destroy();
    await closed;
  }
}
