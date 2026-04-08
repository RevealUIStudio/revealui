#!/usr/bin/env tsx
/**
 * Package.json Script Auditor
 *
 * Analyzes all package.json files in the monorepo to identify:
 * - Duplicate scripts across packages
 * - Inconsistent script patterns
 * - Missing standard scripts
 * - Script health metrics
 *
 * @dependencies
 * - scripts/lib/errors.ts - ErrorCode enum for exit codes
 * - scripts/lib/paths.ts - Project root resolution
 * - node:fs/promises - File system operations for reading package.json files
 * - node:path - Path manipulation utilities
 *
 * @example
 * ```bash
 * tsx scripts/commands/maintain/audit-scripts.ts
 * tsx scripts/commands/maintain/audit-scripts.ts --json
 * tsx scripts/commands/maintain/audit-scripts.ts --show-duplicates
 * ```
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ErrorCode } from '@revealui/scripts/errors.js';
import { getProjectRoot } from '@revealui/scripts/paths.js';

// =============================================================================
// Types
// =============================================================================

interface PackageInfo {
  path: string;
  relativePath: string;
  name: string;
  type: 'root' | 'app' | 'library' | 'tool' | 'infrastructure';
  scripts: Record<string, string>;
  scriptCount: number;
}

interface ScriptOccurrence {
  package: string;
  path: string;
  command: string;
}

interface DuplicateScript {
  scriptName: string;
  occurrences: ScriptOccurrence[];
  count: number;
  commands: string[];
}

interface AuditReport {
  summary: {
    totalPackages: number;
    totalScripts: number;
    uniqueScripts: number;
    duplicateScripts: number;
    duplicationPercentage: number;
  };
  packages: PackageInfo[];
  duplicates: DuplicateScript[];
  recommendations: string[];
}

// =============================================================================
// Standard Scripts by Package Type
// =============================================================================

const STANDARD_SCRIPTS: Record<string, string[]> = {
  app: ['dev', 'build', 'start', 'lint', 'typecheck', 'test', 'clean'],
  library: ['build', 'dev', 'lint', 'typecheck', 'test', 'clean'],
  tool: ['build', 'dev', 'lint', 'typecheck', 'test'],
};

// =============================================================================
// Package.json Discovery
// =============================================================================

const PACKAGE_PATHS = [
  // Root
  './package.json',

  // Apps
  './apps/admin/package.json',
  './apps/docs/package.json',
  './apps/marketing/package.json',
  './apps/mainframe/package.json',

  // Packages
  './packages/ai/package.json',
  './packages/auth/package.json',
  './packages/cli/package.json',
  './packages/config/package.json',
  './packages/contracts/package.json',
  './packages/core/package.json',
  './packages/db/package.json',
  './packages/dev/package.json',
  './packages/mcp/package.json',
  './packages/presentation/package.json',
  './packages/services/package.json',
  './packages/setup/package.json',
  './packages/sync/package.json',
  './packages/test/package.json',

  // Scripts lib
  './scripts/lib/package.json',

  // Infrastructure
  './infrastructure/opencode-server/pulumi-vultr/package.json',
];

// =============================================================================
// Analysis Functions
// =============================================================================

/**
 * Determine package type from path and name
 */
function determinePackageType(path: string, name: string): PackageInfo['type'] {
  if (path === './package.json') return 'root';
  if (path.startsWith('./apps/')) return 'app';
  if (path.startsWith('./infrastructure/')) return 'infrastructure';
  if (name.includes('cli') || name.includes('scripts')) return 'tool';
  return 'library';
}

/**
 * Load package info from package.json
 */
async function loadPackageInfo(
  projectRoot: string,
  relativePath: string,
): Promise<PackageInfo | null> {
  try {
    const fullPath = join(projectRoot, relativePath);
    const content = await readFile(fullPath, 'utf-8');
    const pkg = JSON.parse(content);

    return {
      path: fullPath,
      relativePath,
      name: pkg.name || relativePath,
      type: determinePackageType(relativePath, pkg.name || ''),
      scripts: pkg.scripts || {},
      scriptCount: Object.keys(pkg.scripts || {}).length,
    };
  } catch (error) {
    console.warn(`Failed to load ${relativePath}:`, error);
    return null;
  }
}

/**
 * Analyze script duplication across packages
 */
function analyzeDuplicates(packages: PackageInfo[]): DuplicateScript[] {
  // Map of script name -> occurrences
  const scriptMap = new Map<string, ScriptOccurrence[]>();

  // Collect all script occurrences
  for (const pkg of packages) {
    for (const [scriptName, command] of Object.entries(pkg.scripts)) {
      if (!scriptMap.has(scriptName)) {
        scriptMap.set(scriptName, []);
      }
      scriptMap.get(scriptName)?.push({
        package: pkg.name,
        path: pkg.relativePath,
        command,
      });
    }
  }

  // Find duplicates (scripts that appear in multiple packages)
  const duplicates: DuplicateScript[] = [];

  for (const [scriptName, occurrences] of scriptMap.entries()) {
    if (occurrences.length > 1) {
      const commands = [...new Set(occurrences.map((o) => o.command))];
      duplicates.push({
        scriptName,
        occurrences,
        count: occurrences.length,
        commands,
      });
    }
  }

  // Sort by count (most duplicated first)
  duplicates.sort((a, b) => b.count - a.count);

  return duplicates;
}

/**
 * Generate recommendations based on analysis
 */
function generateRecommendations(packages: PackageInfo[], duplicates: DuplicateScript[]): string[] {
  const recommendations: string[] = [];

  // High duplication
  const highlyDuplicatedScripts = duplicates.filter((d) => d.count >= 5);
  if (highlyDuplicatedScripts.length > 0) {
    recommendations.push(
      `Found ${highlyDuplicatedScripts.length} scripts duplicated across 5+ packages. Consider creating package templates.`,
    );
  }

  // Inconsistent commands
  const inconsistentScripts = duplicates.filter((d) => d.commands.length > 2);
  if (inconsistentScripts.length > 0) {
    recommendations.push(
      `Found ${inconsistentScripts.length} scripts with inconsistent commands across packages. Standardize these.`,
    );
  }

  // Missing standard scripts
  const libPackages = packages.filter((p) => p.type === 'library');
  const appPackages = packages.filter((p) => p.type === 'app');

  for (const pkg of libPackages) {
    const missing = STANDARD_SCRIPTS.library.filter((s) => !pkg.scripts[s]);
    if (missing.length > 0) {
      recommendations.push(
        `Package ${pkg.name} is missing standard library scripts: ${missing.join(', ')}`,
      );
    }
  }

  for (const pkg of appPackages) {
    const missing = STANDARD_SCRIPTS.app.filter((s) => !pkg.scripts[s]);
    if (missing.length > 0) {
      recommendations.push(
        `Package ${pkg.name} is missing standard app scripts: ${missing.join(', ')}`,
      );
    }
  }

  // Turbo usage
  const packagesWithoutTurbo = packages.filter(
    (p) => p.type !== 'root' && !Object.values(p.scripts).some((s) => s.includes('turbo')),
  );
  if (packagesWithoutTurbo.length > 0) {
    recommendations.push(
      `${packagesWithoutTurbo.length} packages don't use turbo. Consider migrating to turbo for better caching.`,
    );
  }

  return recommendations;
}

/**
 * Calculate duplication percentage
 */
function calculateDuplicationPercentage(
  packages: PackageInfo[],
  duplicates: DuplicateScript[],
): number {
  // Total number of script definitions across all packages
  const totalScriptDefinitions = packages.reduce((sum, pkg) => sum + pkg.scriptCount, 0);

  // Number of duplicate script definitions (extra copies beyond the first)
  const duplicateDefinitions = duplicates.reduce((sum, dup) => sum + (dup.count - 1), 0);

  return totalScriptDefinitions > 0 ? (duplicateDefinitions / totalScriptDefinitions) * 100 : 0;
}

// =============================================================================
// Report Generation
// =============================================================================

/**
 * Generate audit report
 */
async function generateAuditReport(): Promise<AuditReport> {
  const projectRoot = await getProjectRoot(import.meta.url);

  // Load all packages
  const packageInfos = await Promise.all(
    PACKAGE_PATHS.map((path) => loadPackageInfo(projectRoot, path)),
  );

  const packages = packageInfos.filter((p): p is PackageInfo => p !== null);

  // Analyze duplicates
  const duplicates = analyzeDuplicates(packages);

  // Calculate metrics
  const totalScripts = packages.reduce((sum, pkg) => sum + pkg.scriptCount, 0);
  const uniqueScriptNames = new Set<string>();
  for (const pkg of packages) {
    for (const scriptName of Object.keys(pkg.scripts)) {
      uniqueScriptNames.add(scriptName);
    }
  }

  const duplicationPercentage = calculateDuplicationPercentage(packages, duplicates);

  // Generate recommendations
  const recommendations = generateRecommendations(packages, duplicates);

  return {
    summary: {
      totalPackages: packages.length,
      totalScripts,
      uniqueScripts: uniqueScriptNames.size,
      duplicateScripts: duplicates.length,
      duplicationPercentage,
    },
    packages,
    duplicates,
    recommendations,
  };
}

/**
 * Print report to console
 */
function printReport(report: AuditReport, options: { showDuplicates?: boolean } = {}): void {
  console.log('\n📊 Package.json Script Audit Report');
  console.log('='.repeat(80));

  // Summary
  console.log('\n📈 Summary:');
  console.log(`   Total Packages:        ${report.summary.totalPackages}`);
  console.log(`   Total Scripts:         ${report.summary.totalScripts}`);
  console.log(`   Unique Script Names:   ${report.summary.uniqueScripts}`);
  console.log(`   Duplicate Scripts:     ${report.summary.duplicateScripts}`);
  console.log(`   Duplication Rate:      ${report.summary.duplicationPercentage.toFixed(1)}%`);

  // Package breakdown
  console.log('\n📦 Packages by Type:');
  const byType = new Map<string, PackageInfo[]>();
  for (const pkg of report.packages) {
    if (!byType.has(pkg.type)) {
      byType.set(pkg.type, []);
    }
    byType.get(pkg.type)?.push(pkg);
  }

  for (const [type, pkgs] of byType.entries()) {
    const avgScripts = pkgs.reduce((sum, p) => sum + p.scriptCount, 0) / pkgs.length;
    console.log(
      `   ${type.padEnd(15)} ${pkgs.length} packages, avg ${avgScripts.toFixed(1)} scripts`,
    );
  }

  // Top duplicated scripts
  console.log('\n🔄 Top Duplicated Scripts:');
  const topDuplicates = report.duplicates.slice(0, 10);
  for (const dup of topDuplicates) {
    const consistent = dup.commands.length === 1 ? '✅' : '⚠️';
    console.log(`   ${consistent} ${dup.scriptName.padEnd(25)} ${dup.count} packages`);
    if (dup.commands.length > 1) {
      console.log(`      Different implementations: ${dup.commands.length}`);
    }
  }

  // Show all duplicates if requested
  if (options.showDuplicates) {
    console.log('\n📋 All Duplicate Scripts:');
    for (const dup of report.duplicates) {
      console.log(`\n   ${dup.scriptName} (${dup.count} packages):`);
      for (const occ of dup.occurrences) {
        console.log(`      • ${occ.package}: ${occ.command}`);
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
  console.log('✅ Audit complete!\n');
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const showDuplicates = args.includes('--show-duplicates');

  const report = await generateAuditReport();

  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printReport(report, { showDuplicates });
  }

  // Exit with code 1 if duplication is too high (>30%)
  if (report.summary.duplicationPercentage > 30) {
    process.exit(ErrorCode.VALIDATION_ERROR);
  }
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(ErrorCode.EXECUTION_ERROR);
});
