#!/usr/bin/env tsx
/**
 * Audit Console Statement Usage
 *
 * Scans the codebase for console.* usage and categorizes them:
 * - Production code (needs migration to logger)
 * - Test files (allowed)
 * - Config files (allowed)
 * - Scripts (allowed)
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const PROJECT_ROOT = process.cwd();

// Directories to exclude from scanning
const DEFAULT_EXCLUDE_DIRS = [
  'node_modules',
  'dist',
  'build',
  '.next',
  '.turbo',
  'coverage',
  '.git',
  'playwright-report',
  'test-results',
  'public',
  'static',
  'opensrc',
];

// Console methods to detect
const CONSOLE_METHODS = [
  'console.log',
  'console.error',
  'console.warn',
  'console.info',
  'console.debug',
  'console.trace',
  'console.dir',
  'console.table',
  'console.time',
  'console.timeEnd',
  'console.group',
  'console.groupEnd',
];

interface ConsoleUsage {
  file: string;
  line: number;
  column: number;
  method: string;
  code: string;
  category: 'production' | 'test' | 'script' | 'config';
}

interface AuditResult {
  total: number;
  byCategory: {
    production: number;
    test: number;
    script: number;
    config: number;
  };
  production: ConsoleUsage[];
  test: ConsoleUsage[];
  script: ConsoleUsage[];
  config: ConsoleUsage[];
}

/**
 * Scan directory recursively for TypeScript/JavaScript files
 */
function scanDirectorySync(
  dir: string,
  extensions: string[] = ['.ts', '.tsx', '.js', '.jsx'],
): string[] {
  const files: string[] = [];

  function scan(currentDir: string, depth: number): void {
    if (depth > 50) return;

    try {
      const entries = readdirSync(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;

        const fullPath = join(currentDir, entry.name);

        if (entry.isDirectory()) {
          if (DEFAULT_EXCLUDE_DIRS.includes(entry.name)) continue;
          scan(fullPath, depth + 1);
        } else if (entry.isFile()) {
          const ext = entry.name.substring(entry.name.lastIndexOf('.'));
          if (extensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch {
      // Ignore permission errors
    }
  }

  scan(dir, 0);
  return files;
}

/**
 * Categorize a file based on its path
 */
function categorizeFile(filePath: string): ConsoleUsage['category'] {
  const relativePath = filePath.replace(`${PROJECT_ROOT}/`, '');

  // Test files
  if (
    relativePath.includes('__tests__') ||
    relativePath.includes('__mocks__') ||
    relativePath.includes('.test.') ||
    relativePath.includes('.spec.') ||
    relativePath.match(/\/test\//) ||
    relativePath.match(/\/tests\//) ||
    relativePath.match(/\/test-/) ||
    relativePath.startsWith('test-') ||
    relativePath.includes('-test.')
  ) {
    return 'test';
  }

  // Script files (including examples, e2e setup, CMS scripts)
  if (
    relativePath.startsWith('scripts/') ||
    relativePath.startsWith('examples/') ||
    relativePath.match(/\/scripts\//) ||
    relativePath.match(/\/examples\//) ||
    relativePath.includes('-example.') ||
    relativePath.includes('example-') ||
    relativePath.includes('/examples.') ||
    relativePath.includes('global-setup') ||
    relativePath.includes('global-teardown') ||
    relativePath.includes('populate-examples') ||
    relativePath.endsWith('.e2e.ts')
  ) {
    return 'script';
  }

  // Config files
  if (
    relativePath.includes('vitest.config') ||
    relativePath.includes('vite.config') ||
    relativePath.includes('tailwind.config') ||
    relativePath.includes('postcss.config') ||
    relativePath.includes('tsconfig') ||
    relativePath.endsWith('config.ts') ||
    relativePath.endsWith('config.js')
  ) {
    return 'config';
  }

  // Logger infrastructure files (allowed to use console as fallback)
  if (
    relativePath.includes('/logger.ts') ||
    relativePath.includes('/logger-client.ts') ||
    relativePath.includes('/logger-server.ts') ||
    relativePath.includes('/src/logger/') ||
    relativePath.includes('/observability/logger') ||
    relativePath.includes('/utils/logger')
  ) {
    return 'config';
  }

  // Everything else is production code
  return 'production';
}

/**
 * Check if a line is a comment
 */
function isComment(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*');
}

/**
 * Check if console usage is in a string literal
 */
function isInStringLiteral(line: string, index: number): boolean {
  const before = line.substring(0, index);
  const singleQuotes = (before.match(/'/g) || []).length;
  const doubleQuotes = (before.match(/"/g) || []).length;
  const backticks = (before.match(/`/g) || []).length;

  return singleQuotes % 2 !== 0 || doubleQuotes % 2 !== 0 || backticks % 2 !== 0;
}

/**
 * Scan a file for console usage
 */
function scanFile(filePath: string): ConsoleUsage[] {
  const usages: ConsoleUsage[] = [];
  const category = categorizeFile(filePath);
  const relativePath = filePath.replace(`${PROJECT_ROOT}/`, '');

  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Skip comments
      if (isComment(line)) continue;

      // Check for each console method
      for (const method of CONSOLE_METHODS) {
        let searchFrom = 0;
        let index = line.indexOf(method, searchFrom);

        while (index !== -1) {
          // Skip if in string literal
          if (!isInStringLiteral(line, index)) {
            usages.push({
              file: relativePath,
              line: i + 1,
              column: index + 1,
              method,
              code: line.trim(),
              category,
            });
          }

          searchFrom = index + method.length;
          index = line.indexOf(method, searchFrom);
        }
      }
    }
  } catch {
    // Ignore file read errors
  }

  return usages;
}

/**
 * Main audit function
 */
function auditConsoleUsage(): AuditResult {
  console.error('🔍 Scanning for console.* usage...\n');

  // Scan all TypeScript/JavaScript files
  const files = scanDirectorySync(PROJECT_ROOT);
  console.error(`📁 Scanning ${files.length} files...\n`);

  const allUsages: ConsoleUsage[] = [];

  for (const file of files) {
    const usages = scanFile(file);
    allUsages.push(...usages);
  }

  // Categorize results
  const production = allUsages.filter((u) => u.category === 'production');
  const test = allUsages.filter((u) => u.category === 'test');
  const script = allUsages.filter((u) => u.category === 'script');
  const config = allUsages.filter((u) => u.category === 'config');

  return {
    total: allUsages.length,
    byCategory: {
      production: production.length,
      test: test.length,
      script: script.length,
      config: config.length,
    },
    production,
    test,
    script,
    config,
  };
}

/**
 * Print report
 */
function printReport(result: AuditResult): void {
  console.log('📊 Console Statement Audit Results');
  console.log('='.repeat(80));
  console.log();

  console.log(`Total console statements: ${result.total}`);
  console.log();

  console.log('By Category:');
  console.log(`  🔴 Production code: ${result.byCategory.production} (NEEDS MIGRATION)`);
  console.log(`  ✅ Test files: ${result.byCategory.test} (allowed)`);
  console.log(`  ✅ Scripts: ${result.byCategory.script} (allowed)`);
  console.log(`  ✅ Config files: ${result.byCategory.config} (allowed)`);
  console.log();

  if (result.production.length > 0) {
    // Group by package
    const byPackage = new Map<string, number>();
    const byMethod = new Map<string, number>();
    const byFile = new Map<string, number>();

    for (const usage of result.production) {
      const pkg = `${usage.file.split('/')[0]}/${usage.file.split('/')[1]}`;
      byPackage.set(pkg, (byPackage.get(pkg) || 0) + 1);
      byMethod.set(usage.method, (byMethod.get(usage.method) || 0) + 1);
      byFile.set(usage.file, (byFile.get(usage.file) || 0) + 1);
    }

    console.log('📦 Production Code by Package:');
    Array.from(byPackage.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([pkg, count]) => {
        console.log(`  ${pkg}: ${count}`);
      });
    console.log();

    console.log('🔧 By Console Method:');
    Array.from(byMethod.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([method, count]) => {
        console.log(`  ${method}: ${count}`);
      });
    console.log();

    console.log('📄 Top Files (Production):');
    Array.from(byFile.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .forEach(([file, count]) => {
        console.log(`  ${file}: ${count}`);
      });
    console.log();

    console.log('🔴 PRODUCTION CODE SAMPLES (first 10):');
    console.log('-'.repeat(80));
    result.production.slice(0, 10).forEach((usage) => {
      console.log(`  ${usage.file}:`);
      console.log(`    Line ${usage.line}:${usage.column} - ${usage.code}`);
    });

    if (result.production.length > 10) {
      console.log(`  ... and ${result.production.length - 10} more`);
    }
  }
}

/**
 * Main execution
 */
function main(): void {
  const outputJson = process.argv.includes('--json');

  const result = auditConsoleUsage();

  if (outputJson) {
    const byPackage = new Map<string, number>();
    const byFile = new Map<string, number>();

    for (const usage of result.production) {
      const pkg = `${usage.file.split('/')[0]}/${usage.file.split('/')[1]}`;
      byPackage.set(pkg, (byPackage.get(pkg) || 0) + 1);
      byFile.set(usage.file, (byFile.get(usage.file) || 0) + 1);
    }

    const output = {
      ...result,
      statistics: {
        byPackage: Object.fromEntries(Array.from(byPackage.entries()).sort((a, b) => b[1] - a[1])),
        byFile: Object.fromEntries(
          Array.from(byFile.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 50),
        ),
      },
    };

    console.log(JSON.stringify(output, null, 2));
  } else {
    printReport(result);
  }

  // Exit with error code if production code has console statements
  if (result.byCategory.production > 0) {
    process.exit(1);
  }
}

main();
