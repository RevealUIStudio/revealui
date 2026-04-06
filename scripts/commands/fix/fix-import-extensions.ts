#!/usr/bin/env tsx
/**
 * Fix Import Extensions Script
 *
 * This script finds all TypeScript files and adds .js extensions to relative imports
 * that are missing them. This is required for Node.js ESM compatibility.
 *
 * @dependencies
 * - scripts/lib/errors.ts - ErrorCode enum for exit codes
 * - node:fs - File system operations for reading/writing files
 * - node:path - Path manipulation utilities
 * - fast-glob - File pattern matching for TypeScript files
 *
 * Usage:
 *   pnpm tsx scripts/analyze/fix-import-extensions.ts [--dry-run] [--path <glob>]
 *
 * Options:
 *   --dry-run    Show what would be changed without making changes
 *   --path       Glob pattern to filter files (default: all .ts/.tsx files in packages and apps)
 */

import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { ErrorCode } from '@revealui/scripts/errors.js';
import fg from 'fast-glob';

interface ImportMatch {
  full: string;
  quote: string;
  specifier: string;
  start: number;
  end: number;
}

interface FileChange {
  file: string;
  imports: Array<{
    original: string;
    fixed: string;
  }>;
}

const _IMPORT_REGEX =
  /(?:import|export)\s+(?:(?:type\s+)?(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+))*\s+from\s+)?(['"])([^'"]+)\1|(?:import|export)\s*\(\s*(['"])([^'"]+)\3\s*\)/g;

const _DYNAMIC_IMPORT_REGEX = /(?:import|require)\s*\(\s*(['"])([^'"]+)\1\s*\)/g;

function isRelativeImport(specifier: string): boolean {
  return specifier.startsWith('./') || specifier.startsWith('../');
}

function hasExtension(specifier: string): boolean {
  const ext = extname(specifier);
  return [
    '.js',
    '.mjs',
    '.cjs',
    '.json',
    '.css',
    '.scss',
    '.svg',
    '.png',
    '.jpg',
    '.woff',
    '.woff2',
  ].includes(ext);
}

function shouldSkipFile(specifier: string): boolean {
  // Skip if already has extension, is a package import, or is a special import
  if (!isRelativeImport(specifier)) return true;
  if (hasExtension(specifier)) return true;
  return false;
}

function resolveTargetFile(fromFile: string, specifier: string): string | null {
  const dir = dirname(fromFile);
  const targetBase = join(dir, specifier);

  // Check in order of preference
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs'];

  // First check if it's a directory with an index file
  if (existsSync(targetBase) && statSync(targetBase).isDirectory()) {
    for (const ext of extensions) {
      const indexPath = join(targetBase, `index${ext}`);
      if (existsSync(indexPath)) {
        return `${specifier}/index.js`;
      }
    }
  }

  // Then check for direct file matches
  for (const ext of extensions) {
    const filePath = `${targetBase}${ext}`;
    if (existsSync(filePath)) {
      return `${specifier}.js`;
    }
  }

  return null;
}

function findImports(content: string): ImportMatch[] {
  const matches: ImportMatch[] = [];

  // Match static imports/exports including "export * from"
  const staticRegex =
    /(?:import|export)\s+(?:(?:type\s+)?(?:\{[^}]*\}|\*\s+as\s+\w+|\*|\w+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+))*\s+from\s+)?(['"])([^'"]+)\1/g;

  // biome-ignore lint/suspicious/noImplicitAnyLet: RegExp.exec() result type is known from usage pattern
  let match;
  // biome-ignore lint/suspicious/noAssignInExpressions: Standard pattern for regex iteration
  while ((match = staticRegex.exec(content)) !== null) {
    matches.push({
      full: match[0],
      quote: match[1],
      specifier: match[2],
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  // Match dynamic imports
  const dynamicRegex = /\bimport\s*\(\s*(['"])([^'"]+)\1\s*\)/g;
  // biome-ignore lint/suspicious/noAssignInExpressions: Standard pattern for regex iteration
  while ((match = dynamicRegex.exec(content)) !== null) {
    matches.push({
      full: match[0],
      quote: match[1],
      specifier: match[2],
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  // Match require calls (for mixed codebases)
  const requireRegex = /\brequire\s*\(\s*(['"])([^'"]+)\1\s*\)/g;
  // biome-ignore lint/suspicious/noAssignInExpressions: Standard pattern for regex iteration
  while ((match = requireRegex.exec(content)) !== null) {
    matches.push({
      full: match[0],
      quote: match[1],
      specifier: match[2],
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  return matches;
}

function fixFileImports(filePath: string, dryRun: boolean): FileChange | null {
  const content = readFileSync(filePath, 'utf-8');
  const imports = findImports(content);

  const changes: FileChange['imports'] = [];
  let newContent = content;

  // Process imports in reverse order to maintain correct positions
  const importsToFix = imports
    .filter((imp) => !shouldSkipFile(imp.specifier))
    .map((imp) => {
      const fixedSpecifier = resolveTargetFile(filePath, imp.specifier);
      if (fixedSpecifier && fixedSpecifier !== imp.specifier) {
        return { ...imp, fixedSpecifier };
      }
      return null;
    })
    .filter((x): x is ImportMatch & { fixedSpecifier: string } => x !== null)
    .sort((a, b) => b.start - a.start); // Reverse order for safe replacement

  for (const imp of importsToFix) {
    const fixedFull = imp.full.replace(
      `${imp.quote}${imp.specifier}${imp.quote}`,
      `${imp.quote}${imp.fixedSpecifier}${imp.quote}`,
    );

    changes.push({
      original: imp.specifier,
      fixed: imp.fixedSpecifier,
    });

    newContent = newContent.slice(0, imp.start) + fixedFull + newContent.slice(imp.end);
  }

  if (changes.length === 0) {
    return null;
  }

  if (!dryRun) {
    writeFileSync(filePath, newContent, 'utf-8');
  }

  return { file: filePath, imports: changes };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const pathIndex = args.indexOf('--path');
  const customPath = pathIndex !== -1 ? args[pathIndex + 1] : null;

  const patterns = customPath
    ? [customPath]
    : [
        'packages/*/src/**/*.{ts,tsx}',
        'apps/*/src/**/*.{ts,tsx}',
        '!**/*.d.ts',
        '!**/node_modules/**',
        '!**/dist/**',
      ];

  console.log(`\n🔍 Scanning for TypeScript files...`);
  console.log(
    `   Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE (files will be modified)'}`,
  );

  const files = await fg(patterns, {
    cwd: process.cwd(),
    absolute: true,
    ignore: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/coverage/**', '**/opensrc/**'],
  });

  console.log(`   Found ${files.length} files to process\n`);

  const allChanges: FileChange[] = [];
  let processedCount = 0;

  for (const file of files) {
    const change = fixFileImports(file, dryRun);
    if (change) {
      allChanges.push(change);
    }
    processedCount++;

    if (processedCount % 100 === 0) {
      process.stdout.write(`   Processed ${processedCount}/${files.length} files...\r`);
    }
  }

  console.log(`\n\n📊 Results:`);
  console.log(`   Files scanned: ${files.length}`);
  console.log(`   Files with fixes: ${allChanges.length}`);

  if (allChanges.length > 0) {
    const totalImports = allChanges.reduce((sum, c) => sum + c.imports.length, 0);
    console.log(`   Total imports fixed: ${totalImports}\n`);

    if (dryRun) {
      console.log(`📝 Changes that would be made:\n`);
    } else {
      console.log(`✅ Changes made:\n`);
    }

    for (const change of allChanges.slice(0, 20)) {
      const relativePath = change.file.replace(`${process.cwd()}/`, '');
      console.log(`   ${relativePath}`);
      for (const imp of change.imports) {
        console.log(`      ${imp.original} → ${imp.fixed}`);
      }
    }

    if (allChanges.length > 20) {
      console.log(`\n   ... and ${allChanges.length - 20} more files`);
    }

    if (dryRun) {
      console.log(`\n💡 Run without --dry-run to apply these changes`);
    }
  } else {
    console.log(`\n✨ All imports already have correct extensions!`);
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(ErrorCode.EXECUTION_ERROR);
});
