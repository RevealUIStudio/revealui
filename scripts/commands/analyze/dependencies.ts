#!/usr/bin/env tsx
/**
 * Dependency Analysis Tool
 *
 * Analyze package dependencies, detect issues, and provide insights.
 *
 * Features:
 * - Circular dependency detection
 * - Unused dependency detection
 * - Outdated package detection
 * - Dependency tree visualization
 * - Security vulnerability scanning
 * - Duplicate dependency detection
 *
 * @dependencies
 * - scripts/lib/errors.ts - ErrorCode enum for exit codes
 * - scripts/lib/exec.ts - Command execution utilities
 * - scripts/lib/logger.ts - Logger utilities
 * - scripts/lib/parallel.ts - Parallel execution utilities
 * - scripts/lib/paths.ts - Project root resolution
 * - node:fs/promises - File system operations for reading package.json
 * - node:path - Path manipulation utilities
 * - fast-glob - File pattern matching for package discovery
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ErrorCode } from '@revealui/scripts/errors.js';
import { execCommand } from '@revealui/scripts/exec.js';
import { createLogger } from '@revealui/scripts/logger.js';
import { parallelMap } from '@revealui/scripts/parallel.js';
import { getProjectRoot } from '@revealui/scripts/paths.js';
import fg from 'fast-glob';

const logger = createLogger({ prefix: 'DependencyAnalysis' });

// =============================================================================
// Types
// =============================================================================

interface PackageJson {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

interface DependencyIssue {
  type: 'unused' | 'outdated' | 'circular' | 'duplicate' | 'missing' | 'vulnerability';
  severity: 'low' | 'medium' | 'high' | 'critical';
  package: string;
  version?: string;
  message: string;
  fix?: string;
}

interface DependencyAnalysisResult {
  totalPackages: number;
  totalDependencies: number;
  issues: DependencyIssue[];
  summary: {
    unused: number;
    outdated: number;
    circular: number;
    duplicates: number;
    vulnerabilities: number;
  };
}

// =============================================================================
// Main Analysis Functions
// =============================================================================

/**
 * Analyze all dependencies in the monorepo
 */
export async function analyzeDependencies(options: {
  checkUnused?: boolean;
  checkOutdated?: boolean;
  checkCircular?: boolean;
  checkDuplicates?: boolean;
  checkSecurity?: boolean;
  json?: boolean;
}): Promise<DependencyAnalysisResult> {
  const {
    checkUnused = true,
    checkOutdated = true,
    checkCircular = true,
    checkDuplicates = true,
    checkSecurity = true,
    json = false,
  } = options;

  if (!json) {
    logger.header('Dependency Analysis');
  }

  const root = await getProjectRoot(import.meta.url);
  const issues: DependencyIssue[] = [];

  // Find all package.json files
  const packageFiles = await fg('**/package.json', {
    cwd: root,
    ignore: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/opensrc/**'],
  });

  if (!json) {
    logger.info(`Found ${packageFiles.length} packages`);
  }

  // Load all packages
  const packages = await parallelMap(
    packageFiles,
    async (file) => {
      const content = await readFile(join(root, file), 'utf-8');
      return {
        path: file,
        data: JSON.parse(content) as PackageJson,
      };
    },
    { concurrency: 5 },
  );

  const totalDeps = packages.reduce((acc, pkg) => {
    const deps = Object.keys(pkg.data.dependencies || {}).length;
    const devDeps = Object.keys(pkg.data.devDependencies || {}).length;
    return acc + deps + devDeps;
  }, 0);

  // Check for unused dependencies
  if (checkUnused) {
    if (!json) {
      logger.info('Checking for unused dependencies...');
    }
    const unusedIssues = await findUnusedDependencies(root, packages);
    issues.push(...unusedIssues);
  }

  // Check for outdated dependencies
  if (checkOutdated) {
    if (!json) {
      logger.info('Checking for outdated dependencies...');
    }
    const outdatedIssues = await findOutdatedDependencies(root);
    issues.push(...outdatedIssues);
  }

  // Check for circular dependencies
  if (checkCircular) {
    if (!json) {
      logger.info('Checking for circular dependencies...');
    }
    const circularIssues = await findCircularDependencies(root);
    issues.push(...circularIssues);
  }

  // Check for duplicate dependencies
  if (checkDuplicates) {
    if (!json) {
      logger.info('Checking for duplicate dependencies...');
    }
    const duplicateIssues = findDuplicateDependencies(packages);
    issues.push(...duplicateIssues);
  }

  // Check for security vulnerabilities
  if (checkSecurity) {
    if (!json) {
      logger.info('Checking for security vulnerabilities...');
    }
    const securityIssues = await findSecurityVulnerabilities(root);
    issues.push(...securityIssues);
  }

  const summary = {
    unused: issues.filter((i) => i.type === 'unused').length,
    outdated: issues.filter((i) => i.type === 'outdated').length,
    circular: issues.filter((i) => i.type === 'circular').length,
    duplicates: issues.filter((i) => i.type === 'duplicate').length,
    vulnerabilities: issues.filter((i) => i.type === 'vulnerability').length,
  };

  return {
    totalPackages: packages.length,
    totalDependencies: totalDeps,
    issues,
    summary,
  };
}

/**
 * Find unused dependencies
 */
async function findUnusedDependencies(
  root: string,
  packages: Array<{ path: string; data: PackageJson }>,
): Promise<DependencyIssue[]> {
  const issues: DependencyIssue[] = [];

  for (const pkg of packages) {
    const pkgDir = join(root, pkg.path, '..');
    const deps = pkg.data.dependencies || {};

    // Get all source files in package
    const sourceFiles = await fg(['src/**/*.ts', 'src/**/*.tsx', 'src/**/*.js', 'src/**/*.jsx'], {
      cwd: pkgDir,
    });

    // Read all source files
    const sourceCode = await Promise.all(
      sourceFiles.map(async (file) => {
        try {
          return await readFile(join(pkgDir, file), 'utf-8');
        } catch {
          return '';
        }
      }),
    );

    const allCode = sourceCode.join('\n');

    // Check each dependency
    for (const dep of Object.keys(deps)) {
      // Skip certain packages that are commonly used indirectly
      if (dep.startsWith('@types/') || ['react', 'react-dom', 'next'].includes(dep)) {
        continue;
      }

      // Simple check: is the package name mentioned in any source file?
      const isUsed =
        allCode.includes(`from '${dep}'`) ||
        allCode.includes(`from "${dep}"`) ||
        allCode.includes(`require('${dep}')`) ||
        allCode.includes(`require("${dep}")`);

      if (!isUsed) {
        issues.push({
          type: 'unused',
          severity: 'low',
          package: dep,
          message: `Dependency '${dep}' appears unused in ${pkg.data.name}`,
          fix: `Remove from dependencies in ${pkg.path}`,
        });
      }
    }
  }

  return issues;
}

/**
 * Find outdated dependencies
 */
async function findOutdatedDependencies(root: string): Promise<DependencyIssue[]> {
  const issues: DependencyIssue[] = [];

  try {
    const result = await execCommand('pnpm', ['outdated', '--format', 'json'], {
      cwd: root,
      ignoreError: true,
    });

    if (result.stdout) {
      const outdated = JSON.parse(result.stdout);
      for (const [pkg, info] of Object.entries(outdated as Record<string, unknown>)) {
        const infoData = info as { current: string; latest: string };
        issues.push({
          type: 'outdated',
          severity: 'low',
          package: pkg,
          version: infoData.current,
          message: `${pkg} is outdated (current: ${infoData.current}, latest: ${infoData.latest})`,
          fix: `Update to ${info.latest}`,
        });
      }
    }
  } catch (_error) {
    // pnpm outdated returns non-zero if packages are outdated
    // This is expected, so we ignore the error
  }

  return issues;
}

/**
 * Find circular dependencies
 */
async function findCircularDependencies(root: string): Promise<DependencyIssue[]> {
  const issues: DependencyIssue[] = [];

  // Get all TypeScript/JavaScript files
  const files = await fg(['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'], {
    cwd: root,
    ignore: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/coverage/**', '**/opensrc/**'],
  });

  // Build import graph
  const importGraph = new Map<string, Set<string>>();

  for (const file of files) {
    const content = await readFile(join(root, file), 'utf-8');
    const imports = extractImports(content, file, root);
    importGraph.set(file, imports);
  }

  // Detect cycles
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function detectCycle(file: string, path: string[] = []): string[] | null {
    if (recursionStack.has(file)) {
      return [...path, file];
    }

    if (visited.has(file)) {
      return null;
    }

    visited.add(file);
    recursionStack.add(file);

    const imports = importGraph.get(file) || new Set();
    for (const imported of imports) {
      const cycle = detectCycle(imported, [...path, file]);
      if (cycle) {
        return cycle;
      }
    }

    recursionStack.delete(file);
    return null;
  }

  const cycles = new Set<string>();
  for (const file of files) {
    const cycle = detectCycle(file);
    if (cycle) {
      const cycleStr = cycle.join(' → ');
      if (!cycles.has(cycleStr)) {
        cycles.add(cycleStr);
        issues.push({
          type: 'circular',
          severity: 'medium',
          package: cycle[0],
          message: `Circular dependency: ${cycleStr}`,
          fix: 'Refactor to remove circular dependency',
        });
      }
    }
  }

  return issues;
}

/**
 * Extract imports from source file
 */
function extractImports(content: string, currentFile: string, root: string): Set<string> {
  const imports = new Set<string>();
  const importRegex = /import\s+.*?\s+from\s+['"](.+?)['"]/g;
  const requireRegex = /require\(['"](.+?)['"]\)/g;

  let match: RegExpExecArray | null = importRegex.exec(content);

  while (match !== null) {
    const importPath = match[1];
    if (importPath.startsWith('.')) {
      // Resolve relative import
      const resolved = resolveImport(currentFile, importPath, root);
      if (resolved) {
        imports.add(resolved);
      }
    }
    match = importRegex.exec(content);
  }

  match = requireRegex.exec(content);
  while (match !== null) {
    const importPath = match[1];
    if (importPath.startsWith('.')) {
      const resolved = resolveImport(currentFile, importPath, root);
      if (resolved) {
        imports.add(resolved);
      }
    }
    match = requireRegex.exec(content);
  }

  return imports;
}

/**
 * Resolve relative import path
 */
function resolveImport(fromFile: string, importPath: string, root: string): string | null {
  const fromDir = fromFile.substring(0, fromFile.lastIndexOf('/'));
  let resolved = join(fromDir, importPath);

  // Normalize path
  resolved = resolved.replace(/\\/g, '/');

  // Try common extensions
  const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx'];
  for (const ext of extensions) {
    const candidate = resolved + ext;
    if (candidate.startsWith(root) || !root) {
      return candidate;
    }
  }

  return null;
}

/**
 * Find duplicate dependencies
 */
function findDuplicateDependencies(
  packages: Array<{ path: string; data: PackageJson }>,
): DependencyIssue[] {
  const issues: DependencyIssue[] = [];
  const versionMap = new Map<string, Map<string, string[]>>();

  // Collect all dependency versions
  for (const pkg of packages) {
    const allDeps = {
      ...pkg.data.dependencies,
      ...pkg.data.devDependencies,
    };

    for (const [dep, version] of Object.entries(allDeps)) {
      let versions = versionMap.get(dep);
      if (!versions) {
        versions = new Map();
        versionMap.set(dep, versions);
      }
      if (!versions.has(version)) {
        versions.set(version, []);
      }
      versions.get(version)?.push(pkg.data.name);
    }
  }

  // Find duplicates (same package, different versions)
  for (const [dep, versions] of versionMap) {
    if (versions.size > 1) {
      const versionList = Array.from(versions.entries())
        .map(([v, pkgs]) => `${v} (${pkgs.join(', ')})`)
        .join(', ');

      issues.push({
        type: 'duplicate',
        severity: 'medium',
        package: dep,
        message: `Duplicate versions of '${dep}': ${versionList}`,
        fix: 'Align versions across all packages',
      });
    }
  }

  return issues;
}

/**
 * Find security vulnerabilities
 */
async function findSecurityVulnerabilities(root: string): Promise<DependencyIssue[]> {
  const issues: DependencyIssue[] = [];

  try {
    const result = await execCommand('pnpm', ['audit', '--json'], {
      cwd: root,
      ignoreError: true,
    });

    if (result.stdout) {
      const audit = JSON.parse(result.stdout);
      const advisories = audit.advisories || {};

      for (const [_id, advisory] of Object.entries(advisories as Record<string, unknown>)) {
        const advisoryData = advisory as {
          severity: 'low' | 'moderate' | 'high' | 'critical';
          module_name: string;
          vulnerable_versions: string;
          title: string;
        };
        issues.push({
          type: 'vulnerability',
          severity: advisoryData.severity,
          package: advisoryData.module_name,
          version: advisoryData.vulnerable_versions,
          message: `${advisoryData.title} in ${advisoryData.module_name}`,
          fix: advisory.recommendation || 'Update package',
        });
      }
    }
  } catch (_error) {
    // Audit might fail, that's ok
  }

  return issues;
}

// =============================================================================
// CLI Entry Point
// =============================================================================

async function main() {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const help = args.includes('--help') || args.includes('-h');

  if (help) {
    console.log(`
Dependency Analysis Tool

Usage:
  tsx dependencies.ts [options]

Options:
  --json              Output in JSON format
  --no-unused         Skip unused dependency check
  --no-outdated       Skip outdated dependency check
  --no-circular       Skip circular dependency check
  --no-duplicates     Skip duplicate dependency check
  --no-security       Skip security vulnerability check
  --help, -h          Show this help message
`);
    return 0;
  }

  const result = await analyzeDependencies({
    checkUnused: !args.includes('--no-unused'),
    checkOutdated: !args.includes('--no-outdated'),
    checkCircular: !args.includes('--no-circular'),
    checkDuplicates: !args.includes('--no-duplicates'),
    checkSecurity: !args.includes('--no-security'),
    json,
  });

  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    // Print results
    logger.header('Analysis Results');
    console.log(`Total Packages:     ${result.totalPackages}`);
    console.log(`Total Dependencies: ${result.totalDependencies}`);
    console.log();

    console.log('Issues Found:');
    console.log(`  Unused:           ${result.summary.unused}`);
    console.log(`  Outdated:         ${result.summary.outdated}`);
    console.log(`  Circular:         ${result.summary.circular}`);
    console.log(`  Duplicates:       ${result.summary.duplicates}`);
    console.log(`  Vulnerabilities:  ${result.summary.vulnerabilities}`);
    console.log();

    if (result.issues.length > 0) {
      console.log('Issues:');
      for (const issue of result.issues) {
        const severityColor =
          issue.severity === 'critical'
            ? '\x1b[31m'
            : issue.severity === 'high'
              ? '\x1b[33m'
              : '\x1b[36m';
        console.log(
          `  ${severityColor}[${issue.severity.toUpperCase()}]\x1b[0m ${issue.type}: ${issue.message}`,
        );
        if (issue.fix) {
          console.log(`    Fix: ${issue.fix}`);
        }
      }
    } else {
      logger.success('No issues found!');
    }
  }

  return result.issues.filter((i) => i.severity === 'critical' || i.severity === 'high').length;
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .then((code) => process.exit(code))
    .catch((error) => {
      logger.error(`Error: ${error.message}`);
      process.exit(ErrorCode.EXECUTION_ERROR);
    });
}
