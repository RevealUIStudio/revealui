/**
 * Script Registry
 *
 * Manages the centralized catalog of all TypeScript scripts in the project.
 * Provides scanning, querying, and caching capabilities for script discovery.
 *
 * @dependencies
 * - scripts/lib/errors.ts - ErrorCode and ScriptError for validation
 * - scripts/lib/registry/script-metadata.ts - Script metadata type definitions
 * - node:fs/promises - File system operations for registry caching
 * - node:path - Path manipulation utilities
 * - fast-glob - File pattern matching for script discovery
 *
 * @example
 * ```typescript
 * const registry = new ScriptRegistry({ projectRoot: process.cwd() })
 *
 * // Generate registry
 * await registry.generate()
 *
 * // Query scripts
 * const dbScripts = await registry.search({ category: 'database' })
 * const dryRunScripts = await registry.search({ supportsDryRun: true })
 *
 * // Get script info
 * const script = await registry.getScript('backup-database')
 * ```
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import glob from 'fast-glob';
import { ErrorCode, ScriptError } from '../errors.js';
import type {
  ScriptMetadata,
  ScriptRegistryEntry,
  ScriptRegistry as ScriptRegistryType,
  ScriptSearchCriteria,
  ScriptSearchResult,
} from './script-metadata.js';
import { ScriptScanner } from './script-scanner.js';

// =============================================================================
// Constants
// =============================================================================

const REGISTRY_VERSION = '1.0.0';
const REGISTRY_DIR = '.revealui';
const REGISTRY_FILE = 'script-registry.json';
const SCRIPT_PATTERNS = [
  'scripts/**/*.ts',
  '!scripts/**/*.test.ts',
  '!scripts/**/*.spec.ts',
  '!scripts/**/types.ts',
  '!scripts/**/index.ts',
];

// =============================================================================
// Script Registry Class
// =============================================================================

export class ScriptRegistry {
  private projectRoot: string;
  private registryPath: string;
  private cache: Map<string, ScriptMetadata> = new Map();
  private registry: ScriptRegistryType | null = null;

  constructor(options: { projectRoot: string }) {
    this.projectRoot = options.projectRoot;
    this.registryPath = join(this.projectRoot, REGISTRY_DIR, REGISTRY_FILE);
  }

  /**
   * Generate script registry by scanning all TypeScript files
   */
  async generate(
    options: { verbose?: boolean; force?: boolean } = {},
  ): Promise<ScriptRegistryType> {
    const { verbose = false, force = false } = options;

    // Check if registry exists and is recent (unless force)
    if (!force && (await this.isRegistryFresh())) {
      if (verbose) {
        console.log('Registry is fresh, loading from cache...');
      }
      return this.load();
    }

    if (verbose) {
      console.log('Scanning TypeScript scripts...');
    }

    // Find all TypeScript script files
    const files = await glob(SCRIPT_PATTERNS, {
      cwd: this.projectRoot,
      absolute: true,
      ignore: ['node_modules/**'],
    });

    if (verbose) {
      console.log(`Found ${files.length} script files`);
    }

    // Scan each file
    const scanner = new ScriptScanner({
      projectRoot: this.projectRoot,
      extractPerformance: true,
      assessRisk: true,
    });

    const scripts: ScriptMetadata[] = [];
    const errors: Array<{ file: string; error: string }> = [];

    for (const file of files) {
      try {
        const metadata = await scanner.scanScript(file);
        if (metadata) {
          scripts.push(metadata);
          this.cache.set(metadata.name, metadata);

          if (verbose) {
            console.log(`  ✓ ${metadata.name} (${metadata.commands.length} commands)`);
          }
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push({ file, error: errorMsg });

        if (verbose) {
          console.warn(`  ✗ ${file}: ${errorMsg}`);
        }
      }
    }

    if (verbose && errors.length > 0) {
      console.warn(`\nEncountered ${errors.length} errors during scanning`);
    }

    // Build registry
    this.registry = this.buildRegistry(scripts);

    // Save to disk
    await this.save();

    if (verbose) {
      console.log(
        `\nRegistry generated: ${scripts.length} scripts, ${this.registry.stats.totalCommands} commands`,
      );
    }

    return this.registry;
  }

  /**
   * Load registry from disk
   */
  async load(): Promise<ScriptRegistryType> {
    try {
      const content = await readFile(this.registryPath, 'utf-8');
      this.registry = JSON.parse(content);

      if (!this.registry) {
        throw new ScriptError('Failed to parse registry', ErrorCode.EXECUTION_ERROR);
      }

      return this.registry;
    } catch (error) {
      throw new ScriptError(
        `Failed to load registry: ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.EXECUTION_ERROR,
      );
    }
  }

  /**
   * Save registry to disk
   */
  async save(): Promise<void> {
    if (!this.registry) {
      throw new ScriptError('No registry to save', ErrorCode.INVALID_STATE);
    }

    try {
      // Ensure directory exists
      await mkdir(join(this.projectRoot, REGISTRY_DIR), { recursive: true });

      // Write registry
      const content = JSON.stringify(this.registry, null, 2);
      await writeFile(this.registryPath, content, 'utf-8');
    } catch (error) {
      throw new ScriptError(
        `Failed to save registry: ${error instanceof Error ? error.message : String(error)}`,
        ErrorCode.EXECUTION_ERROR,
      );
    }
  }

  /**
   * Search scripts by criteria
   */
  async search(criteria: ScriptSearchCriteria): Promise<ScriptSearchResult[]> {
    if (!this.registry) {
      await this.load();
    }

    if (!this.registry) {
      return [];
    }

    const results: ScriptSearchResult[] = [];

    for (const script of this.registry.scripts) {
      const match = this.matchesCriteria(script, criteria);

      if (match.matches) {
        results.push({
          script,
          score: match.score,
          matches: match.matchedFields,
        });
      }
    }

    // Sort by score (highest first)
    results.sort((a, b) => b.score - a.score);

    return results;
  }

  /**
   * Get a specific script by name
   */
  async getScript(name: string): Promise<ScriptRegistryEntry | null> {
    if (!this.registry) {
      await this.load();
    }

    return this.registry?.scripts.find((s) => s.name === name) || null;
  }

  /**
   * Get scripts by category
   */
  async getByCategory(category: string): Promise<ScriptRegistryEntry[]> {
    if (!this.registry) {
      await this.load();
    }

    return this.registry?.byCategory[category] || [];
  }

  /**
   * Get all categories
   */
  async getCategories(): Promise<string[]> {
    if (!this.registry) {
      await this.load();
    }

    return Object.keys(this.registry?.byCategory ?? {});
  }

  /**
   * Get registry statistics
   */
  async getStats(): Promise<ScriptRegistryType['stats']> {
    if (!this.registry) {
      await this.load();
    }

    // biome-ignore lint/style/noNonNullAssertion: registry is guaranteed to be loaded after this.load()
    return this.registry!.stats;
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Check if registry is fresh (not older than newest script)
   */
  private async isRegistryFresh(): Promise<boolean> {
    try {
      const registry = await this.load();
      const registryTime = new Date(registry.generatedAt).getTime();

      // Check if any script has been modified since registry generation
      for (const script of registry.scripts) {
        const scriptTime = new Date(script.lastModified).getTime();
        if (scriptTime > registryTime) {
          return false;
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Build registry structure from script metadata
   */
  private buildRegistry(scripts: ScriptMetadata[]): ScriptRegistryType {
    // Convert to registry entries
    const entries = scripts.map(this.toRegistryEntry);

    // Group by category
    const byCategory: Record<string, ScriptRegistryEntry[]> = {};
    for (const entry of entries) {
      if (!byCategory[entry.category]) {
        byCategory[entry.category] = [];
      }
      byCategory[entry.category].push(entry);
    }

    // Calculate statistics
    const stats = {
      totalCommands: entries.reduce((sum, e) => sum + e.commands.length, 0),
      scriptsWithDryRun: entries.filter((e) => e.supportsDryRun).length,
      scriptsWithConfirmation: entries.filter((e) => e.requiresConfirmation).length,
      scriptsDeprecated: entries.filter((e) => e.deprecated).length,
      extendsBaseCLI: scripts.filter((s) => s.extendsBaseCLI).length,
      extendsEnhancedCLI: scripts.filter((s) => s.extendsEnhancedCLI).length,
    };

    return {
      version: REGISTRY_VERSION,
      generatedAt: new Date().toISOString(),
      totalScripts: entries.length,
      byCategory,
      scripts: entries,
      stats,
    };
  }

  /**
   * Convert script metadata to registry entry
   */
  private toRegistryEntry(script: ScriptMetadata): ScriptRegistryEntry {
    return {
      name: script.name,
      filePath: script.filePath,
      relativePath: script.relativePath,
      category: script.category,
      description: script.description,
      commands: script.commands.map((c) => c.name),
      supportsDryRun: script.supportsDryRun,
      requiresConfirmation: script.requiresConfirmation,
      tags: script.tags,
      version: script.version,
      deprecated: script.deprecated?.isDeprecated,
      lastModified: script.lastModified.toISOString(),
    };
  }

  /**
   * Check if a script matches search criteria
   */
  private matchesCriteria(
    script: ScriptRegistryEntry,
    criteria: ScriptSearchCriteria,
  ): { matches: boolean; score: number; matchedFields: Array<{ field: string; value: string }> } {
    const matchedFields: Array<{ field: string; value: string }> = [];
    let score = 0;

    // Category filter
    if (criteria.category && script.category !== criteria.category) {
      return { matches: false, score: 0, matchedFields: [] };
    }

    // Dry-run filter
    if (
      criteria.supportsDryRun !== undefined &&
      script.supportsDryRun !== criteria.supportsDryRun
    ) {
      return { matches: false, score: 0, matchedFields: [] };
    }

    // Confirmation filter
    if (
      criteria.requiresConfirmation !== undefined &&
      script.requiresConfirmation !== criteria.requiresConfirmation
    ) {
      return { matches: false, score: 0, matchedFields: [] };
    }

    // Deprecated filter
    if (criteria.includeDeprecated === false && script.deprecated) {
      return { matches: false, score: 0, matchedFields: [] };
    }

    // Command filter
    if (criteria.command && !script.commands.includes(criteria.command)) {
      return { matches: false, score: 0, matchedFields: [] };
    }

    // Tag filter (any match)
    if (criteria.tags && criteria.tags.length > 0) {
      const hasTag = criteria.tags.some((tag) => script.tags.includes(tag));
      if (!hasTag) {
        return { matches: false, score: 0, matchedFields: [] };
      }
      matchedFields.push({ field: 'tags', value: criteria.tags.join(', ') });
      score += 10;
    }

    // Query search (name, description, tags)
    if (criteria.query) {
      const query = criteria.query.toLowerCase();
      let queryMatched = false;

      if (script.name.toLowerCase().includes(query)) {
        matchedFields.push({ field: 'name', value: script.name });
        score += 20;
        queryMatched = true;
      }

      if (script.description.toLowerCase().includes(query)) {
        matchedFields.push({ field: 'description', value: script.description });
        score += 10;
        queryMatched = true;
      }

      const matchingTags = script.tags.filter((tag) => tag.toLowerCase().includes(query));
      if (matchingTags.length > 0) {
        matchedFields.push({ field: 'tags', value: matchingTags.join(', ') });
        score += 5 * matchingTags.length;
        queryMatched = true;
      }

      if (!queryMatched) {
        return { matches: false, score: 0, matchedFields: [] };
      }
    }

    // Base score for all matches
    score += 1;

    return { matches: true, score, matchedFields };
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a script registry instance
 */
export function createScriptRegistry(projectRoot: string): ScriptRegistry {
  return new ScriptRegistry({ projectRoot });
}
