#!/usr/bin/env tsx
/**
 * Exit Code Auditor
 *
 * Audits all scripts for hardcoded exit codes and missing error handling.
 * Detects process.exit() with literal numbers and suggests ErrorCode replacements.
 *
 * @dependencies
 * - node:fs - File system operations
 * - node:path - Path manipulation
 * - fast-glob - File pattern matching
 * - scripts/lib/index.js - Logger utilities
 * - scripts/lib/errors.ts - ErrorCode enum
 *
 * @example
 * ```bash
 * # Audit all scripts
 * pnpm ops audit:exit-codes
 *
 * # Output JSON
 * pnpm ops audit:exit-codes --json
 *
 * # Output markdown report
 * pnpm ops audit:exit-codes --markdown > exit-code-audit.md
 * ```
 */

import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ErrorCode } from '@revealui/scripts/errors.js';
import { createLogger } from '@revealui/scripts/index.js';
import glob from 'fast-glob';

const logger = createLogger({ prefix: 'ExitCodeAudit' });

// =============================================================================
// Types
// =============================================================================

export type ViolationType = 'hardcoded-exit' | 'throw-without-errorcode' | 'missing-try-catch';

export type Severity = 'error' | 'warning' | 'info';

export interface Violation {
  file: string;
  line: number;
  column: number;
  type: ViolationType;
  severity: Severity;
  code: string;
  message: string;
  suggestion: string;
}

export interface AuditResult {
  violations: Violation[];
  stats: {
    totalFiles: number;
    filesWithViolations: number;
    totalViolations: number;
    byType: Record<ViolationType, number>;
    bySeverity: Record<Severity, number>;
  };
}

// =============================================================================
// ErrorCode Enum Reference
// =============================================================================

const _ERROR_CODES = {
  SUCCESS: 0,
  EXECUTION_ERROR: 1,
  VALIDATION_ERROR: 2,
  MISSING_DEPENDENCY: 3,
  CONFIGURATION_ERROR: 4,
  NETWORK_ERROR: 5,
  PERMISSION_ERROR: 6,
  NOT_FOUND: 7,
  ALREADY_EXISTS: 8,
  TIMEOUT: 9,
  INTERRUPTED: 10,
  PARSE_ERROR: 11,
  UNSUPPORTED: 12,
  INTERNAL_ERROR: 13,
};

// =============================================================================
// Detection Functions
// =============================================================================

/**
 * Detect hardcoded process.exit() calls
 */
function detectHardcodedExit(content: string, filePath: string): Violation[] {
  const violations: Violation[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    // Match: process.exit(0), process.exit(1), etc.
    const exitMatches = line.matchAll(/process\.exit\((\d+)\)/g);

    for (const match of exitMatches) {
      const exitCode = Number.parseInt(match[1], 10);
      const column = match.index || 0;

      // Skip if it's already using ErrorCode (unlikely but check comments)
      const contextBefore = lines.slice(Math.max(0, i - 2), i).join('\n');
      if (contextBefore.includes('ErrorCode')) {
        continue;
      }

      // Suggest appropriate ErrorCode
      let suggestion = 'process.exit(ErrorCode.EXECUTION_ERROR)';
      let errorCodeName = 'EXECUTION_ERROR';

      if (exitCode === 0) {
        suggestion = 'process.exit(ErrorCode.SUCCESS)';
        errorCodeName = 'SUCCESS';
      } else if (exitCode === 2) {
        suggestion = 'process.exit(ErrorCode.VALIDATION_ERROR)';
        errorCodeName = 'VALIDATION_ERROR';
      }

      violations.push({
        file: filePath,
        line: lineNumber,
        column,
        type: 'hardcoded-exit',
        severity: exitCode === 0 ? 'warning' : 'error',
        code: line.trim(),
        message: `Hardcoded exit code: process.exit(${exitCode})`,
        suggestion: `Replace with: ${suggestion} (or appropriate ErrorCode.${errorCodeName})`,
      });
    }
  }

  return violations;
}

/**
 * Detect throw new Error() without ErrorCode
 */
function detectThrowWithoutErrorCode(content: string, filePath: string): Violation[] {
  const violations: Violation[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    // Match: throw new Error(...) but not throw new ScriptError(...)
    if (line.includes('throw new Error(') && !line.includes('ScriptError')) {
      const column = line.indexOf('throw');

      // Check if ErrorCode is mentioned nearby
      const contextAround = lines
        .slice(Math.max(0, i - 2), Math.min(lines.length, i + 3))
        .join('\n');
      if (contextAround.includes('ErrorCode')) {
        continue; // Likely using ErrorCode properly
      }

      violations.push({
        file: filePath,
        line: lineNumber,
        column,
        type: 'throw-without-errorcode',
        severity: 'warning',
        code: line.trim(),
        message: 'Throwing generic Error without ErrorCode',
        suggestion: 'Consider using ScriptError with ErrorCode or process.exit(ErrorCode.*)',
      });
    }
  }

  return violations;
}

/**
 * Detect missing try-catch in async functions
 */
function detectMissingTryCatch(content: string, filePath: string): Violation[] {
  const violations: Violation[] = [];
  const lines = content.split('\n');

  let inAsyncFunction = false;
  let asyncFunctionStart = 0;
  let asyncFunctionName = '';
  let braceCount = 0;
  let hasTryCatch = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    // Detect async function start
    const asyncMatch = line.match(
      /async\s+(?:function\s+)?(\w+)?\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*{/,
    );
    if (asyncMatch) {
      inAsyncFunction = true;
      asyncFunctionStart = lineNumber;
      asyncFunctionName = asyncMatch[1] || 'anonymous';
      braceCount = 1;
      hasTryCatch = false;
      continue;
    }

    if (inAsyncFunction) {
      // Count braces to track function scope
      braceCount += (line.match(/{/g) || []).length;
      braceCount -= (line.match(/}/g) || []).length;

      // Check for try-catch
      if (line.includes('try') && line.includes('{')) {
        hasTryCatch = true;
      }

      // Function ended
      if (braceCount === 0) {
        // Check if function has await calls but no try-catch
        const functionLines = lines.slice(asyncFunctionStart - 1, i + 1).join('\n');
        const hasAwait = functionLines.includes('await ');
        const hasProcessExit = functionLines.includes('process.exit');

        if (hasAwait && !hasTryCatch && !hasProcessExit) {
          // Only flag if it's a substantial function (> 5 lines)
          if (i - asyncFunctionStart > 5) {
            violations.push({
              file: filePath,
              line: asyncFunctionStart,
              column: 0,
              type: 'missing-try-catch',
              severity: 'info',
              code: `async ${asyncFunctionName}()`,
              message: `Async function "${asyncFunctionName}" has await calls but no try-catch`,
              suggestion:
                'Add try-catch block to handle potential errors and use process.exit(ErrorCode.*)',
            });
          }
        }

        inAsyncFunction = false;
      }
    }
  }

  return violations;
}

/**
 * Audit a single file
 */
function auditFile(filePath: string, rootDir: string): Violation[] {
  const content = readFileSync(filePath, 'utf-8');
  const relativePath = relative(rootDir, filePath);

  const violations: Violation[] = [];

  // Skip if file imports ErrorCode properly
  const hasErrorCodeImport =
    content.includes("from './lib/errors") ||
    content.includes("from '@revealui/scripts/errors") ||
    content.includes("from '@revealui/scripts/errors");

  // Run all detection functions
  violations.push(...detectHardcodedExit(content, relativePath));

  if (!hasErrorCodeImport) {
    violations.push(...detectThrowWithoutErrorCode(content, relativePath));
  }

  violations.push(...detectMissingTryCatch(content, relativePath));

  return violations;
}

// =============================================================================
// Audit Execution
// =============================================================================

/**
 * Audit all script files
 */
export function auditExitCodes(
  rootDir: string,
  options: {
    verbose?: boolean;
  } = {},
): AuditResult {
  const { verbose = true } = options;

  if (verbose) {
    logger.info('Auditing exit codes in all scripts...');
  }

  // Find all TypeScript files in scripts/
  const files = glob.sync('scripts/**/*.ts', {
    cwd: rootDir,
    absolute: true,
    ignore: ['**/node_modules/**', '**/dist/**', '**/*.test.ts', '**/*.spec.ts', '**/opensrc/**'],
  });

  if (verbose) {
    logger.info(`Found ${files.length} script files`);
  }

  // Audit each file
  const allViolations: Violation[] = [];
  let filesWithViolations = 0;

  for (const file of files) {
    const violations = auditFile(file, rootDir);
    if (violations.length > 0) {
      allViolations.push(...violations);
      filesWithViolations++;
    }
  }

  // Calculate statistics
  const byType: Record<ViolationType, number> = {
    'hardcoded-exit': 0,
    'throw-without-errorcode': 0,
    'missing-try-catch': 0,
  };

  const bySeverity: Record<Severity, number> = {
    error: 0,
    warning: 0,
    info: 0,
  };

  for (const violation of allViolations) {
    byType[violation.type]++;
    bySeverity[violation.severity]++;
  }

  return {
    violations: allViolations,
    stats: {
      totalFiles: files.length,
      filesWithViolations,
      totalViolations: allViolations.length,
      byType,
      bySeverity,
    },
  };
}

// =============================================================================
// Output Formatters
// =============================================================================

/**
 * Display audit results to console
 */
export function displayResults(result: AuditResult): void {
  console.log('\n🔍 Exit Code Audit Report\n');
  console.log('='.repeat(70));

  console.log('\n📊 Statistics:');
  console.log(`  Total files scanned:         ${result.stats.totalFiles}`);
  console.log(`  Files with violations:       ${result.stats.filesWithViolations}`);
  console.log(`  Total violations:            ${result.stats.totalViolations}`);

  console.log('\n📈 By Type:');
  console.log(`  Hardcoded exit codes:        ${result.stats.byType['hardcoded-exit']}`);
  console.log(`  Throw without ErrorCode:     ${result.stats.byType['throw-without-errorcode']}`);
  console.log(`  Missing try-catch:           ${result.stats.byType['missing-try-catch']}`);

  console.log('\n🎯 By Severity:');
  console.log(`  Errors:                      ${result.stats.bySeverity.error}`);
  console.log(`  Warnings:                    ${result.stats.bySeverity.warning}`);
  console.log(`  Info:                        ${result.stats.bySeverity.info}`);

  if (result.violations.length > 0) {
    console.log('\n❌ Violations Found:\n');

    // Group by file
    const byFile = new Map<string, Violation[]>();
    for (const violation of result.violations) {
      let violations = byFile.get(violation.file);
      if (!violations) {
        violations = [];
        byFile.set(violation.file, violations);
      }
      violations.push(violation);
    }

    // Display up to 50 violations
    let count = 0;
    for (const [file, violations] of byFile) {
      if (count >= 50) {
        console.log(`\n... and ${result.violations.length - count} more violations`);
        break;
      }

      console.log(`📄 ${file}:`);
      for (const violation of violations) {
        const emoji =
          violation.severity === 'error' ? '❌' : violation.severity === 'warning' ? '⚠️' : 'ℹ️';
        console.log(`  ${emoji} Line ${violation.line}: ${violation.message}`);
        console.log(`     Code: ${violation.code}`);
        console.log(`     Fix: ${violation.suggestion}`);
        console.log();
        count++;

        if (count >= 50) break;
      }
    }
  } else {
    console.log('\n✅ No violations found! All scripts use proper error handling.');
  }

  console.log('='.repeat(70));
}

/**
 * Generate markdown report
 */
export function generateMarkdown(result: AuditResult): string {
  let md = '# Exit Code Audit Report\n\n';
  md += `Generated: ${new Date().toLocaleString()}\n\n`;

  md += '## Summary\n\n';
  md += '| Metric | Count |\n';
  md += '|--------|-------|\n';
  md += `| Total files scanned | ${result.stats.totalFiles} |\n`;
  md += `| Files with violations | ${result.stats.filesWithViolations} |\n`;
  md += `| Total violations | ${result.stats.totalViolations} |\n`;
  md += `| Hardcoded exit codes | ${result.stats.byType['hardcoded-exit']} |\n`;
  md += `| Throw without ErrorCode | ${result.stats.byType['throw-without-errorcode']} |\n`;
  md += `| Missing try-catch | ${result.stats.byType['missing-try-catch']} |\n\n`;

  if (result.violations.length > 0) {
    md += '## Violations\n\n';

    // Group by file
    const byFile = new Map<string, Violation[]>();
    for (const violation of result.violations) {
      let violations = byFile.get(violation.file);
      if (!violations) {
        violations = [];
        byFile.set(violation.file, violations);
      }
      violations.push(violation);
    }

    for (const [file, violations] of byFile) {
      md += `### \`${file}\`\n\n`;

      for (const violation of violations) {
        const emoji =
          violation.severity === 'error' ? '❌' : violation.severity === 'warning' ? '⚠️' : 'ℹ️';
        md += `${emoji} **Line ${violation.line}**: ${violation.message}\n\n`;
        md += '```typescript\n';
        md += `${violation.code}\n`;
        md += '```\n\n';
        md += `**Suggestion**: ${violation.suggestion}\n\n`;
      }
    }
  } else {
    md += '## ✅ No Violations Found\n\n';
    md += 'All scripts use proper error handling with ErrorCode enum.\n';
  }

  return md;
}

// =============================================================================
// CLI
// =============================================================================

if (import.meta.url === `file://${process.argv[1]}`) {
  const rootDir = join(import.meta.dirname, '../../..');

  // Parse arguments
  const args = process.argv.slice(2);
  const jsonOutput = args.includes('--json');
  const markdownOutput = args.includes('--markdown');
  const verbose = !(jsonOutput || markdownOutput);

  // Run audit
  const result = auditExitCodes(rootDir, { verbose });

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else if (markdownOutput) {
    console.log(generateMarkdown(result));
  } else {
    displayResults(result);

    // Exit with error code if violations found
    if (result.stats.bySeverity.error > 0) {
      process.exit(ErrorCode.VALIDATION_ERROR);
    }
  }
}
