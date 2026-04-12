/**
 * git_ops — Git operations wrapper (status, diff, log, blame)
 */

import { execFileSync } from 'node:child_process';
import { z } from 'zod/v4';
import type { Tool, ToolResult } from '../base.js';
import { getSafetyConfig } from './safety.js';

const GIT_OPERATIONS = ['status', 'diff', 'diff_full', 'log', 'blame', 'show', 'branch'] as const;
type GitOperation = (typeof GIT_OPERATIONS)[number];

/** Max output per git command */
const MAX_OUTPUT = 50_000;

function runGit(args: string[], cwd: string): string {
  return execFileSync('git', args, {
    cwd,
    timeout: 15_000,
    maxBuffer: MAX_OUTPUT,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: '0',
      GIT_PAGER: 'cat',
    },
  }).trim();
}

export const gitOpsTool: Tool = {
  name: 'git_ops',
  label: 'Git Operations',
  description:
    'Run read-only git operations: status, diff (summary), diff_full (full patch), log, blame, show, branch. Safe operations only — no push, commit, reset, or checkout.',
  parameters: z.object({
    operation: z.enum(GIT_OPERATIONS).describe('Git operation to perform'),
    args: z
      .array(z.string())
      .optional()
      .describe('Additional arguments (e.g., ["--oneline", "-n", "10"] for log)'),
  }),

  async execute(params): Promise<ToolResult> {
    const { operation, args = [] } = params as {
      operation: GitOperation;
      args?: string[];
    };
    const config = getSafetyConfig();

    // Block any sneaky write operations passed as args
    const joinedArgs = args.join(' ');
    const dangerousFlags = ['--force', '--hard', '--delete', '-D', '--push'];
    for (const flag of dangerousFlags) {
      if (joinedArgs.toLowerCase().includes(flag.toLowerCase())) {
        return {
          success: false,
          error: `Dangerous flag "${flag}" not allowed in git_ops. This tool is read-only.`,
        };
      }
    }

    try {
      let output: string;

      switch (operation) {
        case 'status':
          output = runGit(['status', '--short', ...args], config.projectRoot);
          break;

        case 'diff':
          output = runGit(['diff', '--stat', ...args], config.projectRoot);
          break;

        case 'diff_full':
          // Full patch content for code review — hunks per file
          output = runGit(['diff', '--no-color', '-U3', ...args], config.projectRoot);
          break;

        case 'log':
          // Default: last 20 commits, oneline
          if (args.length === 0) {
            output = runGit(['log', '--oneline', '--decorate', '-n', '20'], config.projectRoot);
          } else {
            output = runGit(['log', ...args], config.projectRoot);
          }
          break;

        case 'blame':
          if (args.length === 0) {
            return { success: false, error: 'blame requires a file path argument' };
          }
          output = runGit(['blame', '--line-porcelain', ...args], config.projectRoot);
          break;

        case 'show':
          output = runGit(['show', '--stat', ...args], config.projectRoot);
          break;

        case 'branch':
          output = runGit(['branch', '-a', '--no-color', ...args], config.projectRoot);
          break;
      }

      const lines = output.split('\n').length;

      return {
        success: true,
        data: { operation, output },
        content:
          output.length > 3000
            ? `git ${operation} (${lines} lines, truncated):\n${output.slice(0, 3000)}…`
            : `git ${operation}:\n${output}`,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: `git ${operation} failed: ${message.slice(0, 500)}`,
      };
    }
  },
};
