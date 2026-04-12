/**
 * lint_fix — Run linter and optionally auto-fix issues
 *
 * Detects the linter (Biome, ESLint) and runs it with machine-parseable
 * output. Returns structured diagnostic counts and details.
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod/v4';
import type { Tool, ToolResult } from '../base.js';
import { getSafetyConfig } from './safety.js';

/** Default timeout: 60 seconds */
const DEFAULT_TIMEOUT_MS = 60_000;

/** Max output: 200KB */
const MAX_OUTPUT_BYTES = 200 * 1024;

interface LintDiagnostic {
  file: string;
  line?: number;
  column?: number;
  severity: 'error' | 'warning' | 'info';
  rule?: string;
  message: string;
}

interface LintSummary {
  errors: number;
  warnings: number;
  fixable: number;
  total: number;
  diagnostics: LintDiagnostic[];
}

type Linter = 'biome' | 'eslint' | 'unknown';

function detectLinter(projectRoot: string): Linter {
  // Check for Biome config
  if (existsSync(join(projectRoot, 'biome.json')) || existsSync(join(projectRoot, 'biome.jsonc'))) {
    return 'biome';
  }

  // Check package.json devDependencies
  const pkgPath = join(projectRoot, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
      const deps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
      };
      if (deps['@biomejs/biome']) return 'biome';
      if (deps.eslint) return 'eslint';
    } catch {
      // Fall through
    }
  }

  return 'unknown';
}

/** Validate that a file argument is safe for shell use (no metacharacters) */
function isSafeShellArg(arg: string): boolean {
  return /^[\w./@-]+$/.test(arg);
}

function buildCommand(linter: Linter, file?: string, fix?: boolean): string {
  const target = file && isSafeShellArg(file) ? file : '.';

  switch (linter) {
    case 'biome':
      return fix ? `npx biome check --write ${target}` : `npx biome check ${target}`;
    case 'eslint':
      return fix
        ? `npx eslint ${target} --fix --format json`
        : `npx eslint ${target} --format json`;
    default:
      // Try pnpm lint as fallback
      return fix ? 'pnpm lint:fix' : 'pnpm lint';
  }
}

function parseBiomeOutput(output: string): LintSummary {
  const diagnostics: LintDiagnostic[] = [];

  // Parse Biome diagnostic lines: "path/file.ts:line:col lint/rule ━━━"
  // and "path/file.ts:line:col organize_imports ━━━"
  const diagRegex = /^(.+?):(\d+):(\d+)\s+(\S+)/gm;
  let match: RegExpExecArray | null = diagRegex.exec(output);
  while (match !== null) {
    const file = match[1] ?? '';
    const line = Number.parseInt(match[2] ?? '0', 10);
    const column = Number.parseInt(match[3] ?? '0', 10);
    const rule = match[4];

    // Extract message from the next meaningful line
    const afterMatch = output.slice((match.index ?? 0) + match[0].length);
    const msgMatch = afterMatch.match(/\n\s*[×✖!⚠ℹ]\s*(.+)/);
    const message = msgMatch?.[1]?.trim() ?? rule ?? '';

    const severity: LintDiagnostic['severity'] = /error|×|✖/.test(afterMatch.slice(0, 100))
      ? 'error'
      : 'warning';

    diagnostics.push({
      file,
      line,
      column,
      severity,
      rule,
      message: message.slice(0, 200),
    });
    match = diagRegex.exec(output);
  }

  // Parse summary: "Found N errors." or "Checked N file(s). No errors found."
  const errorCountMatch = output.match(/Found\s+(\d+)\s+error/i);
  const warningCountMatch = output.match(/Found\s+(\d+)\s+warning/i);
  const fixableMatch = output.match(/(\d+)\s+(?:fixable|fix(?:ed)?)/i);

  const errors = errorCountMatch
    ? Number.parseInt(errorCountMatch[1] ?? '0', 10)
    : diagnostics.filter((d) => d.severity === 'error').length;
  const warnings = warningCountMatch
    ? Number.parseInt(warningCountMatch[1] ?? '0', 10)
    : diagnostics.filter((d) => d.severity === 'warning').length;
  const fixable = fixableMatch ? Number.parseInt(fixableMatch[1] ?? '0', 10) : 0;

  return {
    errors,
    warnings,
    fixable,
    total: errors + warnings,
    diagnostics,
  };
}

function parseEslintOutput(output: string): LintSummary {
  const diagnostics: LintDiagnostic[] = [];
  let errors = 0;
  let warnings = 0;
  let fixable = 0;

  try {
    // ESLint JSON format
    const results = JSON.parse(output) as Array<{
      filePath: string;
      errorCount: number;
      warningCount: number;
      fixableErrorCount: number;
      fixableWarningCount: number;
      messages: Array<{
        line: number;
        column: number;
        severity: 1 | 2;
        ruleId: string | null;
        message: string;
      }>;
    }>;

    for (const result of results) {
      errors += result.errorCount;
      warnings += result.warningCount;
      fixable += result.fixableErrorCount + result.fixableWarningCount;

      for (const msg of result.messages.slice(0, 20)) {
        diagnostics.push({
          file: result.filePath,
          line: msg.line,
          column: msg.column,
          severity: msg.severity === 2 ? 'error' : 'warning',
          rule: msg.ruleId ?? undefined,
          message: msg.message.slice(0, 200),
        });
      }
    }
  } catch {
    // Fall back to generic parsing
    return parseGenericOutput(output);
  }

  return { errors, warnings, fixable, total: errors + warnings, diagnostics };
}

function parseGenericOutput(output: string): LintSummary {
  const diagnostics: LintDiagnostic[] = [];

  // Generic pattern: file:line:col: severity message
  const lineRegex = /^(.+?):(\d+):(\d+):\s*(error|warning|info)\s+(.+)/gm;
  let match: RegExpExecArray | null = lineRegex.exec(output);
  while (match !== null) {
    diagnostics.push({
      file: match[1] ?? '',
      line: Number.parseInt(match[2] ?? '0', 10),
      column: Number.parseInt(match[3] ?? '0', 10),
      severity: (match[4] ?? 'error') as LintDiagnostic['severity'],
      message: (match[5] ?? '').slice(0, 200),
    });
    match = lineRegex.exec(output);
  }

  const errors = diagnostics.filter((d) => d.severity === 'error').length;
  const warnings = diagnostics.filter((d) => d.severity === 'warning').length;

  return {
    errors,
    warnings,
    fixable: 0,
    total: errors + warnings,
    diagnostics,
  };
}

export const lintFixTool: Tool = {
  name: 'lint_fix',
  label: 'Lint & Fix',
  description:
    'Run the project linter and return structured diagnostics. Auto-detects Biome or ESLint. Can optionally auto-fix issues. Returns error/warning counts and individual diagnostic details.',
  parameters: z.object({
    file: z
      .string()
      .optional()
      .describe('Specific file or directory to lint (default: entire project)'),
    fix: z.boolean().optional().describe('Auto-fix fixable issues (default: false)'),
    timeout: z
      .number()
      .optional()
      .describe(`Timeout in milliseconds (default: ${DEFAULT_TIMEOUT_MS}, max: 300000)`),
  }),

  async execute(params): Promise<ToolResult> {
    const { file, fix, timeout } = params as {
      file?: string;
      fix?: boolean;
      timeout?: number;
    };
    const config = getSafetyConfig();
    const timeoutMs = Math.min(timeout ?? DEFAULT_TIMEOUT_MS, 300_000);

    const linter = detectLinter(config.projectRoot);
    const command = buildCommand(linter, file, fix);

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
          FORCE_COLOR: '0',
          NO_COLOR: '1',
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
          error: `Linting timed out after ${timeoutMs}ms`,
          data: {
            linter,
            command,
            exitCode: -1,
            summary: { errors: 0, warnings: 0, fixable: 0, total: 0, diagnostics: [] },
          },
        };
      }

      exitCode = execErr.status ?? 1;
      stdout = (execErr.stdout ?? '').toString();
      stderr = (execErr.stderr ?? '').toString();
    }

    const combined = [stdout, stderr].filter(Boolean).join('\n');

    // Parse results
    let summary: LintSummary;
    switch (linter) {
      case 'biome':
        summary = parseBiomeOutput(combined);
        break;
      case 'eslint':
        summary = parseEslintOutput(combined);
        break;
      default:
        summary = parseGenericOutput(combined);
    }

    // Build token-efficient content
    const statusIcon = summary.errors > 0 ? '✗' : summary.warnings > 0 ? '⚠' : '✓';
    const lines: string[] = [
      `${statusIcon} Lint: ${summary.errors} errors, ${summary.warnings} warnings (${summary.total} total)`,
    ];
    if (summary.fixable > 0) lines.push(`Fixable: ${summary.fixable}`);
    if (fix) lines.push('Mode: auto-fix applied');
    if (file) lines.push(`Target: ${file}`);
    lines.push(`Linter: ${linter}`);

    if (summary.diagnostics.length > 0) {
      lines.push('', 'Diagnostics:');
      for (const d of summary.diagnostics.slice(0, 15)) {
        const loc = d.line ? `:${d.line}${d.column ? `:${d.column}` : ''}` : '';
        const rule = d.rule ? ` [${d.rule}]` : '';
        lines.push(`  ${d.severity === 'error' ? '✗' : '⚠'} ${d.file}${loc}${rule}`);
        lines.push(`    ${d.message}`);
      }
      if (summary.diagnostics.length > 15) {
        lines.push(`  ... and ${summary.diagnostics.length - 15} more`);
      }
    }

    return {
      success: summary.errors === 0,
      data: { linter, command, exitCode, summary },
      content: lines.join('\n'),
    };
  },
};
