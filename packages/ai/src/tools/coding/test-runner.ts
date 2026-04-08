/**
 * test_runner — Run tests and return structured results
 *
 * Detects the test framework (Vitest, Jest, Mocha) and runs tests with
 * machine-parseable output. Returns structured pass/fail/skip counts
 * and failure details.
 */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod/v4';
import type { Tool, ToolResult } from '../base.js';
import { getSafetyConfig } from './safety.js';

/** Default timeout: 120 seconds (tests can be slow) */
const DEFAULT_TIMEOUT_MS = 120_000;

/** Max output: 200KB */
const MAX_OUTPUT_BYTES = 200 * 1024;

interface TestFailure {
  name: string;
  file?: string;
  message: string;
}

interface TestSummary {
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  duration?: string;
  failures: TestFailure[];
}

type TestFramework = 'vitest' | 'jest' | 'mocha' | 'unknown';

function detectFramework(projectRoot: string): TestFramework {
  const pkgPath = join(projectRoot, 'package.json');
  if (!existsSync(pkgPath)) return 'unknown';

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pkg = JSON.parse(execSync(`cat "${pkgPath}"`, { encoding: 'utf8', timeout: 5000 }));
    const deps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
    };
    if (deps.vitest) return 'vitest';
    if (deps.jest || deps['@jest/core']) return 'jest';
    if (deps.mocha) return 'mocha';
  } catch {
    // Fall through
  }
  return 'unknown';
}

function buildCommand(framework: TestFramework, file?: string, grep?: string): string {
  const fileArg = file ? ` ${file}` : '';
  const grepArg = grep ? ` -t "${grep}"` : '';

  switch (framework) {
    case 'vitest':
      return `npx vitest run${fileArg}${grep ? ` --reporter=verbose` : ''} --no-color`;
    case 'jest':
      return `npx jest${fileArg}${grepArg} --no-color --forceExit`;
    case 'mocha':
      return `npx mocha${fileArg}${grepArg} --no-color`;
    default:
      // Try pnpm test as fallback
      return `pnpm test${fileArg ? ` -- ${fileArg.trim()}` : ''}`;
  }
}

function parseVitestOutput(output: string): TestSummary {
  const failures: TestFailure[] = [];

  // Parse "Tests  X passed | Y failed | Z skipped (W)"
  const summaryMatch = output.match(
    /Tests\s+(?:(\d+)\s+passed)?[^(]*?(?:(\d+)\s+failed)?[^(]*?(?:(\d+)\s+skipped)?[^(]*?\((\d+)\)/,
  );

  const passed = summaryMatch ? Number.parseInt(summaryMatch[1] ?? '0', 10) : 0;
  const failed = summaryMatch ? Number.parseInt(summaryMatch[2] ?? '0', 10) : 0;
  const skipped = summaryMatch ? Number.parseInt(summaryMatch[3] ?? '0', 10) : 0;
  const total = summaryMatch
    ? Number.parseInt(summaryMatch[4] ?? '0', 10)
    : passed + failed + skipped;

  // Parse duration
  const durationMatch = output.match(/Duration\s+([\d.]+s)/);
  const duration = durationMatch?.[1];

  // Parse failure details: "FAIL  path/to/file.test.ts > suite > test name"
  const failureBlocks = output.split(/(?=FAIL\s)/);
  for (const block of failureBlocks) {
    const headerMatch = block.match(/FAIL\s+(.+?)(?:\s+>\s+(.+))?$/m);
    if (headerMatch) {
      const file = headerMatch[1]?.trim();
      const name = headerMatch[2]?.trim() ?? file ?? 'unknown';
      // Extract assertion/error message
      const errorMatch = block.match(/(?:AssertionError|Error|Expected|Received).*$/m);
      const message = errorMatch?.[0]?.trim() ?? 'Test failed';
      failures.push({ name, file, message: message.slice(0, 300) });
    }
  }

  return { passed, failed, skipped, total, duration, failures };
}

function parseGenericOutput(output: string): TestSummary {
  const failures: TestFailure[] = [];

  // Try common patterns
  const passMatch = output.match(/(\d+)\s+(?:passing|passed)/i);
  const failMatch = output.match(/(\d+)\s+(?:failing|failed)/i);
  const skipMatch = output.match(/(\d+)\s+(?:skipped|pending)/i);

  const passed = passMatch ? Number.parseInt(passMatch[1] ?? '0', 10) : 0;
  const failed = failMatch ? Number.parseInt(failMatch[1] ?? '0', 10) : 0;
  const skipped = skipMatch ? Number.parseInt(skipMatch[1] ?? '0', 10) : 0;

  // Extract failure lines
  const lines = output.split('\n');
  let inFailure = false;
  let currentFailure: Partial<TestFailure> = {};

  for (const line of lines) {
    if (/(?:FAIL|✗|✕|×)\s+/.test(line)) {
      if (currentFailure.name) {
        failures.push({
          name: currentFailure.name,
          file: currentFailure.file,
          message: currentFailure.message ?? 'Test failed',
        });
      }
      inFailure = true;
      currentFailure = { name: line.trim().slice(0, 200) };
    } else if (inFailure && /(?:Error|Expected|Received|assert)/i.test(line)) {
      currentFailure.message = line.trim().slice(0, 300);
      inFailure = false;
    }
  }
  if (currentFailure.name) {
    failures.push({
      name: currentFailure.name,
      file: currentFailure.file,
      message: currentFailure.message ?? 'Test failed',
    });
  }

  return {
    passed,
    failed,
    skipped,
    total: passed + failed + skipped,
    failures,
  };
}

export const testRunnerTool: Tool = {
  name: 'test_runner',
  label: 'Run Tests',
  description:
    'Run tests and return structured results with pass/fail counts and failure details. Auto-detects the test framework (Vitest, Jest, Mocha). Can run all tests or target a specific file.',
  parameters: z.object({
    file: z
      .string()
      .optional()
      .describe('Specific test file or pattern to run (e.g., "src/__tests__/auth.test.ts")'),
    grep: z.string().optional().describe('Filter tests by name pattern'),
    timeout: z
      .number()
      .optional()
      .describe(`Timeout in milliseconds (default: ${DEFAULT_TIMEOUT_MS}, max: 300000)`),
  }),

  async execute(params): Promise<ToolResult> {
    const { file, grep, timeout } = params as {
      file?: string;
      grep?: string;
      timeout?: number;
    };
    const config = getSafetyConfig();
    const timeoutMs = Math.min(timeout ?? DEFAULT_TIMEOUT_MS, 300_000);

    const framework = detectFramework(config.projectRoot);
    const command = buildCommand(framework, file, grep);

    let stdout = '';
    let stderr = '';
    let exitCode = 0;

    try {
      stdout = execSync(command, {
        cwd: config.projectRoot,
        timeout: timeoutMs,
        maxBuffer: MAX_OUTPUT_BYTES,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          CI: 'true',
          FORCE_COLOR: '0',
          NODE_OPTIONS: '--experimental-vm-modules',
        },
      });
    } catch (err) {
      const execErr = err as {
        status?: number | null;
        stdout?: string;
        stderr?: string;
        killed?: boolean;
        signal?: string;
      };

      if (execErr.killed || execErr.signal === 'SIGTERM') {
        return {
          success: false,
          error: `Tests timed out after ${timeoutMs}ms`,
          data: {
            framework,
            command,
            exitCode: -1,
            summary: { passed: 0, failed: 0, skipped: 0, total: 0, failures: [] },
          },
        };
      }

      exitCode = execErr.status ?? 1;
      stdout = (execErr.stdout ?? '').toString();
      stderr = (execErr.stderr ?? '').toString();
    }

    const combined = [stdout, stderr].filter(Boolean).join('\n');

    // Parse results
    const summary: TestSummary =
      framework === 'vitest' ? parseVitestOutput(combined) : parseGenericOutput(combined);

    // Build token-efficient content for LLM
    const statusIcon = summary.failed > 0 ? '✗' : '✓';
    const lines: string[] = [
      `${statusIcon} Tests: ${summary.passed} passed, ${summary.failed} failed, ${summary.skipped} skipped (${summary.total} total)`,
    ];
    if (summary.duration) lines.push(`Duration: ${summary.duration}`);
    if (file) lines.push(`File: ${file}`);
    lines.push(`Framework: ${framework}`);

    if (summary.failures.length > 0) {
      lines.push('', 'Failures:');
      for (const f of summary.failures.slice(0, 10)) {
        lines.push(`  ${f.file ? `${f.file}: ` : ''}${f.name}`);
        lines.push(`    ${f.message}`);
      }
      if (summary.failures.length > 10) {
        lines.push(`  ... and ${summary.failures.length - 10} more`);
      }
    }

    return {
      success: summary.failed === 0,
      data: { framework, command, exitCode, summary },
      content: lines.join('\n'),
    };
  },
};
