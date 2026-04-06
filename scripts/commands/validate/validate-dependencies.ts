#!/usr/bin/env tsx
/**
 * Dependency Validator
 *
 * Validates script dependencies by parsing @dependencies and @requires headers.
 * Detects circular dependencies, missing files, and undocumented dependencies.
 *
 * @dependencies
 * - node:fs - File system operations
 * - node:path - Path manipulation
 * - fast-glob - File pattern matching
 * - scripts/lib/index.js - Logger utilities
 *
 * @example
 * ```bash
 * # Validate all scripts
 * tsx scripts/commands/validate/validate-dependencies.ts
 *
 * # Check specific file
 * tsx scripts/commands/validate/validate-dependencies.ts --file scripts/cli/ops.ts
 *
 * # Output JSON
 * tsx scripts/commands/validate/validate-dependencies.ts --json
 * ```
 */

import { existsSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { ErrorCode } from '@revealui/scripts/errors.js';
import { createLogger } from '@revealui/scripts/index.js';
import glob from 'fast-glob';

const logger = createLogger({ prefix: 'DepsValidator' });

// =============================================================================
// Types
// =============================================================================

export interface ScriptNode {
  /** Absolute file path */
  path: string;
  /** Relative path from project root */
  relativePath: string;
  /** File dependencies from @dependencies */
  fileDependencies: FileDependency[];
  /** Package dependencies from @dependencies */
  packageDependencies: string[];
  /** Environment variables from @requires */
  envVariables: string[];
  /** External tools from @requires */
  externalTools: string[];
  /** Script execution dependencies from @requires */
  scriptDependencies: string[];
  /** Whether the file has @dependencies header */
  hasDocumentation: boolean;
  /** Actual imports found in the file */
  actualImports: string[];
}

export interface FileDependency {
  /** File path (as written in @dependencies) */
  path: string;
  /** Description */
  description: string;
  /** Resolved absolute path */
  resolvedPath?: string;
  /** Whether the file exists */
  exists: boolean;
}

export interface DependencyEdge {
  from: string;
  to: string;
  type: 'file' | 'package';
}

export interface Cycle {
  nodes: string[];
  severity: 'error' | 'warning';
}

export interface MissingDependency {
  file: string;
  dependency: string;
  type: 'file' | 'import' | 'documentation';
  message: string;
}

export interface DependencyGraph {
  nodes: ScriptNode[];
  edges: DependencyEdge[];
  cycles: Cycle[];
  missing: MissingDependency[];
}

export interface ValidationResult {
  graph: DependencyGraph;
  errors: string[];
  warnings: string[];
  stats: {
    totalFiles: number;
    documented: number;
    undocumented: number;
    circularDependencies: number;
    missingFiles: number;
    missingDocumentation: number;
  };
}

// =============================================================================
// Parsing Functions
// =============================================================================

/**
 * Extract @dependencies section from file content
 */
function extractDependencies(content: string): string[] {
  const match = content.match(/@dependencies\s*\n([\s\S]*?)(?=\n\s*\*\s*@|\n\s*\*\/)/m);
  if (!match) return [];

  const section = match[1];
  const lines = section
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('*') || line.startsWith('-'))
    .map((line) => line.replace(/^\*?\s*-?\s*/, '').trim())
    .filter((line) => line.length > 0 && !line.startsWith('@'));

  return lines;
}

/**
 * Extract @requires section from file content
 */
function extractRequires(content: string): string[] {
  const match = content.match(/@requires\s*\n([\s\S]*?)(?=\n\s*\*\s*@|\n\s*\*\/)/m);
  if (!match) return [];

  const section = match[1];
  const lines = section
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('*') || line.startsWith('-'))
    .map((line) => line.replace(/^\*?\s*-?\s*/, '').trim())
    .filter((line) => line.length > 0 && !line.startsWith('@'));

  return lines;
}

/**
 * Extract actual import statements from file content
 */
function extractActualImports(content: string): string[] {
  const imports: string[] = [];

  // Match import statements
  const importMatches = content.matchAll(
    /import\s+(?:type\s+)?(?:{[^}]+}|[\w*]+)?\s*(?:,\s*{[^}]+})?\s*from\s+['"]([^'"]+)['"]/g,
  );
  for (const match of importMatches) {
    imports.push(match[1]);
  }

  // Match require statements
  const requireMatches = content.matchAll(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/g);
  for (const match of requireMatches) {
    imports.push(match[1]);
  }

  return imports;
}

/**
 * Parse file dependencies from @dependencies section
 */
function parseFileDependencies(
  dependencies: string[],
  currentFile: string,
  rootDir: string,
): FileDependency[] {
  const result: FileDependency[] = [];

  for (const dep of dependencies) {
    // Skip package dependencies (start with @, or no extension)
    if (dep.startsWith('@') || dep.startsWith('node:')) continue;

    // Extract path and description: "path/to/file.ts - Description"
    const match = dep.match(/^([^\s]+(?:\.ts|\.js|\.mjs))\s*-?\s*(.*)$/);
    if (!match) continue;

    const [, depPath, description] = match;

    // Resolve relative path
    let resolvedPath: string | undefined;
    if (depPath.startsWith('.')) {
      // Relative to current file
      const currentDir = resolve(rootDir, join(currentFile, '..'));
      resolvedPath = resolve(currentDir, depPath);
    } else if (depPath.startsWith('scripts/')) {
      // Relative to project root
      resolvedPath = resolve(rootDir, depPath);
    }

    result.push({
      path: depPath,
      description: description.trim(),
      resolvedPath,
      exists: resolvedPath ? existsSync(resolvedPath) : false,
    });
  }

  return result;
}

/**
 * Parse package dependencies from @dependencies section
 */
function parsePackageDependencies(dependencies: string[]): string[] {
  const packages: string[] = [];

  for (const dep of dependencies) {
    // Match package dependencies (start with @ or node:, or no slashes)
    const match = dep.match(/^(@[\w/-]+|node:[\w/]+|[\w-]+)\s*-/);
    if (match) {
      packages.push(match[1]);
    }
  }

  return packages;
}

/**
 * Parse environment variables from @requires section
 */
function parseEnvVariables(requires: string[]): string[] {
  const vars: string[] = [];

  for (const req of requires) {
    const match = req.match(/^Environment:\s*(\w+)/);
    if (match) {
      vars.push(match[1]);
    }
  }

  return vars;
}

/**
 * Parse external tools from @requires section
 */
function parseExternalTools(requires: string[]): string[] {
  const tools: string[] = [];

  for (const req of requires) {
    const match = req.match(/^External:\s*([\w-]+)/);
    if (match) {
      tools.push(match[1]);
    }
  }

  return tools;
}

/**
 * Parse script dependencies from @requires section
 */
function parseScriptDependencies(requires: string[]): string[] {
  const scripts: string[] = [];

  for (const req of requires) {
    const match = req.match(/^Scripts?:\s*([^\s(]+)/);
    if (match) {
      scripts.push(match[1]);
    }
  }

  return scripts;
}

/**
 * Parse a TypeScript file and extract dependency information
 */
function parseScriptFile(filePath: string, rootDir: string): ScriptNode {
  const content = readFileSync(filePath, 'utf-8');
  const relativePath = relative(rootDir, filePath);

  const dependenciesSection = extractDependencies(content);
  const requiresSection = extractRequires(content);
  const actualImports = extractActualImports(content);

  return {
    path: filePath,
    relativePath,
    fileDependencies: parseFileDependencies(dependenciesSection, relativePath, rootDir),
    packageDependencies: parsePackageDependencies(dependenciesSection),
    envVariables: parseEnvVariables(requiresSection),
    externalTools: parseExternalTools(requiresSection),
    scriptDependencies: parseScriptDependencies(requiresSection),
    hasDocumentation: dependenciesSection.length > 0 || requiresSection.length > 0,
    actualImports,
  };
}

// =============================================================================
// Graph Building
// =============================================================================

/**
 * Build dependency graph from all script files
 */
function buildDependencyGraph(rootDir: string, filePattern?: string): DependencyGraph {
  // Find all TypeScript files in scripts/
  const pattern = filePattern || 'scripts/**/*.ts';
  const files = glob.sync(pattern, {
    cwd: rootDir,
    absolute: true,
    ignore: ['**/node_modules/**', '**/dist/**', '**/*.test.ts', '**/*.spec.ts', '**/opensrc/**'],
  });

  logger.info(`Found ${files.length} script files`);

  // Parse all files
  const nodes: ScriptNode[] = files.map((file) => parseScriptFile(file, rootDir));

  // Build edges
  const edges: DependencyEdge[] = [];
  for (const node of nodes) {
    // Add file dependency edges
    for (const dep of node.fileDependencies) {
      if (dep.resolvedPath) {
        edges.push({
          from: node.relativePath,
          to: relative(rootDir, dep.resolvedPath),
          type: 'file',
        });
      }
    }

    // Add package dependency edges
    for (const pkg of node.packageDependencies) {
      edges.push({
        from: node.relativePath,
        to: pkg,
        type: 'package',
      });
    }
  }

  // Detect cycles
  const cycles = detectCycles(nodes, edges);

  // Detect missing dependencies
  const missing = detectMissingDependencies(nodes, rootDir);

  return { nodes, edges, cycles, missing };
}

/**
 * Detect circular dependencies using DFS
 */
function detectCycles(nodes: ScriptNode[], edges: DependencyEdge[]): Cycle[] {
  const cycles: Cycle[] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const pathStack: string[] = [];

  // Build adjacency list (only file dependencies)
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    if (edge.type === 'file') {
      if (!adjacency.has(edge.from)) {
        adjacency.set(edge.from, []);
      }
      adjacency.get(edge.from)?.push(edge.to);
    }
  }

  function dfs(node: string): boolean {
    visited.add(node);
    recursionStack.add(node);
    pathStack.push(node);

    const neighbors = adjacency.get(node) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) return true;
      } else if (recursionStack.has(neighbor)) {
        // Found cycle
        const cycleStart = pathStack.indexOf(neighbor);
        const cyclePath = pathStack.slice(cycleStart).concat(neighbor);
        cycles.push({
          nodes: cyclePath,
          severity: 'error',
        });
        return true;
      }
    }

    recursionStack.delete(node);
    pathStack.pop();
    return false;
  }

  for (const node of nodes) {
    if (!visited.has(node.relativePath)) {
      dfs(node.relativePath);
    }
  }

  return cycles;
}

/**
 * Detect missing dependencies and undocumented files
 */
function detectMissingDependencies(nodes: ScriptNode[], _rootDir: string): MissingDependency[] {
  const missing: MissingDependency[] = [];

  for (const node of nodes) {
    // Check for missing file dependencies
    for (const dep of node.fileDependencies) {
      if (!dep.exists) {
        missing.push({
          file: node.relativePath,
          dependency: dep.path,
          type: 'file',
          message: `File dependency does not exist: ${dep.path}`,
        });
      }
    }

    // Check for undocumented dependencies
    if (!node.hasDocumentation) {
      missing.push({
        file: node.relativePath,
        dependency: '',
        type: 'documentation',
        message: 'Missing @dependencies documentation',
      });
    }

    // Check if actual imports are documented
    for (const imp of node.actualImports) {
      if (imp.startsWith('.') || imp.startsWith('scripts/')) {
        // It's a local file import - check if it's in @dependencies
        const isDocumented = node.fileDependencies.some(
          (dep) => dep.path.includes(imp) || imp.includes(dep.path),
        );

        if (!isDocumented && node.hasDocumentation) {
          missing.push({
            file: node.relativePath,
            dependency: imp,
            type: 'import',
            message: `Import "${imp}" not documented in @dependencies`,
          });
        }
      }
    }
  }

  return missing;
}

// =============================================================================
// Validation
// =============================================================================

/**
 * Validate dependency graph and generate report
 */
export function validateDependencies(
  rootDir: string,
  options: {
    filePattern?: string;
    verbose?: boolean;
  } = {},
): ValidationResult {
  const { filePattern, verbose = true } = options;

  if (verbose) {
    logger.info('Validating script dependencies...');
  }

  const graph = buildDependencyGraph(rootDir, filePattern);

  const errors: string[] = [];
  const warnings: string[] = [];

  // Process cycles
  for (const cycle of graph.cycles) {
    const message = `Circular dependency detected: ${cycle.nodes.join(' → ')}`;
    if (cycle.severity === 'error') {
      errors.push(message);
    } else {
      warnings.push(message);
    }
  }

  // Process missing dependencies
  for (const missing of graph.missing) {
    if (missing.type === 'file') {
      errors.push(`[${missing.file}] ${missing.message}`);
    } else if (missing.type === 'import') {
      warnings.push(`[${missing.file}] ${missing.message}`);
    } else if (missing.type === 'documentation') {
      warnings.push(`[${missing.file}] ${missing.message}`);
    }
  }

  // Calculate stats
  const documented = graph.nodes.filter((n) => n.hasDocumentation).length;
  const undocumented = graph.nodes.length - documented;
  const missingFiles = graph.missing.filter((m) => m.type === 'file').length;
  const missingDocs = graph.missing.filter((m) => m.type === 'documentation').length;

  return {
    graph,
    errors,
    warnings,
    stats: {
      totalFiles: graph.nodes.length,
      documented,
      undocumented,
      circularDependencies: graph.cycles.length,
      missingFiles,
      missingDocumentation: missingDocs,
    },
  };
}

// =============================================================================
// CLI
// =============================================================================

if (import.meta.url === `file://${process.argv[1]}`) {
  const rootDir = resolve(join(import.meta.dirname, '../../..'));

  // Parse arguments
  const args = process.argv.slice(2);
  const fileArg = args.find((arg) => arg.startsWith('--file='));
  const jsonOutput = args.includes('--json');
  const verbose = !jsonOutput;

  const filePattern = fileArg ? fileArg.split('=')[1] : undefined;

  // Run validation
  const result = validateDependencies(rootDir, { filePattern, verbose });

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    // Display results
    console.log('\n📊 Dependency Validation Report\n');
    console.log('='.repeat(70));

    console.log('\n📈 Statistics:');
    console.log(`  Total files:              ${result.stats.totalFiles}`);
    console.log(
      `  Documented:               ${result.stats.documented} (${Math.round((result.stats.documented / result.stats.totalFiles) * 100)}%)`,
    );
    console.log(`  Undocumented:             ${result.stats.undocumented}`);
    console.log(`  Circular dependencies:    ${result.stats.circularDependencies}`);
    console.log(`  Missing files:            ${result.stats.missingFiles}`);
    console.log(`  Missing documentation:    ${result.stats.missingDocumentation}`);

    if (result.errors.length > 0) {
      console.log('\n❌ Errors:');
      for (const error of result.errors.slice(0, 20)) {
        console.log(`  ${error}`);
      }
      if (result.errors.length > 20) {
        console.log(`  ... and ${result.errors.length - 20} more errors`);
      }
    }

    if (result.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      for (const warning of result.warnings.slice(0, 20)) {
        console.log(`  ${warning}`);
      }
      if (result.warnings.length > 20) {
        console.log(`  ... and ${result.warnings.length - 20} more warnings`);
      }
    }

    if (result.errors.length === 0 && result.warnings.length === 0) {
      console.log('\n✅ All dependencies validated successfully!');
    }

    console.log(`\n${'='.repeat(70)}`);

    // Exit with error code if there are errors
    if (result.errors.length > 0) {
      process.exit(ErrorCode.VALIDATION_ERROR);
    }
  }
}
