/**
 * Project Path Utilities for RevealUI Scripts
 *
 * Provides consistent path resolution across all scripts,
 * supporting ESM modules without __dirname.
 *
 * @dependencies
 * - node:fs/promises - File system access for package.json lookup
 * - node:path - Path manipulation utilities
 * - node:url - URL to file path conversion for ESM
 */

import { access, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Project root path (cached after first resolution)
 */
let cachedProjectRoot: string | null = null;

/**
 * Gets the directory name from an import.meta.url
 *
 * @example
 * ```typescript
 * const __dirname = getDirname(import.meta.url)
 * ```
 */
export function getDirname(importMetaUrl: string): string {
  return dirname(fileURLToPath(importMetaUrl));
}

/**
 * Gets the filename from an import.meta.url
 *
 * @example
 * ```typescript
 * const __filename = getFilename(import.meta.url)
 * ```
 */
export function getFilename(importMetaUrl: string): string {
  return fileURLToPath(importMetaUrl);
}

/**
 * Resolves the project root by walking up the directory tree
 * looking for package.json with the monorepo name.
 *
 * @param importMetaUrl - The import.meta.url of the calling module
 * @returns The absolute path to the project root
 *
 * @example
 * ```typescript
 * const root = await getProjectRoot(import.meta.url)
 * const configPath = join(root, 'tsconfig.json')
 * ```
 */
export async function getProjectRoot(importMetaUrl: string): Promise<string> {
  // Return cached value if available
  if (cachedProjectRoot) {
    return cachedProjectRoot;
  }

  const __filename = fileURLToPath(importMetaUrl);
  let currentDir = dirname(__filename);

  // Walk up to 10 levels looking for root package.json
  for (let i = 0; i < 10; i++) {
    try {
      const packageJsonPath = resolve(currentDir, 'package.json');
      await access(packageJsonPath);

      // Check if this is the monorepo root
      const content = await readFile(packageJsonPath, 'utf-8');
      const pkg = JSON.parse(content);

      // Look for monorepo indicators
      if (pkg.name === 'reveal-ui' || pkg.workspaces || pkg.private === true) {
        cachedProjectRoot = currentDir;
        return currentDir;
      }
    } catch {
      // package.json doesn't exist or isn't readable, continue up
    }

    const parentDir = resolve(currentDir, '..');
    if (parentDir === currentDir) {
      // Reached filesystem root
      break;
    }
    currentDir = parentDir;
  }

  // Fallback to cwd
  cachedProjectRoot = process.cwd();
  return cachedProjectRoot;
}

/**
 * Synchronous version of getProjectRoot for cases where async isn't practical.
 * Uses process.cwd() as the starting point.
 */
export function getProjectRootSync(): string {
  if (cachedProjectRoot) {
    return cachedProjectRoot;
  }

  // When called without import.meta.url, use cwd as starting point
  let currentDir = process.cwd();

  const fs = require('node:fs');

  for (let i = 0; i < 10; i++) {
    try {
      const packageJsonPath = resolve(currentDir, 'package.json');
      const content = fs.readFileSync(packageJsonPath, 'utf-8');
      const pkg = JSON.parse(content);

      if (pkg.name === 'reveal-ui' || pkg.workspaces || pkg.private === true) {
        cachedProjectRoot = currentDir;
        return currentDir;
      }
    } catch {
      // Continue up
    }

    const parentDir = resolve(currentDir, '..');
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }

  cachedProjectRoot = process.cwd();
  return cachedProjectRoot;
}

/**
 * Resolves a path relative to the project root.
 *
 * @example
 * ```typescript
 * const scriptsDir = await resolvePath(import.meta.url, 'scripts')
 * const config = await resolvePath(import.meta.url, 'tsconfig.json')
 * ```
 */
export async function resolvePath(importMetaUrl: string, ...paths: string[]): Promise<string> {
  const root = await getProjectRoot(importMetaUrl);
  return join(root, ...paths);
}

/**
 * Common project paths
 */
export const paths = {
  /**
   * Get scripts directory path
   */
  scripts: async (importMetaUrl: string) => resolvePath(importMetaUrl, 'scripts'),

  /**
   * Get packages directory path
   */
  packages: async (importMetaUrl: string) => resolvePath(importMetaUrl, 'packages'),

  /**
   * Get apps directory path
   */
  apps: async (importMetaUrl: string) => resolvePath(importMetaUrl, 'apps'),

  /**
   * Get docs directory path
   */
  docs: async (importMetaUrl: string) => resolvePath(importMetaUrl, 'docs'),

  /**
   * Get state directory path (.revealui/state/)
   */
  state: async (importMetaUrl: string) => resolvePath(importMetaUrl, '.revealui', 'state'),

  /**
   * Get backups directory path (.revealui/backups/)
   */
  backups: async (importMetaUrl: string) => resolvePath(importMetaUrl, '.revealui', 'backups'),
};

/**
 * Clears the cached project root (useful for testing)
 */
export function clearProjectRootCache(): void {
  cachedProjectRoot = null;
}
