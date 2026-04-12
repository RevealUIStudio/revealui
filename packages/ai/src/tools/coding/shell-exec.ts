/**
 * shell_exec  -  Sandboxed shell command execution
 */

import { execSync } from 'node:child_process';
import { z } from 'zod/v4';
import type { Tool, ToolResult } from '../base.js';
import { getSafetyConfig, validateCommand } from './safety.js';

/** Default timeout: 30 seconds */
const DEFAULT_TIMEOUT_MS = 30_000;

/** Max output size: 100KB */
const MAX_OUTPUT_BYTES = 100 * 1024;

export const shellExecTool: Tool = {
  name: 'shell_exec',
  label: 'Run Command',
  description:
    'Execute a shell command in the project directory. Commands are validated against a safety denylist. Use for build scripts, test runners, package managers, and general automation.',
  parameters: z.object({
    command: z.string().describe('The shell command to execute'),
    timeout: z
      .number()
      .optional()
      .describe(`Timeout in milliseconds (default: ${DEFAULT_TIMEOUT_MS}, max: 300000)`),
    cwd: z
      .string()
      .optional()
      .describe('Working directory relative to project root (default: project root)'),
  }),

  async execute(params): Promise<ToolResult> {
    const { command, timeout, cwd } = params as {
      command: string;
      timeout?: number;
      cwd?: string;
    };
    const config = getSafetyConfig();

    // Validate command against denylist
    const check = validateCommand(command, config);
    if (!check.safe) {
      return { success: false, error: check.reason };
    }

    const timeoutMs = Math.min(timeout ?? DEFAULT_TIMEOUT_MS, 300_000);
    const workDir = cwd ? `${config.projectRoot}/${cwd}` : config.projectRoot;

    try {
      const output = execSync(command, {
        cwd: workDir,
        timeout: timeoutMs,
        maxBuffer: MAX_OUTPUT_BYTES,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          // Prevent interactive prompts
          CI: 'true',
          FORCE_COLOR: '0',
        },
      });

      const trimmed = output.trim();
      const lines = trimmed.split('\n').length;

      return {
        success: true,
        data: { command, exitCode: 0, output: trimmed },
        content:
          trimmed.length > 2000
            ? `Command succeeded (${lines} lines, truncated):\n${trimmed.slice(0, 2000)}…`
            : `Command succeeded:\n${trimmed}`,
      };
    } catch (err) {
      const execErr = err as {
        status?: number;
        stdout?: string;
        stderr?: string;
        killed?: boolean;
        message?: string;
      };

      if (execErr.killed) {
        return {
          success: false,
          error: `Command timed out after ${timeoutMs}ms: ${command}`,
        };
      }

      const stdout = (execErr.stdout ?? '').toString().trim();
      const stderr = (execErr.stderr ?? '').toString().trim();
      const combined = [stdout, stderr].filter(Boolean).join('\n');
      const exitCode = execErr.status ?? 1;

      return {
        success: false,
        data: { command, exitCode, stdout, stderr },
        error: `Command failed (exit ${exitCode}):\n${combined.slice(0, 2000)}`,
      };
    }
  },
};
