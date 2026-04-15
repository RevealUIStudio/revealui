/**
 * Sanitizer Usage Analyzer
 *
 * Detects ad-hoc sanitization logic outside @revealui/security.
 * Specifically flags re-implementations of the canonical helpers
 * (sanitizeHtml, escapeHtml, escapeShellArg, escapeSqlIdentifier,
 * sanitizeTerminalLine, redactLogField, sanitizeUrl) and dangerous
 * sink patterns that should use them.
 *
 * Runs as part of the security gate (warn-only).
 */

import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

// =============================================================================
// Types
// =============================================================================

export type SanitizerUsageIssueKind = 'ad-hoc-sanitizer';

export interface SanitizerUsageIssue {
  kind: SanitizerUsageIssueKind;
  file: string;
  line: number;
  column: number;
  snippet: string;
}

// =============================================================================
// Patterns
// =============================================================================

/** Directories to scan (relative to repo root) */
const SCAN_DIRS = ['apps', 'packages', 'scripts'];

/** Directories/paths to skip entirely */
const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  '.next',
  'opensrc',
  '.turbo',
  'coverage',
  '.git',
]);

/** Paths that are allowed to contain sanitizer logic */
const ALLOWED_PATHS = [
  'packages/security/',
  'packages/contracts/',
  'packages/scripts/analyzers/sanitizer-usage-analyzer',
];

const SOURCE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.mts']);

/**
 * Function names that overlap with @revealui/security exports.
 * These are the specific helpers that should NOT be re-implemented elsewhere.
 *
 * Deliberately excludes domain-specific functions like:
 * - sanitizeString, sanitizeName, sanitizeEmail, sanitizePath (input validators)
 * - escapeCsvField, escapeLikeWildcards (domain-specific escaping)
 * - redactApiKey (display masking, different from log redaction)
 */
const OVERLAPPING_FUNCTION_NAMES = new Set([
  'escapeHtml',
  'escapeShellArg',
  'escapeIdentifier',
  'escapeSqlIdentifier',
  'sanitizeHtml',
  'sanitizeTerminalLine',
  'sanitizeUrl',
  'isSafeUrl',
  'redactLogField',
  'redactLogContext',
  'redactSecretsInString',
  'isSensitiveLogKey',
]);

/**
 * Pattern: function/const declarations matching overlapping names.
 * Captures the function name for checking against the allow-list.
 */
const FUNCTION_DECL_RE =
  /(?:^|\s)(?:export\s+)?(?:function|const|let)\s+(escape\w+|sanitize\w+|redact\w+|isSafe\w+|isSensitive\w+)\s*[=(]/;

/**
 * Pattern: dangerouslySetInnerHTML usage
 */
const DANGEROUS_HTML_RE = /dangerouslySetInnerHTML/;

/**
 * Pattern: ANSI escape stripping via .replace()
 * Matches regex-replace patterns that strip ANSI sequences, NOT literal ANSI output.
 * e.g. str.replace(/\x1b\[[0-9;]*m/g, '')
 */
const ANSI_STRIP_REPLACE_RE = /\.replace\(\s*\/.*\\x1[bB]\[/;

// =============================================================================
// File Collection
// =============================================================================

function isTestFile(filePath: string): boolean {
  const base = filePath.toLowerCase();
  return (
    base.includes('.test.') ||
    base.includes('.spec.') ||
    base.includes('.e2e.') ||
    base.includes('__tests__/') ||
    base.includes('__mocks__/') ||
    base.includes('/fixtures/') ||
    base.includes('test-utils') ||
    base.includes('sanitize-corpus/')
  );
}

function isAllowedPath(filePath: string): boolean {
  return ALLOWED_PATHS.some((allowed) => filePath.includes(allowed));
}

function collectSourceFiles(dir: string): string[] {
  const files: string[] = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...collectSourceFiles(full));
      } else if (SOURCE_EXTS.has(extname(entry.name))) {
        files.push(full);
      }
    }
  } catch {
    // Permission errors or missing dirs — skip silently
  }
  return files;
}

// =============================================================================
// Scanning
// =============================================================================

function scanFile(filePath: string, relPath: string): SanitizerUsageIssue[] {
  const issues: SanitizerUsageIssue[] = [];

  let content: string;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    return issues;
  }

  // If the file already imports from @revealui/security, it's likely
  // re-exporting or wrapping — skip it to avoid noise
  if (content.includes("from '@revealui/security'") || content.includes('@revealui/security/')) {
    return issues;
  }

  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Skip comment-only lines
    const trimmed = line.trimStart();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
    // Skip import/require/type lines
    if (trimmed.startsWith('import ') || trimmed.startsWith('require(')) continue;
    if (trimmed.startsWith('type ') || trimmed.startsWith('export type ')) continue;

    // Pattern: function declarations matching canonical helper names
    const fnMatch = FUNCTION_DECL_RE.exec(line);
    if (fnMatch) {
      const fnName = fnMatch[1];
      if (OVERLAPPING_FUNCTION_NAMES.has(fnName)) {
        issues.push({
          kind: 'ad-hoc-sanitizer',
          file: relPath,
          line: lineNum,
          column: (fnMatch.index ?? 0) + 1,
          snippet: line.trim().slice(0, 120),
        });
        continue;
      }
    }

    // Pattern: ANSI stripping via .replace() (not ANSI output)
    if (ANSI_STRIP_REPLACE_RE.test(line)) {
      issues.push({
        kind: 'ad-hoc-sanitizer',
        file: relPath,
        line: lineNum,
        column: 1,
        snippet: line.trim().slice(0, 120),
      });
      continue;
    }

    // Pattern: dangerouslySetInnerHTML without sanitizeHtml in scope
    if (DANGEROUS_HTML_RE.test(line)) {
      // Check if sanitizeHtml is used in the file at all
      if (!content.includes('sanitizeHtml')) {
        issues.push({
          kind: 'ad-hoc-sanitizer',
          file: relPath,
          line: lineNum,
          column: 1,
          snippet: line.trim().slice(0, 120),
        });
      }
    }
  }

  return issues;
}

// =============================================================================
// Public API
// =============================================================================

export function findSanitizerUsageIssues(repoRoot: string): SanitizerUsageIssue[] {
  const issues: SanitizerUsageIssue[] = [];

  for (const dir of SCAN_DIRS) {
    const fullDir = join(repoRoot, dir);
    const files = collectSourceFiles(fullDir);

    for (const filePath of files) {
      const relPath = relative(repoRoot, filePath);

      // Skip test files and allowed paths
      if (isTestFile(relPath) || isAllowedPath(relPath)) continue;

      issues.push(...scanFile(filePath, relPath));
    }
  }

  return issues;
}
