#!/usr/bin/env tsx
/**
 * Script Validation API Example
 *
 * Demonstrates programmatic validation of package.json scripts
 * against standardized templates.
 *
 * Usage:
 *   tsx script-validation-api.ts [--strict] [--json]
 *
 * Examples:
 *   tsx script-validation-api.ts
 *   tsx script-validation-api.ts --strict
 *   tsx script-validation-api.ts --json
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

interface PackageJson {
  name: string;
  scripts?: Record<string, string>;
}

interface ValidationResult {
  name: string;
  path: string;
  score: number;
  status: 'pass' | 'warning' | 'fail';
  missingScripts: string[];
  extraScripts: string[];
}

interface ValidationSummary {
  totalPackages: number;
  passed: number;
  warnings: number;
  failed: number;
  averageScore: number;
  results: ValidationResult[];
}

// Standard script templates
const REQUIRED_SCRIPTS = {
  library: ['build', 'dev', 'lint', 'typecheck', 'test', 'clean'],
  app: ['dev', 'build', 'start', 'lint', 'typecheck', 'test', 'clean'],
  tool: ['build', 'dev', 'lint', 'typecheck', 'test'],
};

const OPTIONAL_SCRIPTS = ['test:watch', 'test:coverage', 'test:ui', 'format'];

/**
 * Detect package type based on location and dependencies
 */
function detectPackageType(packagePath: string, pkg: PackageJson): keyof typeof REQUIRED_SCRIPTS {
  const isApp = packagePath.includes('apps/');
  const isCLI = pkg.name?.includes('/cli') || packagePath.includes('/cli');

  if (isCLI) return 'tool';
  if (isApp) return 'app';
  return 'library';
}

/**
 * Calculate health score for a package
 */
function calculateScore(
  required: string[],
  optional: string[],
  scripts: Record<string, string> = {},
): number {
  const presentRequired = required.filter((s) => s in scripts).length;
  const presentOptional = optional.filter((s) => s in scripts).length;

  const requiredScore = (presentRequired / required.length) * 60;
  const optionalScore = (presentOptional / optional.length) * 30;
  const completenessBonus = presentRequired === required.length ? 10 : 0;

  return Math.round(requiredScore + optionalScore + completenessBonus);
}

/**
 * Validate a single package
 */
function validatePackage(packagePath: string, pkg: PackageJson): ValidationResult {
  const type = detectPackageType(packagePath, pkg);
  const required = REQUIRED_SCRIPTS[type];
  const scripts = pkg.scripts || {};

  const missingScripts = required.filter((s) => !(s in scripts));
  const extraScripts = Object.keys(scripts).filter(
    (s) => !(required.includes(s) || OPTIONAL_SCRIPTS.includes(s) || s.startsWith('_')),
  );

  const score = calculateScore(required, OPTIONAL_SCRIPTS, scripts);

  let status: 'pass' | 'warning' | 'fail' = 'pass';
  if (score < 70) status = 'fail';
  else if (score < 90) status = 'warning';

  return {
    name: pkg.name || packagePath,
    path: packagePath,
    score,
    status,
    missingScripts,
    extraScripts,
  };
}

/**
 * Find all package.json files in workspace
 */
function findPackages(rootDir: string): string[] {
  const packages: string[] = [];

  function walk(dir: string) {
    const files = readdirSync(dir);

    for (const file of files) {
      const fullPath = join(dir, file);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        // Skip node_modules and hidden directories
        if (file === 'node_modules' || file.startsWith('.')) continue;

        // Check for package.json
        const pkgPath = join(fullPath, 'package.json');
        try {
          statSync(pkgPath);
          packages.push(fullPath);
        } catch {
          // No package.json, continue walking
          walk(fullPath);
        }
      }
    }
  }

  walk(rootDir);
  return packages;
}

/**
 * Validate all packages in workspace
 */
function validateWorkspace(rootDir: string): ValidationSummary {
  const packageDirs = findPackages(rootDir);
  const results: ValidationResult[] = [];

  for (const dir of packageDirs) {
    try {
      const pkgPath = join(dir, 'package.json');
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as PackageJson;

      // Skip if it's not a real package (no name)
      if (!pkg.name) continue;

      const result = validatePackage(dir, pkg);
      results.push(result);
    } catch (error) {
      console.error(`Error validating ${dir}:`, error);
    }
  }

  const passed = results.filter((r) => r.status === 'pass').length;
  const warnings = results.filter((r) => r.status === 'warning').length;
  const failed = results.filter((r) => r.status === 'fail').length;
  const averageScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;

  return {
    totalPackages: results.length,
    passed,
    warnings,
    failed,
    averageScore: Math.round(averageScore * 10) / 10,
    results,
  };
}

/**
 * Print human-readable validation report
 */
function printReport(summary: ValidationSummary, strict: boolean) {
  console.log('✅ Package Script Validation Report');
  console.log('====================================\n');

  console.log('📊 Summary:');
  console.log(`   Total Packages:    ${summary.totalPackages}`);
  console.log(`   ✅ Passed:          ${summary.passed}`);
  console.log(`   ⚠️  Warnings:        ${summary.warnings}`);
  console.log(`   ❌ Failed:          ${summary.failed}`);
  console.log(`   📈 Average Score:   ${summary.averageScore}/100\n`);

  // Show failed packages
  const failedPackages = summary.results.filter((r) => r.status === 'fail');
  if (failedPackages.length > 0) {
    console.log('❌ Failed Packages:\n');
    for (const pkg of failedPackages) {
      console.log(`   ${pkg.name} (score: ${pkg.score}/100)`);
      if (pkg.missingScripts.length > 0) {
        console.log(`      Missing: ${pkg.missingScripts.join(', ')}`);
      }
      console.log('');
    }
  }

  // Show warnings
  const warningPackages = summary.results.filter((r) => r.status === 'warning');
  if (warningPackages.length > 0 && strict) {
    console.log('⚠️  Warning Packages:\n');
    for (const pkg of warningPackages) {
      console.log(`   ${pkg.name} (score: ${pkg.score}/100)`);
      if (pkg.missingScripts.length > 0) {
        console.log(`      Missing: ${pkg.missingScripts.join(', ')}`);
      }
      console.log('');
    }
  }

  // Overall result
  const hasFailures = failedPackages.length > 0;
  const hasWarnings = warningPackages.length > 0;

  if (hasFailures) {
    console.log('❌ Validation failed\n');
    process.exit(1);
  } else if (hasWarnings && strict) {
    console.log('⚠️  Validation passed with warnings\n');
    process.exit(1);
  } else {
    console.log('✅ Validation passed\n');
    process.exit(0);
  }
}

/**
 * Print JSON report
 */
function printJSON(summary: ValidationSummary, strict: boolean) {
  console.log(JSON.stringify(summary, null, 2));

  const hasFailures = summary.failed > 0;
  const hasWarnings = summary.warnings > 0;

  if (hasFailures || (hasWarnings && strict)) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

// Main execution
function main() {
  const args = process.argv.slice(2);
  const strict = args.includes('--strict');
  const json = args.includes('--json');

  // Get project root (assumes script is in examples/code-examples/)
  const projectRoot = join(__dirname, '../..');

  const summary = validateWorkspace(projectRoot);

  if (json) {
    printJSON(summary, strict);
  } else {
    printReport(summary, strict);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

// Export for programmatic use
export { type ValidationResult, type ValidationSummary, validatePackage, validateWorkspace };
