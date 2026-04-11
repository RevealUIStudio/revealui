#!/usr/bin/env tsx
/**
 * Any Types Audit Script
 *
 * Scans all TypeScript files for `any` type usage and categorizes by necessity:
 * - Legitimate: Test mocks, third-party library types, dynamic code
 * - Avoidable: Can be replaced with proper types, type guards, or unknown
 *
 * Usage:
 *   pnpm tsx scripts/audit/audit-any-types.ts
 *   pnpm tsx scripts/audit/audit-any-types.ts --json > any-types.json
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ErrorCode } from '@revealui/scripts/errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const workspaceRoot = join(__dirname, '../..');

const DEFAULT_EXCLUDE_DIRS = [
  'node_modules',
  'dist',
  'build',
  '.next',
  '.turbo',
  '.cursor',
  'coverage',
  '.git',
  '.nuxt',
  '.output',
  '.vercel',
  '.cache',
  'opensrc',
];

function scanDirectorySync(dir: string, extensions: string[] = ['.ts', '.tsx']): string[] {
  const files: string[] = [];

  function scan(currentDir: string, depth: number): void {
    if (depth > 50) return; // Prevent infinite recursion

    try {
      const entries = readdirSync(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;

        const fullPath = join(currentDir, entry.name);

        if (entry.isDirectory() && DEFAULT_EXCLUDE_DIRS.includes(entry.name)) {
          continue;
        }

        if (entry.isDirectory()) {
          scan(fullPath, depth + 1);
        } else if (entry.isFile()) {
          const ext = entry.name.substring(entry.name.lastIndexOf('.'));
          if (extensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch {
      // Skip directories we can't read
    }
  }

  scan(dir, 0);
  return files;
}

interface AnyUsage {
  file: string;
  line: number;
  column: number;
  code: string;
  category: 'legitimate' | 'avoidable' | 'unknown';
  context: string;
}

interface AuditResult {
  legitimate: AnyUsage[];
  avoidable: AnyUsage[];
  unknown: AnyUsage[];
  summary: {
    total: number;
    legitimate: number;
    avoidable: number;
    unknown: number;
  };
}

function categorizeAnyUsage(
  filePath: string,
  line: string,
  _lineNumber: number,
): 'legitimate' | 'avoidable' | 'unknown' {
  const relativePath = relative(workspaceRoot, filePath);

  // Test files - any is often legitimate for mocks
  if (
    relativePath.includes('.test.') ||
    relativePath.includes('.spec.') ||
    relativePath.includes('__tests__') ||
    relativePath.includes('/tests/')
  ) {
    // Check if it's a mock or test utility
    if (
      line.includes('mock') ||
      line.includes('Mock') ||
      line.includes('jest') ||
      line.includes('vi.') ||
      line.includes('as any') ||
      line.includes('as unknown as any')
    ) {
      return 'legitimate';
    }
    // Otherwise, could be avoidable even in tests
    return 'avoidable';
  }

  // Check for common legitimate patterns
  const _legitimatePatterns = [
    /as\s+any\s*$/, // Type assertion at end (often for third-party types)
    /:\s*any\s*[=;]/, // Variable declaration with any
    /<any>/, // Generic any
    /Record<string,\s*any>/, // Record with any value
    /any\[\]/, // Array of any
    /\(.*\)\s*:\s*any/, // Function return type any
  ];

  // Check for avoidable patterns
  const _avoidablePatterns = [
    /:\s*any\s*[=;]/, // Variable declaration
    /function\s+\w+\s*\(.*:\s*any/, // Function parameter
    /\(.*\)\s*:\s*any/, // Function return type
    /const\s+\w+\s*:\s*any/, // Const declaration
    /let\s+\w+\s*:\s*any/, // Let declaration
  ];

  // Check context for legitimate cases
  if (
    line.includes('third-party') ||
    line.includes('external') ||
    line.includes('dynamic') ||
    line.includes('JSON.parse') ||
    (line.includes('as any') && line.includes('//') && line.includes('legitimate')) ||
    // z.any() is the required Zod type for OpenAPI file upload schemas (multipart/form-data)
    // No alternative exists in Zod that accepts FormData binary with .openapi() override
    line.includes('z.any()')
  ) {
    return 'legitimate';
  }

  // Default to avoidable for production code
  if (
    relativePath.includes('/src/') &&
    (relativePath.startsWith('packages/') || relativePath.startsWith('apps/'))
  ) {
    return 'avoidable';
  }

  return 'unknown';
}

function findAnyUsage(filePath: string): AnyUsage[] {
  const usages: AnyUsage[] = [];

  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    // Track multiline template literal state across lines
    let inTemplateLiteral = false;

    lines.forEach((line, index) => {
      // Count backticks on this line to toggle template literal state
      const backtickCount = (line.match(/`/g) || []).length;
      if (backtickCount % 2 !== 0) {
        inTemplateLiteral = !inTemplateLiteral;
      }

      // Match `any` type usage
      // Match patterns like: : any, <any>, any[], etc.
      const anyRegex = /\bany\b/g;
      let match = anyRegex.exec(line);

      while (match !== null) {
        // Skip if it's in a string or comment
        const beforeMatch = line.substring(0, match.index);
        const _afterMatch = line.substring(match.index);

        // More robust string detection - check for quotes and template literals
        const singleQuotes = (beforeMatch.match(/'/g) || []).length;
        const doubleQuotes = (beforeMatch.match(/"/g) || []).length;
        const backticks = (beforeMatch.match(/`/g) || []).length;
        const inString =
          singleQuotes % 2 !== 0 ||
          doubleQuotes % 2 !== 0 ||
          backticks % 2 !== 0 ||
          inTemplateLiteral;

        // Detect JSX text content  -  "any" appearing as an English word in HTML, not as a TS type.
        // JSX text lines typically contain HTML entities, JSX tags, or are inside tag content.
        const trimmedLine = line.trim();
        const looksLikeJSXText =
          trimmedLine.length > 0 &&
          // Line contains JSX text indicators (HTML entities or surrounded by tags)
          (/&\w+;/.test(trimmedLine) ||
            /^<\w+[^>]*>.*\bany\b.*<\/\w+>/.test(trimmedLine) ||
            // "any" preceded by a word character + space (English prose, not `: any`)
            /\w\s+any(\s+\w|$)/.test(trimmedLine)) &&
          // Not a TypeScript type annotation
          !/:\s*any\b/.test(trimmedLine) &&
          !/<any>/.test(trimmedLine) &&
          !/as\s+any\b/.test(trimmedLine) &&
          !trimmedLine.startsWith('const ') &&
          !trimmedLine.startsWith('let ') &&
          !trimmedLine.startsWith('function ') &&
          !trimmedLine.startsWith('type ') &&
          !trimmedLine.startsWith('interface ');

        const inComment =
          beforeMatch.includes('//') || beforeMatch.includes('/*') || beforeMatch.includes('*');

        // Check if any of the previous 5 lines has biome-ignore comment (for multi-line strings)
        const hasBiomeIgnore = [1, 2, 3, 4, 5].some(
          (offset) =>
            index >= offset &&
            lines[index - offset]?.includes('biome-ignore') &&
            lines[index - offset]?.includes('noExplicitAny'),
        );

        // Check if it's expect.any() from Vitest/Jest
        const isExpectAny = line.includes('expect.any(');

        if (!(inString || inComment || hasBiomeIgnore || isExpectAny || looksLikeJSXText)) {
          // Get context (previous and next lines)
          const context = [
            index > 0 ? lines[index - 1].trim() : '',
            line.trim(),
            index < lines.length - 1 ? lines[index + 1].trim() : '',
          ]
            .filter((l) => l.length > 0)
            .join(' | ');

          const category = categorizeAnyUsage(filePath, line, index + 1);

          usages.push({
            file: relative(workspaceRoot, filePath),
            line: index + 1,
            column: match.index + 1,
            code: line.trim().substring(0, 100),
            category,
            context: context.substring(0, 200),
          });
        }

        match = anyRegex.exec(line);
      }
    });
  } catch (_error) {
    console.error(`Error reading file ${filePath}:`, _error);
  }

  return usages;
}

function auditAnyTypes(): AuditResult {
  console.error('🔍 Scanning for `any` type usage...\n');

  // Scan all TypeScript files
  const packagesDir = join(workspaceRoot, 'packages');
  const appsDir = join(workspaceRoot, 'apps');

  const packagesFiles = scanDirectorySync(packagesDir, ['.ts', '.tsx']);
  const appsFiles = scanDirectorySync(appsDir, ['.ts', '.tsx']);
  const files = [...packagesFiles, ...appsFiles];

  console.error(`📁 Scanning ${files.length} TypeScript files...\n`);

  const allUsages: AnyUsage[] = [];

  for (const file of files) {
    const usages = findAnyUsage(file);
    allUsages.push(...usages);
  }

  // Categorize
  const legitimate = allUsages.filter((u) => u.category === 'legitimate');
  const avoidable = allUsages.filter((u) => u.category === 'avoidable');
  const unknown = allUsages.filter((u) => u.category === 'unknown');

  return {
    legitimate,
    avoidable,
    unknown,
    summary: {
      total: allUsages.length,
      legitimate: legitimate.length,
      avoidable: avoidable.length,
      unknown: unknown.length,
    },
  };
}

function printReport(result: AuditResult, outputJson = false): void {
  if (outputJson) {
    // Add summary statistics for JSON output
    const byPackage = new Map<string, number>();
    const byFile = new Map<string, number>();

    for (const usage of result.avoidable) {
      const pkg = `${usage.file.split('/')[0]}/${usage.file.split('/')[1]}`;
      byPackage.set(pkg, (byPackage.get(pkg) || 0) + 1);
      byFile.set(usage.file, (byFile.get(usage.file) || 0) + 1);
    }

    const output = {
      ...result,
      statistics: {
        byPackage: Object.fromEntries(Array.from(byPackage.entries()).sort((a, b) => b[1] - a[1])),
        topFiles: Object.fromEntries(
          Array.from(byFile.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20),
        ),
      },
    };

    console.log(JSON.stringify(output, null, 2));
    return;
  }

  console.log('='.repeat(80));
  console.log('📊 Any Types Audit Report');
  console.log('='.repeat(80));
  console.log();

  console.log('📈 Summary:');
  console.log(`  Total \`any\` types found: ${result.summary.total}`);
  console.log(`  🟢 Legitimate: ${result.summary.legitimate} (test mocks, third-party types)`);
  console.log(`  🔴 Avoidable: ${result.summary.avoidable} (MUST FIX)`);
  console.log(`  ⚠️  Unknown: ${result.summary.unknown} (needs review)`);
  console.log();

  // Add breakdown by package
  if (result.avoidable.length > 0) {
    const byPackage = new Map<string, number>();
    for (const usage of result.avoidable) {
      const pkg = `${usage.file.split('/')[0]}/${usage.file.split('/')[1]}`;
      byPackage.set(pkg, (byPackage.get(pkg) || 0) + 1);
    }

    console.log('📦 By Package:');
    Array.from(byPackage.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([pkg, count]) => {
        console.log(`  ${pkg}: ${count}`);
      });
    console.log();
  }

  if (result.avoidable.length > 0) {
    console.log('🔴 AVOIDABLE (MUST FIX):');
    console.log('-'.repeat(80));

    // Group by file
    const byFile = new Map<string, AnyUsage[]>();
    for (const usage of result.avoidable) {
      if (!byFile.has(usage.file)) {
        byFile.set(usage.file, []);
      }
      byFile.get(usage.file)?.push(usage);
    }

    // Show first 20 files
    const files = Array.from(byFile.entries()).slice(0, 20);
    for (const [file, usages] of files) {
      console.log(`  ${file}:`);
      usages.slice(0, 5).forEach((usage) => {
        console.log(`    Line ${usage.line}:${usage.column} - ${usage.code.substring(0, 60)}`);
      });
      if (usages.length > 5) {
        console.log(`    ... and ${usages.length - 5} more in this file`);
      }
      console.log();
    }

    if (byFile.size > 20) {
      console.log(`  ... and ${byFile.size - 20} more files`);
      console.log();
    }
  }

  if (result.legitimate.length > 0) {
    console.log('🟢 LEGITIMATE (OK):');
    console.log(`  ${result.legitimate.length} \`any\` types in legitimate contexts`);
    console.log();
  }

  if (result.unknown.length > 0) {
    console.log('⚠️  UNKNOWN CATEGORY:');
    result.unknown.slice(0, 10).forEach((usage) => {
      console.log(`  ${usage.file}:${usage.line}`);
    });
    if (result.unknown.length > 10) {
      console.log(`  ... and ${result.unknown.length - 10} more`);
    }
    console.log();
  }

  console.log('='.repeat(80));
  console.log();

  if (result.summary.avoidable > 0) {
    console.log('❌ ACTION REQUIRED:');
    console.log(`   Found ${result.summary.avoidable} avoidable \`any\` types.`);
    console.log('   These should be replaced with proper types, type guards, or unknown.');
    console.log();
    process.exit(ErrorCode.EXECUTION_ERROR);
  } else {
    console.log('✅ No avoidable `any` types found!');
    console.log();
    process.exit(ErrorCode.SUCCESS);
  }
}

// Main
const outputJson = process.argv.includes('--json');
const result = auditAnyTypes();
printReport(result, outputJson);
