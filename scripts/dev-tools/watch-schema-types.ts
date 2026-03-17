#!/usr/bin/env tsx

/**
 * Database Schema Type Watcher
 *
 * Automatically regenerates TypeScript types when database schema files change.
 * Watches Drizzle schema files and triggers type generation on changes.
 *
 * @dependencies
 * - node:fs - File system operations
 * - node:child_process - Command execution
 * - chokidar - File watching
 * - scripts/lib/errors.ts - Error handling
 * - scripts/lib/index.ts - Logger utilities
 *
 * @example
 * ```bash
 * # Start watching for schema changes
 * pnpm dev:watch-types
 *
 * # Watch with verbose logging
 * DB_VERBOSE=true pnpm dev:watch-types
 * ```
 */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { ErrorCode, ScriptError } from '@revealui/scripts/errors.js';
import { createLogger } from '@revealui/scripts/index.js';
import { watch } from 'chokidar';

const logger = createLogger({ prefix: 'TypeWatch' });

interface WatchConfig {
  /** Paths to watch for schema changes */
  schemaPaths: string[];
  /** Command to run for type generation */
  generateCommand: string;
  /** Debounce delay in ms */
  debounceMs: number;
  /** Whether to run generation on startup */
  generateOnStart: boolean;
}

const DEFAULT_CONFIG: WatchConfig = {
  schemaPaths: [
    'packages/db/src/core/**/*.ts',
    'packages/db/src/schema/**/*.ts',
    'packages/contracts/src/schema/**/*.ts',
  ],
  generateCommand: 'pnpm --filter @revealui/db generate:types',
  debounceMs: 1000,
  generateOnStart: true,
};

class SchemaTypeWatcher {
  private config: WatchConfig;
  private isGenerating = false;
  private pendingRegeneration = false;

  constructor(config: Partial<WatchConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Generate types from schema
   */
  private async generateTypes(): Promise<void> {
    if (this.isGenerating) {
      this.pendingRegeneration = true;
      return;
    }

    try {
      this.isGenerating = true;
      this.lastGenerationTime = Date.now();

      logger.info('🔄 Regenerating database types...');

      const startTime = Date.now();
      execSync(this.config.generateCommand, {
        stdio: 'inherit',
        encoding: 'utf-8',
      });

      const duration = Date.now() - startTime;
      logger.success(`✅ Types generated in ${duration}ms`);

      // If another change happened during generation, regenerate
      if (this.pendingRegeneration) {
        this.pendingRegeneration = false;
        this.isGenerating = false;
        setTimeout(() => this.generateTypes(), this.config.debounceMs);
      }
    } catch (error) {
      logger.error(
        `❌ Type generation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.isGenerating = false;
    }
  }

  /**
   * Start watching schema files
   */
  async start(): Promise<void> {
    logger.header('Database Type Watcher');
    logger.info('Watching for schema changes...');
    console.log();

    // Verify schema paths exist
    const existingPaths = this.config.schemaPaths.filter((path) => {
      const exists = existsSync(path.split('/**')[0]);
      if (!exists) {
        logger.warn(`⚠️  Schema path not found: ${path}`);
      }
      return exists;
    });

    if (existingPaths.length === 0) {
      throw new ScriptError('No valid schema paths found to watch', ErrorCode.NOT_FOUND);
    }

    logger.info('Watching paths:');
    for (const path of existingPaths) {
      logger.info(`  - ${path}`);
    }
    console.log();

    // Generate types on startup if configured
    if (this.config.generateOnStart) {
      await this.generateTypes();
      console.log();
    }

    // Set up file watcher
    const watcher = watch(existingPaths, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100,
      },
    });

    let debounceTimeout: NodeJS.Timeout | null = null;

    watcher.on('change', (path) => {
      logger.info(`📝 Schema changed: ${path}`);

      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }

      debounceTimeout = setTimeout(() => {
        this.generateTypes();
      }, this.config.debounceMs);
    });

    watcher.on('add', (path) => {
      logger.info(`➕ Schema added: ${path}`);

      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }

      debounceTimeout = setTimeout(() => {
        this.generateTypes();
      }, this.config.debounceMs);
    });

    watcher.on('unlink', (path) => {
      logger.info(`➖ Schema removed: ${path}`);

      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }

      debounceTimeout = setTimeout(() => {
        this.generateTypes();
      }, this.config.debounceMs);
    });

    watcher.on('error', (error) => {
      logger.error(`❌ Watcher error: ${error.message}`);
    });

    logger.info('👀 Watching for changes... (Press Ctrl+C to stop)');
    console.log();

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      logger.info('\n🛑 Stopping watcher...');
      watcher.close();
      process.exit(ErrorCode.SUCCESS);
    });

    process.on('SIGTERM', () => {
      logger.info('\n🛑 Stopping watcher...');
      watcher.close();
      process.exit(ErrorCode.SUCCESS);
    });
  }
}

/**
 * Main function
 */
async function main() {
  try {
    const watcher = new SchemaTypeWatcher();
    await watcher.start();
  } catch (error) {
    logger.error(
      `Failed to start watcher: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(ErrorCode.EXECUTION_ERROR);
  }
}

main();
