#!/usr/bin/env tsx

/**
 * Verification script for dev package imports
 *
 * Ensures all config files use correct `dev/...` import paths using AST parsing
 * and don't use relative paths or incorrect package names
 *
 * @dependencies
 * - scripts/lib/errors.ts - ErrorCode enum for exit codes
 * - typescript - TypeScript compiler API for AST parsing
 * - node:fs - File system operations (readFileSync)
 * - node:fs/promises - Async file operations (readdir, stat)
 * - node:path - Path manipulation utilities
 * - node:url - URL utilities (fileURLToPath)
 */

import { readFileSync } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ErrorCode } from '@revealui/scripts/errors.js';
import * as ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

interface Issue {
  file: string;
  line: number;
  message: string;
  severity: 'error' | 'warning';
}

const issues: Issue[] = [];

/**
 * Check if import source matches bad patterns
 */
function checkImportSource(
  source: string,
  sourceFile: ts.SourceFile,
  importNode: ts.ImportDeclaration,
): Issue[] {
  const foundIssues: Issue[] = [];
  const { line } = sourceFile.getLineAndCharacterOfPosition(importNode.getStart());

  // Bad pattern: relative path to packages/dev/src
  if (source.includes('../packages/dev/src') || source.includes('../../packages/dev/src')) {
    foundIssues.push({
      file: path.relative(projectRoot, sourceFile.fileName),
      line: line + 1,
      message: 'Uses relative path to packages/dev/src instead of dev/...',
      severity: 'error',
    });
  }

  // Bad pattern: relative path to dev/src
  if (source.includes('../dev/src') || source.includes('../../dev/src')) {
    foundIssues.push({
      file: path.relative(projectRoot, sourceFile.fileName),
      line: line + 1,
      message: 'Uses relative path to dev/src instead of dev/...',
      severity: 'error',
    });
  }

  // Bad pattern: @revealui/dev (should be just dev)
  if (source.startsWith('@revealui/dev/')) {
    foundIssues.push({
      file: path.relative(projectRoot, sourceFile.fileName),
      line: line + 1,
      message: 'Uses @revealui/dev instead of dev (only in historical docs is OK)',
      severity: 'error',
    });
  }

  return foundIssues;
}

/**
 * Check if import source matches good patterns
 */
function hasGoodImport(source: string): boolean {
  return source.startsWith('dev/');
}

/**
 * Analyze file using AST
 */
function analyzeFileAST(filePath: string): {
  hasGoodImport: boolean;
  issues: Issue[];
} {
  const foundIssues: Issue[] = [];
  let hasGood = false;

  try {
    const content = readFileSync(filePath, 'utf-8');

    const ext = filePath.split('.').pop()?.toLowerCase();
    const scriptKind =
      ext === 'tsx' || ext === 'jsx'
        ? ts.ScriptKind.TSX
        : ext === 'ts' || ext === 'js' || ext === 'mjs'
          ? ts.ScriptKind.TS
          : ts.ScriptKind.Unknown;

    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true,
      scriptKind,
    );

    // Check all import declarations
    ts.forEachChild(sourceFile, (node) => {
      if (ts.isImportDeclaration(node)) {
        const moduleSpecifier = node.moduleSpecifier;

        if (ts.isStringLiteral(moduleSpecifier)) {
          const source = moduleSpecifier.text;

          // Check for bad patterns
          const badIssues = checkImportSource(source, sourceFile, node);
          foundIssues.push(...badIssues);

          // Check for good patterns
          if (hasGoodImport(source)) {
            hasGood = true;
          }
        }
      }
    });
  } catch (_error) {
    // Skip files that can't be parsed
  }

  return { hasGoodImport: hasGood, issues: foundIssues };
}

async function findConfigFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    // Skip node_modules and other ignored directories
    if (
      entry.name === 'node_modules' ||
      entry.name === 'dist' ||
      entry.name === '.next' ||
      entry.name === '.turbo' ||
      entry.name.startsWith('.')
    ) {
      continue;
    }

    // Skip generated files (timestamp files, etc.)
    if (entry.name.includes('.timestamp-') || entry.name.includes('.temp.')) {
      continue;
    }

    if (entry.isDirectory()) {
      const subFiles = await findConfigFiles(fullPath);
      files.push(...subFiles);
    } else if (
      entry.isFile() &&
      (entry.name.includes('tailwind') ||
        entry.name.includes('postcss') ||
        entry.name.includes('vite')) &&
      (entry.name.endsWith('.ts') || entry.name.endsWith('.js') || entry.name.endsWith('.mjs'))
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

function checkFile(filePath: string): void {
  const relativePath = path.relative(projectRoot, filePath);

  // Skip markdown files (historical docs are OK)
  if (filePath.endsWith('.md')) {
    return;
  }

  const { hasGoodImport, issues: fileIssues } = analyzeFileAST(filePath);
  issues.push(...fileIssues);

  // Warn if config file doesn't use dev/... imports (might be legitimate for some configs)
  // Skip warnings for:
  // - Dev package itself
  // - Test files
  // - Generated/temporary files
  // - Files that aren't the main config files (e.g., vitest.config.ts doesn't need dev imports)
  if (
    !hasGoodImport &&
    (filePath.includes('tailwind.config') ||
      filePath.includes('postcss.config') ||
      filePath.includes('vite.config')) &&
    !relativePath.startsWith('packages/dev/') &&
    !relativePath.includes('__tests__') &&
    !relativePath.includes('.timestamp-') &&
    !relativePath.includes('.temp.') &&
    // Only check specific app/package configs that should use dev imports
    (relativePath.startsWith('apps/mainframe/') ||
      relativePath.startsWith('apps/admin/') ||
      relativePath.startsWith('packages/services/'))
  ) {
    issues.push({
      file: relativePath,
      line: 1,
      message: 'Config file does not appear to use dev/... imports (may be legitimate)',
      severity: 'warning',
    });
  }
}

async function main(): Promise<void> {
  console.log('🔍 Verifying dev package imports...\n');

  const appsDir = path.join(projectRoot, 'apps');
  const packagesDir = path.join(projectRoot, 'packages');

  const files: string[] = [];
  if (
    await stat(appsDir)
      .then(() => true)
      .catch(() => false)
  ) {
    const appFiles = await findConfigFiles(appsDir);
    files.push(...appFiles);
  }
  if (
    await stat(packagesDir)
      .then(() => true)
      .catch(() => false)
  ) {
    const packageFiles = await findConfigFiles(packagesDir);
    files.push(...packageFiles);
  }

  console.log(`Found ${files.length} config files to check\n`);

  for (const file of files) {
    checkFile(file);
  }

  // Report results
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');

  if (errors.length === 0 && warnings.length === 0) {
    console.log('✅ All imports are correct!\n');
    process.exit(ErrorCode.SUCCESS);
  }

  if (errors.length > 0) {
    console.error(`❌ Found ${errors.length} error(s):\n`);
    errors.forEach((issue) => {
      console.error(`  ${issue.file}:${issue.line}`);
      console.error(`    ${issue.message}\n`);
    });
  }

  if (warnings.length > 0) {
    console.warn(`⚠️  Found ${warnings.length} warning(s):\n`);
    warnings.forEach((issue) => {
      console.warn(`  ${issue.file}:${issue.line}`);
      console.warn(`    ${issue.message}\n`);
    });
  }

  process.exit(errors.length > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('Error running verification:', error);
  process.exit(ErrorCode.EXECUTION_ERROR);
});
