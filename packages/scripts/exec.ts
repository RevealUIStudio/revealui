/**
 * Command Execution Utilities for RevealUI Scripts
 *
 * Provides safe command execution with proper error handling,
 * timeout support, and cross-platform compatibility.
 *
 * @dependencies
 * - scripts/lib/logger.ts - Logging utilities
 * - @revealui/core/monitoring - Process registration and monitoring
 * - node:child_process - Process spawning
 */

import { type SpawnOptions, spawn } from 'node:child_process';
import { registerProcess, updateProcessStatus } from '@revealui/core/monitoring/process-registry';
import type { ProcessMetadata } from '@revealui/core/monitoring/types';
import { DryRunEngine } from './dry-run/dry-run-engine.js';
import { createLogger, type Logger } from './logger.js';

const trackedChildren = new Set<ReturnType<typeof spawn>>();
let signalForwardingInstalled = false;

export interface ScriptResult {
  success: boolean;
  message: string;
  /** CLI-compatible status; a reached deadline always returns 124. */
  exitCode: number;
  /** Actual process close status, which is null on signal termination. */
  processExitCode?: number | null;
  signal?: NodeJS.Signals;
  timedOut?: boolean;
  stdout?: string;
  stderr?: string;
  /** A prediction, not evidence that the command executed. */
  simulated?: boolean;
}

export interface ExecOptions extends SpawnOptions {
  /** Simulate without spawning. An active simulation cannot be overridden. */
  dryRun?: boolean;
  /** Timeout in milliseconds (default: 120000 = 2 minutes) */
  timeout?: number;
  /** Capture stdout/stderr instead of inheriting (default: false) */
  capture?: boolean;
  /** Logger instance for output */
  logger?: Logger;
  /** Working directory */
  cwd?: string;
  /** Environment variables to merge with process.env */
  env?: Record<string, string>;
  /** Process metadata for tracking */
  metadata?: ProcessMetadata;
}

/** Signal the owned process group while its ChildProcess remains tracked. */
function killProcessGroup(child: ReturnType<typeof spawn>, signal: NodeJS.Signals): void {
  if (child.pid && trackedChildren.has(child)) {
    try {
      // Kill the process group (negative PID) on Unix
      if (process.platform !== 'win32') {
        process.kill(-child.pid, signal);
      } else {
        child.kill(signal);
      }
    } catch {
      // Process may have already exited
      child.kill(signal);
    }
  }
}

function installSignalForwarding(): void {
  if (signalForwardingInstalled) return;

  const forwardSignal = (signal: NodeJS.Signals) => {
    for (const child of trackedChildren) {
      killProcessGroup(child, signal);
    }
  };

  process.on('SIGTERM', forwardSignal);
  process.on('SIGINT', forwardSignal);
  signalForwardingInstalled = true;
}

/**
 * Executes a command with proper error handling and timeout support.
 *
 * @example
 * ```typescript
 * // Simple execution with inherited stdio
 * const result = await execCommand('pnpm', ['build'])
 *
 * // Capture output
 * const result = await execCommand('git', ['status'], { capture: true })
 * console.log(result.stdout)
 *
 * // With timeout
 * const result = await execCommand('pnpm', ['test'], { timeout: 300000 })
 * ```
 */
export async function execCommand(
  command: string,
  args: string[] = [],
  options: ExecOptions = {},
): Promise<ScriptResult> {
  const { dryRun, ...executionOptions } = options;
  const simulation = DryRunEngine.activeSimulation();
  if (simulation || dryRun) {
    const engine = simulation ?? new DryRunEngine({ enabled: true });
    engine.recordCommand(command, args);
    return {
      success: true,
      simulated: true,
      exitCode: 0,
      message: `Simulated command: ${command}`,
      stdout: '',
      stderr: '',
    };
  }
  const {
    timeout = 120000,
    capture = false,
    logger: customLogger,
    cwd = process.cwd(),
    env,
    metadata,
    ...spawnOptions
  } = executionOptions;

  const logger = customLogger || createLogger({ level: 'silent' });

  return new Promise((resolve) => {
    installSignalForwarding();

    const mergedEnv = env ? { ...process.env, ...env } : process.env;

    const isWindows = process.platform === 'win32';
    const child = spawn(command, args, {
      cwd,
      env: mergedEnv,
      stdio: capture ? 'pipe' : 'inherit',
      shell: isWindows,
      detached: !isWindows,
      ...spawnOptions,
    });

    // Register process in monitoring system
    if (child.pid) {
      registerProcess(child.pid, command, args, 'exec', metadata, process.pid);
    }
    trackedChildren.add(child);

    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let forceKilled = false;
    let finished = false;
    let executionError: Error | undefined;
    let escalationId: ReturnType<typeof setTimeout> | undefined;

    const escalate = () => {
      if (finished || escalationId) return;
      escalationId = setTimeout(() => {
        if (!finished) {
          forceKilled = true;
          logger.error('Command still open after the 5000ms termination grace; sending SIGKILL.');
          killProcessGroup(child, 'SIGKILL');
        }
      }, 5000);
    };

    // Set up timeout with graceful shutdown
    const timeoutId = setTimeout(() => {
      if (!finished) {
        // First attempt: graceful SIGTERM
        timedOut = true;
        logger.warn(`Command deadline reached after ${timeout}ms; sending SIGTERM.`);
        killProcessGroup(child, 'SIGTERM');
        // Second attempt after 5s: force SIGKILL
        escalate();
      }
    }, timeout);

    // Capture output if requested
    if (capture && child.stdout) {
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
    }

    if (capture && child.stderr) {
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
    }

    child.on('error', (error) => {
      executionError = error;
      // AbortSignal and signaling errors can precede closure of a successfully
      // spawned child. Retain its ownership and bounded escalation until close.
      if (child.pid) {
        killProcessGroup(child, 'SIGTERM');
        escalate();
        return;
      }
      finished = true;
      clearTimeout(timeoutId);
      clearTimeout(escalationId);
      trackedChildren.delete(child);

      // Update process status
      if (child.pid) {
        updateProcessStatus(child.pid, 'failed', 1);
      }

      resolve({
        success: false,
        message: error.message,
        exitCode: timedOut ? 124 : 1,
        timedOut,
        stdout: capture ? stdout : undefined,
        stderr: capture ? stderr : undefined,
      });
    });

    child.on('close', (code, signal) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeoutId);
      clearTimeout(escalationId);
      trackedChildren.delete(child);

      // Update process status
      if (child.pid) {
        if (timedOut || signal) {
          updateProcessStatus(child.pid, 'killed', code ?? undefined, signal ?? undefined);
        } else if (code === 0 && !executionError) {
          updateProcessStatus(child.pid, 'completed', code);
        } else {
          updateProcessStatus(child.pid, 'failed', executionError ? 1 : (code ?? 1));
        }
      }

      if (timedOut) {
        resolve({
          success: false,
          message: `Command timed out after ${timeout}ms${forceKilled ? ' (force-killed)' : ''}`,
          exitCode: 124,
          processExitCode: code,
          signal: signal ?? undefined,
          timedOut: true,
          stdout: capture ? stdout : undefined,
          stderr: capture ? stderr : undefined,
        });
        return;
      }

      resolve({
        success: code === 0 && !executionError,
        message:
          executionError?.message ??
          (code === 0
            ? 'Success'
            : signal
              ? `Terminated by ${signal}`
              : `Exited with code ${code}`),
        exitCode: executionError ? 1 : (code ?? 1),
        processExitCode: code,
        signal: signal ?? undefined,
        timedOut: false,
        stdout: capture ? stdout : undefined,
        stderr: capture ? stderr : undefined,
      });
    });
  });
}

/**
 * Executes multiple commands in sequence, stopping on first failure.
 *
 * @example
 * ```typescript
 * const results = await execSequence([
 *   ['pnpm', ['typecheck']],
 *   ['pnpm', ['lint']],
 *   ['pnpm', ['test']],
 * ])
 * ```
 */
export async function execSequence(
  commands: Array<[string, string[], ExecOptions?]>,
  options: ExecOptions = {},
): Promise<{ success: boolean; results: ScriptResult[] }> {
  const results: ScriptResult[] = [];

  for (const [command, args, cmdOptions] of commands) {
    const result = await execCommand(command, args, {
      ...options,
      ...cmdOptions,
      dryRun: Boolean(options.dryRun || cmdOptions?.dryRun),
    });
    results.push(result);

    if (!result.success) {
      return { success: false, results };
    }
  }

  return { success: true, results };
}

/**
 * Executes multiple commands in parallel.
 *
 * @example
 * ```typescript
 * const results = await execParallel([
 *   ['pnpm', ['--filter', 'admin', 'build']],
 *   ['pnpm', ['--filter', 'web', 'build']],
 * ])
 * ```
 */
export async function execParallel(
  commands: Array<[string, string[], ExecOptions?]>,
  options: ExecOptions & { concurrency?: number } = {},
): Promise<{ success: boolean; results: ScriptResult[]; durationsMs: number[] }> {
  // Match the maintained gate's two-process budget. Timeouts start when a
  // command launches, so queueing cannot consume its execution deadline.
  const { concurrency = 2, ...execOptions } = options;
  if (!Number.isSafeInteger(concurrency) || concurrency < 1) {
    throw new Error('Command concurrency must be a positive safe integer');
  }
  const results: ScriptResult[] = new Array(commands.length);
  const durationsMs: number[] = new Array(commands.length);
  let nextIndex = 0;
  async function worker(): Promise<void> {
    while (nextIndex < commands.length) {
      const index = nextIndex++;
      const entry = commands[index];
      if (!entry) return;
      const [command, args, cmdOptions] = entry;
      const start = performance.now();
      try {
        results[index] = await execCommand(command, args, {
          ...execOptions,
          ...cmdOptions,
          dryRun: Boolean(execOptions.dryRun || cmdOptions?.dryRun),
        });
      } catch (error) {
        results[index] = {
          success: false,
          exitCode: 1,
          message: error instanceof Error ? error.message : String(error),
        };
      }
      durationsMs[index] = performance.now() - start;
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, commands.length) }, worker));
  const success = results.every((r) => r.success);

  return { success, results, durationsMs };
}

/**
 * Runs a pnpm script from package.json.
 *
 * @example
 * ```typescript
 * await runPnpmScript('build')
 * await runPnpmScript('test', { filter: 'admin' })
 * ```
 */
export async function runPnpmScript(
  script: string,
  options: ExecOptions & { filter?: string } = {},
): Promise<ScriptResult> {
  const { filter, ...execOptions } = options;
  const args = filter ? ['--filter', filter, script] : [script];

  return execCommand('pnpm', args, execOptions);
}

/**
 * Checks if a command exists on the system.
 *
 * @example
 * ```typescript
 * if (await commandExists('docker')) {
 *   await execCommand('docker', ['build', '-t', 'myapp', '.'])
 * }
 * ```
 */
export async function commandExists(command: string): Promise<boolean> {
  const checkCmd = process.platform === 'win32' ? 'where' : 'which';

  try {
    const result = await execCommand(checkCmd, [command], { capture: true });
    return result.success;
  } catch {
    return false;
  }
}
