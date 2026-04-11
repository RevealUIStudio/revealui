/**
 * Code Validator
 *
 * Core validation logic for AI-generated code
 */

import { minimatch } from 'minimatch';
import type {
  CodeStandards,
  ValidateCodeOptions,
  ValidationResult,
  ValidationRule,
  ValidationViolation,
} from './types.ts';

export class CodeValidator {
  constructor(private standards: CodeStandards) {}

  /**
   * Validate code content against standards
   */
  validate(code: string, options: ValidateCodeOptions = {}): ValidationResult {
    const violations: ValidationViolation[] = [];
    const lines = code.split('\n');
    let exemptionsApplied = 0;

    for (const rule of this.standards.rules) {
      // Check if file path is exempted
      if (options.filePath && this.isPathExempted(options.filePath, rule)) {
        exemptionsApplied++;
        continue;
      }

      // Check if file has a file-level exemption comment in the first 3 lines
      if (this.hasFileLevelExemption(lines, rule, options.exemptionComments)) {
        exemptionsApplied++;
        continue;
      }

      const regex = new RegExp(rule.pattern, 'g');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;

        const lineNumber = i + 1;

        // Check if line has exemption comment
        if (this.hasExemptionComment(line, rule, options.exemptionComments)) {
          exemptionsApplied++;
          continue;
        }

        // Check for violations
        let match: RegExpExecArray | null;
        // biome-ignore lint/suspicious/noAssignInExpressions: Standard regex iteration pattern
        while ((match = regex.exec(line)) !== null) {
          violations.push({
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            message: rule.message,
            line: lineNumber,
            column: match.index + 1,
            lineContent: line.trim(),
            context: this.getContext(lines, i),
            suggestedFix: rule.suggestedFix,
          });
        }
      }
    }

    const errors = violations.filter((v) => v.severity === 'error').length;
    const warnings = violations.filter((v) => v.severity === 'warning').length;
    const info = violations.filter((v) => v.severity === 'info').length;

    return {
      valid: errors === 0,
      violations,
      errors,
      warnings,
      info,
      stats: {
        linesScanned: lines.length,
        rulesApplied: this.standards.rules.length,
        exemptionsApplied,
      },
    };
  }

  /**
   * Auto-fix violations (if enabled)
   */
  autoFix(code: string): { code: string; fixesApplied: number } {
    if (!(this.standards.autoFix?.enabled && this.standards.autoFix.rules)) {
      return { code, fixesApplied: 0 };
    }

    let fixedCode = code;
    let fixesApplied = 0;

    for (const fixRule of this.standards.autoFix.rules) {
      const regex = new RegExp(fixRule.find, 'g');
      const matches = fixedCode.match(regex);
      if (matches) {
        fixedCode = fixedCode.replace(regex, fixRule.replace);
        fixesApplied += matches.length;
      }
    }

    return { code: fixedCode, fixesApplied };
  }

  /**
   * Check if file path is exempted from rule
   */
  private isPathExempted(filePath: string, rule: ValidationRule): boolean {
    if (!rule.exemptions?.paths) return false;

    return rule.exemptions.paths.some((pattern) => minimatch(filePath, pattern));
  }

  /**
   * Check if file has a file-level exemption comment in the first few lines.
   *
   * File-level exemptions must be standalone comment lines whose only
   * meaningful content is the exemption directive (e.g. "console-allowed"
   * as the sole content of a block or line comment). A regular code line
   * that happens to have an inline exemption comment does NOT qualify  -
   * that is a line-level exemption handled in the per-line loop.
   */
  private hasFileLevelExemption(
    lines: string[],
    rule: ValidationRule,
    additionalComments?: string[],
  ): boolean {
    const exemptionComments = [...(rule.exemptions?.comments ?? []), ...(additionalComments ?? [])];
    if (exemptionComments.length === 0) return false;

    const headerLines = lines.slice(0, 3);
    return headerLines.some((line) => {
      if (line === undefined) return false;
      // Strip the line to its core content  -  remove comment delimiters and whitespace
      const stripped = line.trim().replace('/*', '').replace('*/', '').replace('//', '').trim();
      return exemptionComments.some((comment) => stripped === comment);
    });
  }

  /**
   * Check if line has exemption comment
   */
  private hasExemptionComment(
    line: string,
    rule: ValidationRule,
    additionalComments?: string[],
  ): boolean {
    const exemptionComments = [...(rule.exemptions?.comments || []), ...(additionalComments || [])];

    return exemptionComments.some((comment) => line.includes(comment));
  }

  /**
   * Get context lines around a violation
   */
  private getContext(lines: string[], index: number): string[] | undefined {
    const contextLines = this.standards.reporting?.contextLines || 2;
    if (!this.standards.reporting?.showContext) return undefined;

    const start = Math.max(0, index - contextLines);
    const end = Math.min(lines.length, index + contextLines + 1);

    return lines.slice(start, end).map((line, i) => {
      const lineNumber = start + i + 1;
      const marker = lineNumber === index + 1 ? '>' : ' ';
      return `${marker} ${lineNumber.toString().padStart(4)} | ${line}`;
    });
  }

  /**
   * Format validation result for display
   */
  formatResult(result: ValidationResult, options: { colors?: boolean } = {}): string {
    const { colors = true } = options;
    const lines: string[] = [];

    // Summary
    if (result.violations.length === 0) {
      lines.push(
        colors ? '\x1b[32m✓ Code passes all standards\x1b[0m' : '✓ Code passes all standards',
      );
      return lines.join('\n');
    }

    lines.push(colors ? '\x1b[31m✗ Code violations found\x1b[0m' : '✗ Code violations found');
    lines.push('');

    // Violations
    for (const violation of result.violations) {
      const severityColor = colors
        ? violation.severity === 'error'
          ? '\x1b[31m'
          : violation.severity === 'warning'
            ? '\x1b[33m'
            : '\x1b[36m'
        : '';
      const reset = colors ? '\x1b[0m' : '';

      lines.push(
        `${severityColor}${violation.severity.toUpperCase()}${reset} [${violation.ruleId}] ${violation.ruleName}`,
      );
      lines.push(`  at line ${violation.line}:${violation.column}`);
      lines.push(`  ${violation.message}`);

      if (violation.context && this.standards.reporting?.showContext) {
        lines.push('');
        lines.push(...violation.context.map((line) => `    ${line}`));
      }

      if (violation.suggestedFix) {
        lines.push(`  ${colors ? '\x1b[36m' : ''}Suggested fix:${reset}`);
        lines.push(`    ${violation.suggestedFix}`);
      }

      lines.push('');
    }

    // Stats
    lines.push(
      `Summary: ${result.errors} errors, ${result.warnings} warnings, ${result.info} info`,
    );
    lines.push(
      `Scanned ${result.stats.linesScanned} lines with ${result.stats.rulesApplied} rules (${result.stats.exemptionsApplied} exemptions)`,
    );

    return lines.join('\n');
  }
}

/**
 * Load code standards from JSON file
 */
export async function loadStandards(filePath: string): Promise<CodeStandards> {
  const fs = await import('node:fs/promises');
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content) as CodeStandards;
}

/**
 * Create validator instance with standards
 */
export async function createValidator(standardsPath: string): Promise<CodeValidator> {
  const standards = await loadStandards(standardsPath);
  return new CodeValidator(standards);
}
