/**
 * Build caching utilities for improved performance.
 *
 * Provides file-based caching with:
 * - Content-based cache keys (hashing)
 * - TTL (time-to-live) support
 * - Cache statistics and metrics
 * - Automatic cleanup of stale entries
 *
 * @dependencies
 * - node:crypto - Hash generation for cache keys
 * - node:fs/promises - File system operations for cache storage
 * - node:path - Path manipulation utilities
 * - fast-glob - File pattern matching for cache key generation
 *
 * @example
 * ```typescript
 * import { BuildCache } from './cache.js'
 *
 * const cache = new BuildCache({ ttl: 3600000 }) // 1 hour
 *
 * const key = await cache.getCacheKey(['src/**\/*.ts'])
 * if (await cache.isCached(key)) {
 *   await cache.restore(key, 'dist/')
 * } else {
 *   // Build...
 *   await cache.save(key, 'dist/')
 * }
 *
 * const stats = cache.getStats()
 * console.log(`Cache hit rate: ${stats.hitRate}%`)
 * ```
 */

import { createHash } from 'node:crypto';
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import fg from 'fast-glob';
import { ErrorCode, ScriptError } from './errors.js';
import { createLogger } from './logger.js';
import { getProjectRoot } from './paths.js';
import { fileExists, formatBytes, formatDuration } from './utils.js';

const logger = createLogger({ prefix: 'Cache' });

export interface BuildCacheOptions {
  /**
   * Cache directory path (relative to project root)
   * @default '.cache/build'
   */
  cacheDir?: string;

  /**
   * Time-to-live for cache entries in milliseconds
   * @default 86400000 (24 hours)
   */
  ttl?: number;

  /**
   * Enable verbose logging
   * @default false
   */
  verbose?: boolean;

  /**
   * Maximum cache size in bytes (0 = unlimited)
   * @default 1073741824 (1 GB)
   */
  maxSize?: number;
}

export interface CacheEntry {
  /** Cache key */
  key: string;
  /** Timestamp when cached */
  timestamp: number;
  /** Size in bytes */
  size: number;
  /** Original source paths */
  sources: string[];
  /** Cached destination path */
  destination: string;
}

export interface CacheStats {
  /** Total cache hits */
  hits: number;
  /** Total cache misses */
  misses: number;
  /** Cache hit rate percentage */
  hitRate: number;
  /** Total cached entries */
  entries: number;
  /** Total cache size in bytes */
  totalSize: number;
  /** Formatted cache size */
  formattedSize: string;
}

/**
 * Build cache for improved performance.
 */
export class BuildCache {
  private cacheDir: string;
  private ttl: number;
  private verbose: boolean;
  private maxSize: number;
  private stats: { hits: number; misses: number };
  private projectRoot: string | null = null;

  constructor(options: BuildCacheOptions = {}) {
    this.cacheDir = options.cacheDir ?? '.cache/build';
    this.ttl = options.ttl ?? 86_400_000; // 24 hours
    this.verbose = options.verbose ?? false;
    this.maxSize = options.maxSize ?? 1_073_741_824; // 1 GB
    this.stats = { hits: 0, misses: 0 };
  }

  /**
   * Get project root directory.
   */
  private async getRoot(): Promise<string> {
    if (!this.projectRoot) {
      this.projectRoot = await getProjectRoot(import.meta.url);
    }
    return this.projectRoot;
  }

  /**
   * Get absolute cache directory path.
   */
  private async getCacheDir(): Promise<string> {
    const root = await this.getRoot();
    return join(root, this.cacheDir);
  }

  /**
   * Generate cache key from file patterns.
   *
   * Creates a hash of file contents for content-based caching.
   *
   * @param patterns - Glob patterns to include
   * @returns Cache key (SHA256 hash)
   */
  async getCacheKey(patterns: string[]): Promise<string> {
    const root = await this.getRoot();
    const hash = createHash('sha256');

    // Resolve all patterns to file paths
    const allFiles = await fg(patterns, {
      cwd: root,
      absolute: true,
      onlyFiles: true,
      ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/.next/**'],
    });

    // Sort for consistent hashing
    allFiles.sort();

    if (this.verbose) {
      logger.info(`Hashing ${allFiles.length} files for cache key`);
    }

    // Hash file contents
    for (const file of allFiles) {
      const content = await readFile(file);
      const relativePath = relative(root, file);
      hash.update(relativePath); // Include path in hash
      hash.update(content);
    }

    const key = hash.digest('hex');

    if (this.verbose) {
      logger.info(`Generated cache key: ${key}`);
    }

    return key;
  }

  /**
   * Check if cache entry exists and is valid.
   *
   * @param key - Cache key
   * @returns True if cached and not expired
   */
  async isCached(key: string): Promise<boolean> {
    const cacheDir = await this.getCacheDir();
    const metadataPath = join(cacheDir, key, 'metadata.json');

    if (!(await fileExists(metadataPath))) {
      this.stats.misses++;
      if (this.verbose) {
        logger.info(`Cache miss: ${key}`);
      }
      return false;
    }

    try {
      const content = await readFile(metadataPath, 'utf-8');
      const entry: CacheEntry = JSON.parse(content);

      // Check TTL
      const age = Date.now() - entry.timestamp;
      if (age > this.ttl) {
        if (this.verbose) {
          logger.info(`Cache expired: ${key} (age: ${formatDuration(age)})`);
        }
        // Clean up expired entry
        await this.delete(key);
        this.stats.misses++;
        return false;
      }

      this.stats.hits++;
      if (this.verbose) {
        logger.success(`Cache hit: ${key} (age: ${formatDuration(age)})`);
      }
      return true;
    } catch (error) {
      logger.warn(`Invalid cache metadata for ${key}: ${error}`);
      this.stats.misses++;
      return false;
    }
  }

  /**
   * Restore cached files to destination.
   *
   * @param key - Cache key
   * @param dest - Destination directory
   */
  async restore(key: string, dest: string): Promise<void> {
    const root = await this.getRoot();
    const cacheDir = await this.getCacheDir();
    const entryDir = join(cacheDir, key);
    const metadataPath = join(entryDir, 'metadata.json');

    if (!(await fileExists(metadataPath))) {
      throw new ScriptError(`Cache entry not found: ${key}`, ErrorCode.NOT_FOUND);
    }

    const content = await readFile(metadataPath, 'utf-8');
    const entry: CacheEntry = JSON.parse(content);

    const destPath = join(root, dest);
    const cachedPath = join(entryDir, 'data');

    if (this.verbose) {
      logger.info(`Restoring cache ${key} to ${dest}`);
    }

    // Copy cached files to destination
    await mkdir(destPath, { recursive: true });
    await cp(cachedPath, destPath, { recursive: true });

    if (this.verbose) {
      logger.success(`Restored ${formatBytes(entry.size)} from cache`);
    }
  }

  /**
   * Save files to cache.
   *
   * @param key - Cache key
   * @param source - Source directory to cache
   * @param sourcePaths - Original source paths (for metadata)
   */
  async save(key: string, source: string, sourcePaths: string[] = []): Promise<void> {
    const root = await this.getRoot();
    const cacheDir = await this.getCacheDir();
    const entryDir = join(cacheDir, key);
    const metadataPath = join(entryDir, 'metadata.json');
    const cachedPath = join(entryDir, 'data');

    const sourcePath = join(root, source);

    if (!(await fileExists(sourcePath))) {
      throw new ScriptError(`Source directory not found: ${source}`, ErrorCode.NOT_FOUND);
    }

    if (this.verbose) {
      logger.info(`Saving cache ${key} from ${source}`);
    }

    // Check cache size limit before saving
    const currentSize = await this.getTotalSize();
    const sourceSize = await this.getDirectorySize(sourcePath);

    if (this.maxSize > 0 && currentSize + sourceSize > this.maxSize) {
      logger.warn('Cache size limit reached, cleaning up oldest entries');
      await this.cleanup({ maxSize: this.maxSize - sourceSize });
    }

    // Create cache entry directory
    await mkdir(entryDir, { recursive: true });

    // Copy files to cache
    await cp(sourcePath, cachedPath, { recursive: true });

    // Save metadata
    const entry: CacheEntry = {
      key,
      timestamp: Date.now(),
      size: sourceSize,
      sources: sourcePaths,
      destination: source,
    };

    await writeFile(metadataPath, JSON.stringify(entry, null, 2));

    if (this.verbose) {
      logger.success(`Saved ${formatBytes(sourceSize)} to cache`);
    }
  }

  /**
   * Delete cache entry.
   *
   * @param key - Cache key
   */
  async delete(key: string): Promise<void> {
    const cacheDir = await this.getCacheDir();
    const entryDir = join(cacheDir, key);

    if (await fileExists(entryDir)) {
      await rm(entryDir, { recursive: true, force: true });

      if (this.verbose) {
        logger.info(`Deleted cache entry: ${key}`);
      }
    }
  }

  /**
   * Clear all cache entries.
   */
  async clear(): Promise<void> {
    const cacheDir = await this.getCacheDir();

    if (await fileExists(cacheDir)) {
      await rm(cacheDir, { recursive: true, force: true });
      logger.info('Cache cleared');
    }

    // Reset stats
    this.stats.hits = 0;
    this.stats.misses = 0;
  }

  /**
   * Clean up cache entries based on criteria.
   *
   * @param options - Cleanup options
   */
  async cleanup(
    options: {
      /** Remove entries older than this (ms) */
      olderThan?: number;
      /** Keep total size under this (bytes) */
      maxSize?: number;
    } = {},
  ): Promise<void> {
    const cacheDir = await this.getCacheDir();

    if (!(await fileExists(cacheDir))) {
      return;
    }

    const entries = await this.listEntries();
    let deletedCount = 0;
    let freedSize = 0;

    // Sort by timestamp (oldest first)
    entries.sort((a, b) => a.timestamp - b.timestamp);

    // Delete by age
    if (options.olderThan) {
      const cutoff = Date.now() - options.olderThan;
      for (const entry of entries) {
        if (entry.timestamp < cutoff) {
          await this.delete(entry.key);
          deletedCount++;
          freedSize += entry.size;
        }
      }
    }

    // Delete by size limit
    if (options.maxSize) {
      let currentSize = await this.getTotalSize();
      for (const entry of entries) {
        if (currentSize <= options.maxSize) {
          break;
        }
        await this.delete(entry.key);
        currentSize -= entry.size;
        deletedCount++;
        freedSize += entry.size;
      }
    }

    if (deletedCount > 0) {
      logger.info(`Cleaned up ${deletedCount} cache entries, freed ${formatBytes(freedSize)}`);
    }
  }

  /**
   * List all cache entries.
   *
   * @returns Array of cache entries
   */
  async listEntries(): Promise<CacheEntry[]> {
    const cacheDir = await this.getCacheDir();

    if (!(await fileExists(cacheDir))) {
      return [];
    }

    const entries: CacheEntry[] = [];
    const dirs = await readdir(cacheDir);

    for (const dir of dirs) {
      const metadataPath = join(cacheDir, dir, 'metadata.json');
      if (await fileExists(metadataPath)) {
        try {
          const content = await readFile(metadataPath, 'utf-8');
          const entry: CacheEntry = JSON.parse(content);
          entries.push(entry);
        } catch (error) {
          logger.warn(`Invalid metadata in ${dir}: ${error}`);
        }
      }
    }

    return entries;
  }

  /**
   * Get cache statistics.
   *
   * @returns Cache stats
   */
  async getStats(): Promise<CacheStats> {
    const entries = await this.listEntries();
    const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: Math.round(hitRate * 100) / 100,
      entries: entries.length,
      totalSize,
      formattedSize: formatBytes(totalSize),
    };
  }

  /**
   * Get total cache size in bytes.
   */
  private async getTotalSize(): Promise<number> {
    const entries = await this.listEntries();
    return entries.reduce((sum, entry) => sum + entry.size, 0);
  }

  /**
   * Get directory size in bytes.
   */
  private async getDirectorySize(dir: string): Promise<number> {
    let size = 0;

    try {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        if (entry.isDirectory()) {
          size += await this.getDirectorySize(fullPath);
        } else if (entry.isFile()) {
          const stats = await stat(fullPath);
          size += stats.size;
        }
      }
    } catch (error) {
      logger.warn(`Error calculating directory size for ${dir}: ${error}`);
    }

    return size;
  }

  /**
   * Reset statistics.
   */
  resetStats(): void {
    this.stats.hits = 0;
    this.stats.misses = 0;
  }
}

/**
 * Create a new build cache instance.
 *
 * @param options - Cache options
 * @returns BuildCache instance
 */
export function createCache(options?: BuildCacheOptions): BuildCache {
  return new BuildCache(options);
}
