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
import { createLogger, type Logger } from './logger.js';

const trackedChildren = new Set<ReturnType<typeof spawn>>();
let signalForwardingInstalled = false;

export interface ScriptResult {
  success: boolean;
  message: string;
  exitCode: number;
  stdout?: string;
  stderr?: string;
}

export interface ExecOptions extends SpawnOptions {
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

/** Kill the entire process group to prevent orphaned child processes */
function killProcessGroup(child: ReturnType<typeof spawn>, signal: NodeJS.Signals): void {
  if (child.pid && !child.killed) {
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
  const {
    timeout = 120000,
    capture = false,
    logger: customLogger,
    cwd = process.cwd(),
    env,
    metadata,
    ...spawnOptions
  } = options;

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
    let killed = false;
    let gracefulKillAttempted = false;

    // Set up timeout with graceful shutdown
    const timeoutId = setTimeout(() => {
      if (!gracefulKillAttempted) {
        // First attempt: graceful SIGTERM
        gracefulKillAttempted = true;
        logger.warn(`Command timeout approaching, sending SIGTERM: ${command} ${args.join(' ')}`);
        killProcessGroup(child, 'SIGTERM');

        // Second attempt after 5s: force SIGKILL
        setTimeout(() => {
          if (!killed) {
            killed = true;
            logger.error(
              `Command force-killed after ${timeout + 5000}ms: ${command} ${args.join(' ')}`,
            );
            killProcessGroup(child, 'SIGKILL');
          }
        }, 5000);
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
      clearTimeout(timeoutId);
      trackedChildren.delete(child);

      // Update process status
      if (child.pid) {
        updateProcessStatus(child.pid, 'failed', 1);
      }

      resolve({
        success: false,
        message: error.message,
        exitCode: 1,
        stdout: capture ? stdout : undefined,
        stderr: capture ? stderr : undefined,
      });
    });

    child.on('close', (code, signal) => {
      clearTimeout(timeoutId);
      trackedChildren.delete(child);

      // Update process status
      if (child.pid) {
        if (killed || signal) {
          updateProcessStatus(child.pid, 'killed', code ?? undefined, signal ?? undefined);
        } else if (code === 0) {
          updateProcessStatus(child.pid, 'completed', code);
        } else {
          updateProcessStatus(child.pid, 'failed', code ?? 1);
        }
      }

      if (killed) {
        resolve({
          success: false,
          message: 'Command timed out',
          exitCode: code ?? 124,
          stdout: capture ? stdout : undefined,
          stderr: capture ? stderr : undefined,
        });
        return;
      }

      resolve({
        success: code === 0,
        message: code === 0 ? 'Success' : `Exited with code ${code}`,
        exitCode: code ?? 1,
        stdout: capture ? stdout : undefined,
        stderr: capture ? stderr : undefined,
      });
    });

    child.on('exit', () => {
      trackedChildren.delete(child);
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
    const result = await execCommand(command, args, { ...options, ...cmdOptions });
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
  options: ExecOptions = {},
): Promise<{ success: boolean; results: ScriptResult[] }> {
  const promises = commands.map(([command, args, cmdOptions]) =>
    execCommand(command, args, { ...options, ...cmdOptions }),
  );

  const results = await Promise.all(promises);
  const success = results.every((r) => r.success);

  return { success, results };
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
