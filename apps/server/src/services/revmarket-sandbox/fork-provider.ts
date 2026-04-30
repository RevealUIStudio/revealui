/**
 * Fork-based sandbox provider (GAP-161 Option A).
 *
 * Spawns a fresh Node `child_process.fork` per task with a memory cap via
 * `--max-old-space-size`. The fork target receives the task payload over IPC
 * and posts the result back. On timeout the parent escalates SIGTERM → 5s
 * grace → SIGKILL.
 *
 * Threat model — what this provider DOES protect against:
 *   - Memory exhaustion of the parent process (fork has its own heap cap)
 *   - Long-running / infinite-loop agents (timeout escalation)
 *   - Process-state mutation (process.exit, process.env mutation) bleeding
 *     into the parent — fork has its own process state
 *   - Top-level throws — fork crashes, parent stays up, task marked failed
 *
 * What it DOES NOT protect against (deferred to Option D when polyglot or
 * container infra arrives):
 *   - Filesystem reads outside the per-task tmpdir (best-effort: cwd is set
 *     to tmpdir, but the agent code can still access absolute paths)
 *   - Network egress — no firewall enforcement at the OS level
 *   - Syscall isolation — the fork shares the host kernel
 *   - Side-channel attacks (timing, cache)
 *
 * The PREVIEW notice at apps/server/src/services/revmarket-executor.ts:1-7
 * is updated to reflect this delta — fork isolation is real but not OS-level.
 */

import { fork, type ChildProcess } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { logger } from '@revealui/core/observability/logger';

import type {
  RunnerInboundMessage,
  RunnerOutboundMessage,
  SandboxProvider,
  SandboxResult,
  SandboxRunOptions,
} from './types.js';

/** Where the compiled / shipped fork target lives. Resolved at provider construction time. */
export interface ForkProviderOptions {
  /**
   * Path to the fork-target script. Defaults to the bundled
   * `revmarket-task-runner.mjs` next to this file at runtime. Override only
   * for tests.
   */
  readonly runnerPath?: string;
  /** SIGTERM-to-SIGKILL grace period in ms. Default 5000. */
  readonly killGraceMs?: number;
}

const DEFAULT_KILL_GRACE_MS = 5_000;

export function forkProvider(options: ForkProviderOptions = {}): SandboxProvider {
  const killGraceMs = options.killGraceMs ?? DEFAULT_KILL_GRACE_MS;
  const runnerPath = options.runnerPath ?? defaultRunnerPath();

  return {
    tag: 'fork',
    name: 'fork',
    async run(opts: SandboxRunOptions): Promise<SandboxResult> {
      return runForked(opts, runnerPath, killGraceMs);
    },
  };
}

async function runForked(
  opts: SandboxRunOptions,
  runnerPath: string,
  killGraceMs: number,
): Promise<SandboxResult> {
  const taskTmp = join(tmpdir(), `revmarket-${opts.taskId}`);
  await mkdir(taskTmp, { recursive: true });

  let child: ChildProcess | null = null;
  let killTimer: ReturnType<typeof setTimeout> | null = null;
  let resolved = false;

  const cleanup = async (): Promise<void> => {
    if (killTimer) {
      clearTimeout(killTimer);
      killTimer = null;
    }
    try {
      await rm(taskTmp, { recursive: true, force: true });
    } catch (err) {
      // Tmpdir cleanup failure is non-fatal — log and move on.
      logger.warn('RevMarket sandbox tmpdir cleanup failed', {
        taskId: opts.taskId,
        path: taskTmp,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };

  return new Promise<SandboxResult>((resolve) => {
    const settle = (result: SandboxResult): void => {
      if (resolved) return;
      resolved = true;
      void cleanup().finally(() => resolve(result));
    };

    try {
      child = fork(runnerPath, [], {
        cwd: taskTmp,
        // Strip parent env to a safe minimum — runner shouldn't see secrets,
        // tokens, or RevealUI internals. PATH + HOME are kept so Node can
        // resolve its own deps; everything else is intentionally absent.
        env: {
          PATH: process.env.PATH ?? '',
          HOME: process.env.HOME ?? '',
          NODE_ENV: process.env.NODE_ENV ?? 'production',
          REVMARKET_SANDBOX: '1',
          REVMARKET_TASK_ID: opts.taskId,
        },
        execArgv: [`--max-old-space-size=${opts.maxMemoryMb}`],
        // Don't inherit parent stdio — keep agent stdout/stderr captured for
        // future telemetry. Pipe so we can drain if needed.
        stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
        serialization: 'json',
      });
    } catch (err) {
      settle({
        success: false,
        output: null,
        artifacts: [],
        tokensUsed: 0,
        error: `Failed to fork sandbox: ${err instanceof Error ? err.message : String(err)}`,
      });
      return;
    }

    const proc = child;
    if (!proc) {
      settle({
        success: false,
        output: null,
        artifacts: [],
        tokensUsed: 0,
        error: 'Fork returned no child handle',
      });
      return;
    }

    // Drain stdout/stderr so the pipe doesn't fill up and block the runner.
    proc.stdout?.on('data', () => {});
    proc.stderr?.on('data', () => {});

    proc.on('message', (msg: RunnerOutboundMessage) => {
      if (msg && typeof msg === 'object' && msg.type === 'result') {
        settle({
          success: msg.success,
          output: msg.output,
          artifacts: msg.artifacts,
          tokensUsed: msg.tokensUsed,
          ...(msg.error !== undefined ? { error: msg.error } : {}),
        });
      }
    });

    proc.on('error', (err) => {
      settle({
        success: false,
        output: null,
        artifacts: [],
        tokensUsed: 0,
        error: `Fork errored: ${err.message}`,
      });
    });

    proc.on('exit', (code, signal) => {
      if (resolved) return;
      // Runner exited without sending a result message. Decide the cause:
      //   - signal=SIGKILL/SIGTERM after timeout: aborted
      //   - code != 0: crashed
      //   - code = 0 but no message: silent exit (process.exit(0) without sending)
      const isAbort = signal === 'SIGKILL' || signal === 'SIGTERM';
      settle({
        success: false,
        output: null,
        artifacts: [],
        tokensUsed: 0,
        error: isAbort
          ? `Sandbox killed (signal=${signal})`
          : code !== 0
            ? `Sandbox crashed (exit=${code})`
            : 'Sandbox exited without producing a result',
      });
    });

    // Abort handling: SIGTERM, then SIGKILL after grace period.
    const onAbort = (): void => {
      if (resolved || !proc.pid) return;
      try {
        proc.kill('SIGTERM');
      } catch {
        // Process may already be gone; the exit handler will settle.
      }
      killTimer = setTimeout(() => {
        if (resolved || !proc.pid) return;
        try {
          proc.kill('SIGKILL');
        } catch {
          // Same — exit handler will settle.
        }
      }, killGraceMs);
    };

    if (opts.signal.aborted) {
      onAbort();
    } else {
      opts.signal.addEventListener('abort', onAbort, { once: true });
    }

    // Send the task payload over IPC.
    const inbound: RunnerInboundMessage = {
      type: 'task',
      taskId: opts.taskId,
      agentId: opts.agentId,
      skillName: opts.skillName,
      input: opts.input,
    };
    try {
      proc.send(inbound);
    } catch (err) {
      settle({
        success: false,
        output: null,
        artifacts: [],
        tokensUsed: 0,
        error: `Failed to send task to sandbox: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  });
}

function defaultRunnerPath(): string {
  // The runner ships as a sibling .mjs — both in `src/` (for tsx-driven dev)
  // and in `dist/` (for compiled prod). At runtime, `import.meta.url` of
  // this module points at the right neighborhood; the runner sits next to it.
  const url = new URL('./revmarket-task-runner.mjs', import.meta.url);
  return url.pathname;
}
