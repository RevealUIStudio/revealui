#!/usr/bin/env tsx
/**
 * Package.json Script Validator
 *
 * Validates package.json scripts against standardized templates.
 * Checks for missing required scripts, incorrect implementations,
 * and provides recommendations for alignment.
 *
 * @dependencies
 * - scripts/lib/errors.ts - ErrorCode enum for exit codes
 * - scripts/lib/paths.ts - Project root resolution
 * - node:fs/promises - File system operations for reading package.json files
 * - node:path - Path manipulation utilities
 *
 * @example
 * ```bash
 * tsx scripts/commands/maintain/validate-scripts.ts
 * tsx scripts/commands/maintain/validate-scripts.ts --package @revealui/ai
 * tsx scripts/commands/maintain/validate-scripts.ts --strict
 * tsx scripts/commands/maintain/validate-scripts.ts --json
 * ```
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ErrorCode } from '@revealui/scripts/errors.js';
import { getProjectRoot } from '@revealui/scripts/paths.js';

// =============================================================================
// Types
// =============================================================================

interface PackageValidation {
  name: string;
  path: string;
  type: 'root' | 'app' | 'library' | 'tool' | 'infrastructure';
  missingScripts: string[];
  incorrectScripts: Array<{ name: string; expected: string; actual: string }>;
  extraScripts: string[];
  score: number;
  status: 'pass' | 'warning' | 'fail';
}

interface ValidationReport {
  summary: {
    totalPackages: number;
    passed: number;
    warnings: number;
    failed: number;
    averageScore: number;
  };
  validations: PackageValidation[];
  recommendations: string[];
}

interface Template {
  scripts: Record<string, string>;
  required: string[];
  optional: string[];
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
    optional: ['test:watch', 'test:coverage', 'format'],
  },
  app: {
    scripts: {
      // Framework-agnostic patterns
      build: 'next build | vite build',
      dev: 'next dev | vite dev',
      start: 'next start | vite preview',
      lint: 'biome check .',
      typecheck: 'tsc --noEmit',
      test: 'vitest run',
      'test:watch': 'vitest',
      'test:coverage': 'vitest run --coverage',
      clean: 'rm -rf .next dist .turbo',
    },
    required: ['dev', 'build', 'start', 'lint', 'typecheck', 'test', 'clean'],
    optional: ['test:watch', 'test:coverage', 'format'],
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
    optional: ['test:watch', 'test:coverage', 'clean'],
  },
};

// Root package is special - it orchestrates, doesn't need validation
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
// Validation Logic
// =============================================================================

/**
 * Validate a package against its template
 */
async function validatePackage(
  projectRoot: string,
  packagePath: string,
  type: 'app' | 'library' | 'tool' | 'infrastructure',
): Promise<PackageValidation | null> {
  try {
    const fullPath = join(projectRoot, packagePath);
    const content = await readFile(fullPath, 'utf-8');
    const pkg = JSON.parse(content);

    // Skip packages in skip list
    if (SKIP_PACKAGES.includes(pkg.name)) {
      return null;
    }

    const template = TEMPLATES[type === 'infrastructure' ? 'library' : type];
    const actualScripts = pkg.scripts || {};

    // Check for missing required scripts
    const missingScripts = template.required.filter((script) => !actualScripts[script]);

    // Check for incorrect script implementations
    const incorrectScripts: Array<{ name: string; expected: string; actual: string }> = [];
    for (const [scriptName, expectedCommand] of Object.entries(template.scripts)) {
      const actualCommand = actualScripts[scriptName];
      if (actualCommand && !isCommandSimilar(actualCommand, expectedCommand)) {
        incorrectScripts.push({
          name: scriptName,
          expected: expectedCommand,
          actual: actualCommand,
        });
      }
    }

    // Extra scripts (not in template) - informational only
    const templateScriptNames = new Set(Object.keys(template.scripts));
    const extraScripts = Object.keys(actualScripts).filter(
      (name) => !(templateScriptNames.has(name) || name.startsWith('//')),
    );

    // Calculate health score (0-100)
    const requiredMet = template.required.length - missingScripts.length;
    const requiredScore = (requiredMet / template.required.length) * 70;
    const correctnessScore = incorrectScripts.length === 0 ? 30 : 15;
    const score = Math.round(requiredScore + correctnessScore);

    // Determine status
    let status: 'pass' | 'warning' | 'fail' = 'pass';
    if (missingScripts.length > 0) {
      status = 'fail';
    } else if (incorrectScripts.length > 2) {
      status = 'warning';
    }

    return {
      name: pkg.name || packagePath,
      path: packagePath,
      type,
      missingScripts,
      incorrectScripts,
      extraScripts,
      score,
      status,
    };
  } catch (error) {
    console.warn(`Failed to validate ${packagePath}:`, error);
    return null;
  }
}

/**
 * Check if two commands are similar enough (handles framework variations)
 */
function isCommandSimilar(actual: string, expected: string): boolean {
  // Exact match
  if (actual === expected) return true;

  // Handle framework variations (e.g., "next build" matches "next build | vite build")
  if (expected.includes('|')) {
    const variants = expected.split('|').map((v) => v.trim());
    return variants.some((variant) => actual.includes(variant) || variant.includes(actual.trim()));
  }

  // Handle minor variations (--watch vs -w, etc.)
  const normalizedActual = actual.replace(/\s+/g, ' ').trim();
  const normalizedExpected = expected.replace(/\s+/g, ' ').trim();

  // If the core command is the same
  const actualBase = normalizedActual.split(' ')[0];
  const expectedBase = normalizedExpected.split(' ')[0];
  if (actualBase !== expectedBase) return false;

  // Allow flag variations
  return true;
}

/**
 * Generate validation report
 */
async function generateValidationReport(packageFilter?: string): Promise<ValidationReport> {
  const projectRoot = await getProjectRoot(import.meta.url);

  let packagesToValidate = PACKAGE_PATHS;

  // Filter by package if specified
  if (packageFilter) {
    packagesToValidate = packagesToValidate.filter((p) =>
      p.path.includes(packageFilter.replace('@revealui/', '')),
    );
  }

  // Validate all packages
  const validationResults = await Promise.all(
    packagesToValidate.map((p) => validatePackage(projectRoot, p.path, p.type)),
  );

  const validations = validationResults.filter((v): v is PackageValidation => v !== null);

  // Calculate summary
  const passed = validations.filter((v) => v.status === 'pass').length;
  const warnings = validations.filter((v) => v.status === 'warning').length;
  const failed = validations.filter((v) => v.status === 'fail').length;
  const averageScore =
    validations.length > 0
      ? validations.reduce((sum, v) => sum + v.score, 0) / validations.length
      : 0;

  // Generate recommendations
  const recommendations: string[] = [];

  const failedPackages = validations.filter((v) => v.status === 'fail');
  if (failedPackages.length > 0) {
    recommendations.push(
      `${failedPackages.length} packages are missing required scripts. Run 'pnpm maintain:fix-scripts' to auto-fix.`,
    );
  }

  const lowScorePackages = validations.filter((v) => v.score < 70);
  if (lowScorePackages.length > 0) {
    recommendations.push(
      `${lowScorePackages.length} packages have low health scores (<70). Review and align with templates.`,
    );
  }

  return {
    summary: {
      totalPackages: validations.length,
      passed,
      warnings,
      failed,
      averageScore,
    },
    validations,
    recommendations,
  };
}

/**
 * Print validation report
 */
function printReport(report: ValidationReport, strict: boolean): void {
  console.log('\n✅ Package Script Validation Report');
  console.log('='.repeat(80));

  // Summary
  console.log('\n📊 Summary:');
  console.log(`   Total Packages:    ${report.summary.totalPackages}`);
  console.log(`   ✅ Passed:          ${report.summary.passed}`);
  console.log(`   ⚠️  Warnings:        ${report.summary.warnings}`);
  console.log(`   ❌ Failed:          ${report.summary.failed}`);
  console.log(`   📈 Average Score:   ${report.summary.averageScore.toFixed(1)}/100`);

  // Failed packages
  const failedValidations = report.validations.filter((v) => v.status === 'fail');
  if (failedValidations.length > 0) {
    console.log('\n❌ Failed Packages:');
    for (const validation of failedValidations) {
      console.log(`\n   ${validation.name} (score: ${validation.score}/100)`);
      if (validation.missingScripts.length > 0) {
        console.log(`      Missing: ${validation.missingScripts.join(', ')}`);
      }
    }
  }

  // Warning packages
  const warningValidations = report.validations.filter((v) => v.status === 'warning');
  if (warningValidations.length > 0) {
    console.log('\n⚠️  Warnings:');
    for (const validation of warningValidations) {
      console.log(`\n   ${validation.name} (score: ${validation.score}/100)`);
      if (validation.incorrectScripts.length > 0) {
        console.log(`      Incorrect implementations: ${validation.incorrectScripts.length}`);
        for (const incorrect of validation.incorrectScripts.slice(0, 3)) {
          console.log(`        • ${incorrect.name}`);
          console.log(`          Expected: ${incorrect.expected}`);
          console.log(`          Actual:   ${incorrect.actual}`);
        }
      }
    }
  }

  // Recommendations
  if (report.recommendations.length > 0) {
    console.log('\n💡 Recommendations:');
    for (const rec of report.recommendations) {
      console.log(`   • ${rec}`);
    }
  }

  console.log(`\n${'='.repeat(80)}`);

  // Exit status
  if (failedValidations.length > 0) {
    console.log('❌ Validation failed\n');
  } else if (strict && warningValidations.length > 0) {
    console.log('⚠️  Validation passed with warnings (strict mode)\n');
  } else {
    console.log('✅ Validation passed\n');
  }
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const strict = args.includes('--strict');

  const packageIndex = args.indexOf('--package');
  const packageFilter = packageIndex >= 0 ? args[packageIndex + 1] : undefined;

  const report = await generateValidationReport(packageFilter);

  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printReport(report, strict);
  }

  // Exit with appropriate code
  if (report.summary.failed > 0) {
    process.exit(ErrorCode.VALIDATION_ERROR);
  } else if (strict && report.summary.warnings > 0) {
    process.exit(ErrorCode.VALIDATION_ERROR);
  }
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(ErrorCode.EXECUTION_ERROR);
});
