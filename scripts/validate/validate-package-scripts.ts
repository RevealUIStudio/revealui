#!/usr/bin/env tsx

/**
 * Validates package.json scripts and code files to ensure they use pnpm dlx instead of npx
 * This prevents npm deprecation warnings and enforces pnpm usage
 *
 * Checks:
 * - package.json scripts
 * - TypeScript/JavaScript files (spawn, exec, shell commands)
 * - Shell scripts (.sh, .ps1)
 * - Template literals, variables, and various quote styles
 *
 * Usage:
 *   pnpm validate:package-scripts
 *
 * @dependencies
 * - scripts/lib/errors.ts - ErrorCode enum for exit codes
 * - scripts/lib/index.ts - Shared utilities (createLogger, getProjectRoot)
 * - node:fs - File system operations (readdirSync, readFileSync, statSync)
 * - node:path - Path manipulation utilities (join)
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ErrorCode } from '@revealui/scripts/errors.js';
import { createLogger, getProjectRoot } from '@revealui/scripts/index.js';

const logger = createLogger();

interface PackageJson {
  scripts?: Record<string, string>;
}

interface Violation {
  file: string;
  lineNumber?: number;
  script?: string;
  line: string;
  context?: string[];
  suggestion: string;
}

const errors: Violation[] = [];
const warnings: Violation[] = [];

// String-based checks to detect npx usage (replaces regex patterns)
const NPX_CHECKS: Array<(line: string) => boolean> = [
  // Direct spawn/exec calls: spawn('npx', spawn("npx", spawn(`npx`
  (line) =>
    line.includes("spawn('npx'") ||
    line.includes('spawn("npx"') ||
    line.includes('spawn(`npx`') ||
    line.includes("exec('npx") ||
    line.includes('exec("npx') ||
    line.includes('exec(`npx'),
  // Variable assignments: const cmd = 'npx'
  (line) => line.includes("= 'npx'") || line.includes('= "npx"') || line.includes('= `npx`'),
  // Shell command patterns: npx followed by space
  (line) => line.includes('npx '),
  // Quoted npx with trailing space: 'npx  or "npx
  (line) => line.includes("'npx ") || line.includes('"npx ') || line.includes('`npx '),
];

// Files/directories to skip
const SKIP_DIRS = [
  'node_modules',
  'dist',
  '.next',
  'build',
  '.turbo',
  '.git',
  'coverage',
  '.vercel',
];

// Files to skip (validation script itself, test files we create)
const SKIP_FILES = ['validate-package-scripts.ts'];

function findFiles(dir: string, extensions: string[], fileList: string[] = []): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const filePath = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!SKIP_DIRS.includes(entry.name)) {
        findFiles(filePath, extensions, fileList);
      }
    } else {
      const ext = entry.name.split('.').pop()?.toLowerCase();
      if (ext && extensions.includes(ext)) {
        // Skip validation script itself
        if (SKIP_FILES.some((skip) => filePath.includes(skip))) {
          continue;
        }
        fileList.push(filePath);
      }
    }
  }

  return fileList;
}

function findPackageJsonFiles(dir: string, fileList: string[] = []): string[] {
  return findFiles(dir, ['json'], fileList).filter((f) => f.endsWith('package.json'));
}

function checkScript(scriptValue: string, file: string, scriptName: string) {
  // Allow npx in preinstall scripts (they run before pnpm installs)
  if (scriptName === 'preinstall' && scriptValue.includes('npx only-allow')) {
    return;
  }

  // Check for npx usage in script value
  if (scriptValue.includes('npx ') && !scriptValue.includes('pnpm dlx')) {
    let suggestion = scriptValue.replace('npx ', 'pnpm dlx ');
    // Remove -y flag (not needed with pnpm dlx)
    suggestion = suggestion.replace(' -y ', ' ');
    errors.push({
      file,
      script: scriptName,
      line: scriptValue,
      suggestion,
    });
  }
}

function validatePackageJson(filePath: string) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const pkg: PackageJson = JSON.parse(content);

    if (pkg.scripts) {
      for (const [scriptName, scriptValue] of Object.entries(pkg.scripts)) {
        checkScript(scriptValue, filePath, scriptName);
      }
    }
  } catch (error) {
    logger.error(
      `Error reading ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function checkCodeFile(filePath: string) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Skip comment lines
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('#')) {
        continue;
      }

      // Skip lines that are checking for npx (like in this validation script)
      if (trimmed.includes('npx') && trimmed.includes('includes')) {
        continue;
      }

      // Skip if it's in a documentation string (error messages, comments in strings)
      // These are user-facing instructions and acceptable
      if (
        (line.includes('Please run') || line.includes('Run `npx')) &&
        (line.includes('after setting up') || line.includes('for instructions'))
      ) {
        continue;
      }

      // Check all patterns
      for (const check of NPX_CHECKS) {
        if (check(line) && !line.includes('pnpm dlx')) {
          // Get context (2 lines before and after)
          const context = [];
          for (let j = Math.max(0, i - 2); j <= Math.min(lines.length - 1, i + 2); j++) {
            if (j !== i) {
              context.push(`  ${j + 1}: ${lines[j]}`);
            } else {
              context.push(`> ${j + 1}: ${lines[j]}`);
            }
          }

          // Generate suggestion
          let suggestion: string;
          // Handle spawn('npx', ['args']) -> spawn('pnpm', ['dlx', ...args])
          if (line.includes("spawn('npx',")) {
            suggestion = line.replace("spawn('npx',", "spawn('pnpm', ['dlx',");
          } else if (line.includes('spawn("npx",')) {
            suggestion = line.replace('spawn("npx",', 'spawn("pnpm", ["dlx",');
          } else if (line.includes('spawn(`npx`,')) {
            suggestion = line.replace('spawn(`npx`,', 'spawn(`pnpm`, [`dlx`,');
          }
          // Handle exec('npx ...') -> exec('pnpm dlx ...')
          else if (line.includes("exec('npx")) {
            suggestion = line.replace("exec('npx", "exec('pnpm dlx");
          } else if (line.includes('exec("npx')) {
            suggestion = line.replace('exec("npx', 'exec("pnpm dlx');
          } else if (line.includes('exec(`npx')) {
            suggestion = line.replace('exec(`npx', 'exec(`pnpm dlx');
          }
          // Handle const cmd = 'npx' or "npx" or `npx` (variable assignment)
          else if (line.includes("'npx'")) {
            suggestion = line.replace("'npx'", "'pnpm dlx'");
          } else if (line.includes('"npx"')) {
            suggestion = line.replace('"npx"', '"pnpm dlx"');
          } else if (line.includes('`npx`')) {
            suggestion = line.replace('`npx`', '`pnpm dlx`');
          }
          // Handle general "npx " usage
          else if (line.includes('npx ')) {
            suggestion = line.replace('npx ', 'pnpm dlx ');
          } else {
            // Fallback: replace "npx" with "pnpm dlx"
            suggestion = line.replace('npx', 'pnpm dlx');
          }

          errors.push({
            file: filePath,
            lineNumber: i + 1,
            line: trimmed,
            context,
            suggestion: suggestion.trim(),
          });

          // Only report first match per line
          break;
        }
      }
    }
  } catch (_error) {
    // Ignore read errors
  }
}

function checkShellScript(filePath: string) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Skip comment lines
      if (trimmed.startsWith('#') || trimmed.startsWith('*')) {
        continue;
      }

      // Check for npx usage
      if (line.includes('npx ') && !line.includes('pnpm dlx')) {
        // Allow in preinstall checks
        if (line.includes('preinstall') && line.includes('only-allow')) {
          continue;
        }

        const context = [];
        for (let j = Math.max(0, i - 2); j <= Math.min(lines.length - 1, i + 2); j++) {
          if (j !== i) {
            context.push(`  ${j + 1}: ${lines[j]}`);
          } else {
            context.push(`> ${j + 1}: ${lines[j]}`);
          }
        }

        errors.push({
          file: filePath,
          lineNumber: i + 1,
          line: trimmed,
          context,
          suggestion: line.replace('npx ', 'pnpm dlx ').trim(),
        });
      }
    }
  } catch (_error) {
    // Ignore read errors
  }
}

async function runValidation() {
  try {
    await getProjectRoot(import.meta.url);
    const rootDir = process.cwd();

    logger.header('Comprehensive Validation of pnpm dlx Usage');

    // 1. Check all package.json files
    logger.info('📦 Checking package.json files...');
    const packageJsonFiles = findPackageJsonFiles(rootDir);
    for (const file of packageJsonFiles) {
      validatePackageJson(file);
    }

    // 2. Check TypeScript/JavaScript files
    logger.info('📝 Checking TypeScript/JavaScript files...');
    const codeFiles = findFiles(rootDir, ['ts', 'js', 'tsx', 'jsx']);
    for (const file of codeFiles) {
      checkCodeFile(file);
    }

    // 3. Check shell scripts
    logger.info('🐚 Checking shell scripts...');
    const shellFiles = findFiles(rootDir, ['sh', 'ps1', 'bash']);
    for (const file of shellFiles) {
      checkShellScript(file);
    }

    // Report results
    logger.info(`\n${'='.repeat(60)}\n`);

    if (errors.length === 0 && warnings.length === 0) {
      logger.success('All files use pnpm dlx correctly!');
      logger.info(`   Checked: ${packageJsonFiles.length} package.json files`);
      logger.info(`   Checked: ${codeFiles.length} code files`);
      logger.info(`   Checked: ${shellFiles.length} shell scripts\n`);
      process.exit(ErrorCode.SUCCESS);
    }

    if (errors.length > 0) {
      logger.error(`Found ${errors.length} violation(s) using npx instead of pnpm dlx:\n`);

      // Group by file
      const byFile = new Map<string, Violation[]>();
      for (const error of errors) {
        if (!byFile.has(error.file)) {
          byFile.set(error.file, []);
        }
        byFile.get(error.file)?.push(error);
      }

      for (const [file, violations] of byFile.entries()) {
        logger.error(`\n📄 ${file}`);
        for (const violation of violations) {
          if (violation.script) {
            logger.error(`   Script: ${violation.script}`);
          }
          if (violation.lineNumber) {
            logger.error(`   Line ${violation.lineNumber}:`);
          }
          logger.error(`   Found: ${violation.line}`);
          if (violation.context && violation.context.length > 0) {
            logger.error(`   Context:`);
            for (const ctx of violation.context) {
              logger.error(ctx);
            }
          }
          logger.error(`   Fix:   ${violation.suggestion}\n`);
        }
      }
    }

    if (warnings.length > 0) {
      logger.warning(`\n⚠️  ${warnings.length} warning(s):\n`);
      for (const warning of warnings) {
        logger.warning(`  ${warning.file}`);
        if (warning.script) {
          logger.warning(`    Script: ${warning.script}`);
        }
        logger.warning(`    ${warning.suggestion}\n`);
      }
    }

    logger.info('\n💡 Tip: Run this script regularly to catch violations early.');
    process.exit(errors.length > 0 ? 1 : 0);
  } catch (error) {
    logger.error(`Validation failed: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      logger.error(`Stack trace: ${error.stack}`);
    }
    process.exit(ErrorCode.EXECUTION_ERROR);
  }
}

/**
 * Main function
 */
async function main() {
  try {
    await runValidation();
  } catch (error) {
    logger.error(`Script failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(ErrorCode.EXECUTION_ERROR);
  }
}

main();
