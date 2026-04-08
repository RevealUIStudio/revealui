#!/usr/bin/env tsx
/**
 * Package.json Script Auto-Fixer
 *
 * Automatically fixes package.json scripts by adding missing required scripts
 * and optionally correcting incorrect implementations.
 *
 * @dependencies
 * - scripts/lib/errors.ts - ErrorCode enum for exit codes
 * - scripts/lib/paths.ts - Project root resolution
 * - node:fs/promises - File system operations for reading/writing package.json files
 * - node:path - Path manipulation utilities
 *
 * @example
 * ```bash
 * tsx scripts/commands/maintain/fix-scripts.ts --dry-run
 * tsx scripts/commands/maintain/fix-scripts.ts --package @revealui/ai
 * tsx scripts/commands/maintain/fix-scripts.ts --backup
 * ```
 */

import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ErrorCode } from '@revealui/scripts/errors.js';
import { getProjectRoot } from '@revealui/scripts/paths.js';

// =============================================================================
// Types
// =============================================================================

interface FixResult {
  name: string;
  path: string;
  type: 'app' | 'library' | 'tool';
  scriptsAdded: string[];
  scriptsCorrected: string[];
  skipped: boolean;
  error?: string;
}

interface FixReport {
  summary: {
    totalPackages: number;
    fixed: number;
    skipped: number;
    errors: number;
    scriptsAdded: number;
    scriptsCorrected: number;
  };
  results: FixResult[];
}

interface Template {
  scripts: Record<string, string>;
  required: string[];
}

// =============================================================================
// Templates
// =============================================================================

const TEMPLATES: Record<string, Template> = {
  library: {
    scripts: {
      build: 'tsc',
      dev: 'tsc --watch',
      lint: 'biome check .',
      typecheck: 'tsc --noEmit',
      test: 'vitest run',
      'test:watch': 'vitest',
      'test:coverage': 'vitest run --coverage',
      clean: 'rm -rf dist',
    },
    required: ['build', 'dev', 'lint', 'typecheck', 'test', 'clean'],
  },
  app: {
    scripts: {
      // Will be determined by existing build system
      lint: 'biome check .',
      typecheck: 'tsc --noEmit',
      test: 'vitest run',
      'test:watch': 'vitest',
      'test:coverage': 'vitest run --coverage',
      clean: 'rm -rf .next dist .turbo',
    },
    required: ['dev', 'build', 'start', 'lint', 'typecheck', 'test', 'clean'],
  },
  tool: {
    scripts: {
      build: 'tsup',
      dev: 'tsup --watch',
      lint: 'biome check .',
      typecheck: 'tsc --noEmit',
      test: 'vitest run',
      'test:watch': 'vitest',
      'test:coverage': 'vitest run --coverage',
    },
    required: ['build', 'dev', 'lint', 'typecheck', 'test'],
  },
};

// Root package is special - skip auto-fix
const SKIP_PACKAGES = ['reveal-ui'];

// =============================================================================
// Package Discovery
// =============================================================================

const PACKAGE_PATHS = [
  // Apps
  { path: './apps/admin/package.json', type: 'app' as const },
  { path: './apps/docs/package.json', type: 'app' as const },
  { path: './apps/marketing/package.json', type: 'app' as const },
  { path: './apps/mainframe/package.json', type: 'app' as const },

  // Packages - Libraries
  { path: './packages/ai/package.json', type: 'library' as const },
  { path: './packages/auth/package.json', type: 'library' as const },
  { path: './packages/config/package.json', type: 'library' as const },
  { path: './packages/contracts/package.json', type: 'library' as const },
  { path: './packages/core/package.json', type: 'library' as const },
  { path: './packages/db/package.json', type: 'library' as const },
  { path: './packages/dev/package.json', type: 'library' as const },
  { path: './packages/mcp/package.json', type: 'library' as const },
  { path: './packages/presentation/package.json', type: 'library' as const },
  { path: './packages/services/package.json', type: 'library' as const },
  { path: './packages/sync/package.json', type: 'library' as const },
  { path: './packages/test/package.json', type: 'library' as const },

  // Packages - Tools
  { path: './packages/cli/package.json', type: 'tool' as const },
  { path: './packages/setup/package.json', type: 'tool' as const },
  { path: './scripts/lib/package.json', type: 'tool' as const },

  // Infrastructure
  { path: './infrastructure/opencode-server/pulumi-vultr/package.json', type: 'library' as const },
];

// =============================================================================
// Fix Logic
// =============================================================================

/**
 * Detect build tool from existing scripts
 */
function detectBuildTool(
  scripts: Record<string, string>,
): 'next' | 'vite' | 'tsc' | 'tsup' | 'unknown' {
  const buildScript = scripts.build || '';
  const devScript = scripts.dev || '';

  if (buildScript.includes('next') || devScript.includes('next')) return 'next';
  if (buildScript.includes('vite') || devScript.includes('vite')) return 'vite';
  if (buildScript.includes('tsup') || devScript.includes('tsup')) return 'tsup';
  if (buildScript.includes('tsc') || devScript.includes('tsc')) return 'tsc';

  return 'unknown';
}

/**
 * Generate app-specific scripts based on detected framework
 */
function getAppScripts(buildTool: string): Partial<Record<string, string>> {
  switch (buildTool) {
    case 'next':
      return {
        dev: 'next dev',
        build: 'next build',
        start: 'next start',
      };
    case 'vite':
      return {
        dev: 'vite dev',
        build: 'vite build',
        start: 'vite preview',
      };
    default:
      return {};
  }
}

/**
 * Fix scripts for a package
 */
async function fixPackageScripts(
  projectRoot: string,
  packagePath: string,
  type: 'app' | 'library' | 'tool',
  dryRun: boolean,
  backup: boolean,
): Promise<FixResult> {
  try {
    const fullPath = join(projectRoot, packagePath);
    const content = await readFile(fullPath, 'utf-8');
    const pkg = JSON.parse(content);

    // Skip packages in skip list
    if (SKIP_PACKAGES.includes(pkg.name)) {
      return {
        name: pkg.name,
        path: packagePath,
        type,
        scriptsAdded: [],
        scriptsCorrected: [],
        skipped: true,
      };
    }

    const template = TEMPLATES[type];
    const actualScripts = pkg.scripts || {};

    // Detect build tool for apps
    let appScripts: Partial<Record<string, string>> = {};
    if (type === 'app') {
      const buildTool = detectBuildTool(actualScripts);
      appScripts = getAppScripts(buildTool);
    }

    // Find missing scripts
    const scriptsAdded: string[] = [];
    const scriptsCorrected: string[] = [];
    const newScripts = { ...actualScripts };

    for (const scriptName of template.required) {
      if (!actualScripts[scriptName]) {
        // Add missing script
        const scriptCommand =
          appScripts[scriptName] ||
          template.scripts[scriptName] ||
          `echo "TODO: Add ${scriptName} script"`;

        newScripts[scriptName] = scriptCommand;
        scriptsAdded.push(scriptName);
      }
    }

    // If no changes needed
    if (scriptsAdded.length === 0 && scriptsCorrected.length === 0) {
      return {
        name: pkg.name,
        path: packagePath,
        type,
        scriptsAdded: [],
        scriptsCorrected: [],
        skipped: false,
      };
    }

    // Create backup if requested
    if (backup && !dryRun) {
      await copyFile(fullPath, `${fullPath}.backup`);
    }

    // Write updated package.json
    if (!dryRun) {
      pkg.scripts = newScripts;

      // Pretty print with 2-space indentation
      const updatedContent = `${JSON.stringify(pkg, null, 2)}\n`;
      await writeFile(fullPath, updatedContent, 'utf-8');
    }

    return {
      name: pkg.name,
      path: packagePath,
      type,
      scriptsAdded,
      scriptsCorrected,
      skipped: false,
    };
  } catch (error) {
    return {
      name: packagePath,
      path: packagePath,
      type,
      scriptsAdded: [],
      scriptsCorrected: [],
      skipped: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Generate fix report
 */
async function generateFixReport(
  packageFilter?: string,
  dryRun = false,
  backup = false,
): Promise<FixReport> {
  const projectRoot = await getProjectRoot(import.meta.url);

  let packagesToFix = PACKAGE_PATHS;

  // Filter by package if specified
  if (packageFilter) {
    packagesToFix = packagesToFix.filter((p) =>
      p.path.includes(packageFilter.replace('@revealui/', '')),
    );
  }

  // Fix all packages
  const fixResults = await Promise.all(
    packagesToFix.map((p) => fixPackageScripts(projectRoot, p.path, p.type, dryRun, backup)),
  );

  // Calculate summary
  const fixed = fixResults.filter(
    (r) => r.scriptsAdded.length > 0 || r.scriptsCorrected.length > 0,
  ).length;
  const skipped = fixResults.filter((r) => r.skipped).length;
  const errors = fixResults.filter((r) => r.error).length;
  const scriptsAdded = fixResults.reduce((sum, r) => sum + r.scriptsAdded.length, 0);
  const scriptsCorrected = fixResults.reduce((sum, r) => sum + r.scriptsCorrected.length, 0);

  return {
    summary: {
      totalPackages: fixResults.length,
      fixed,
      skipped,
      errors,
      scriptsAdded,
      scriptsCorrected,
    },
    results: fixResults,
  };
}

/**
 * Print fix report
 */
function printReport(report: FixReport, dryRun: boolean): void {
  console.log(dryRun ? '\n🔍 Dry Run - Script Fix Preview' : '\n✨ Script Fix Report');
  console.log('='.repeat(80));

  // Summary
  console.log('\n📊 Summary:');
  console.log(`   Total Packages:      ${report.summary.totalPackages}`);
  console.log(`   ${dryRun ? 'Would Fix' : 'Fixed'}:           ${report.summary.fixed}`);
  console.log(`   Skipped:             ${report.summary.skipped}`);
  console.log(`   Errors:              ${report.summary.errors}`);
  console.log(`   Scripts Added:       ${report.summary.scriptsAdded}`);
  console.log(`   Scripts Corrected:   ${report.summary.scriptsCorrected}`);

  // Packages with changes
  const changedResults = report.results.filter(
    (r) => r.scriptsAdded.length > 0 || r.scriptsCorrected.length > 0,
  );

  if (changedResults.length > 0) {
    console.log(dryRun ? '\n📝 Would Add Scripts:' : '\n✅ Scripts Added:');
    for (const result of changedResults) {
      if (result.scriptsAdded.length > 0) {
        console.log(`\n   ${result.name}:`);
        for (const script of result.scriptsAdded) {
          console.log(`      + ${script}`);
        }
      }
    }
  }

  // Errors
  const errorResults = report.results.filter((r) => r.error);
  if (errorResults.length > 0) {
    console.log('\n❌ Errors:');
    for (const result of errorResults) {
      console.log(`   ${result.name}: ${result.error}`);
    }
  }

  console.log(`\n${'='.repeat(80)}`);

  if (dryRun) {
    console.log('🔍 Dry run complete. Run without --dry-run to apply changes.\n');
  } else if (report.summary.fixed > 0) {
    console.log('✅ Scripts fixed successfully!\n');
    console.log('Next steps:');
    console.log('  1. Review changes: git diff');
    console.log('  2. Validate: pnpm maintain:validate-scripts');
    console.log('  3. Test: pnpm test\n');
  } else {
    console.log('✨ All packages are already up to date!\n');
  }
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const dryRun = args.includes('--dry-run');
  const backup = args.includes('--backup');

  const packageIndex = args.indexOf('--package');
  const packageFilter = packageIndex >= 0 ? args[packageIndex + 1] : undefined;

  const report = await generateFixReport(packageFilter, dryRun, backup);

  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printReport(report, dryRun);
  }

  // Exit with error code if there were errors
  if (report.summary.errors > 0) {
    process.exit(ErrorCode.VALIDATION_ERROR);
  }
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(ErrorCode.EXECUTION_ERROR);
});
