/**
 * File Scanner Utility
 *
 * Centralized file scanning functionality for generators.
 * Provides consistent file discovery patterns across all generators.
 *
 * @dependencies
 * - node:fs/promises - Async file system operations (readFile, readdir, stat)
 * - node:path - Path manipulation utilities (join, relative)
 * - fast-glob - Efficient pattern-based file matching
 *
 * @example
 * ```typescript
 * // Scan for TypeScript files
 * const files = await scanFiles({
 *   pattern: '**&#47;*.ts',
 *   cwd: 'packages',
 *   ignore: ['**&#47;node_modules/**', '**&#47;dist/**']
 * })
 *
 * // Recursive directory scan
 * for await (const file of scanFilesGenerator({ pattern: '**&#47;*.ts' })) {
 *   console.log(file.path, file.content)
 * }
 * ```
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import glob from 'fast-glob';

// =============================================================================
// Types
// =============================================================================

/**
 * File information returned by scanner
 */
export interface FileInfo {
  /** Absolute path to file */
  path: string;
  /** Relative path from base directory */
  relativePath: string;
  /** File name */
  name: string;
  /** File extension */
  extension: string;
  /** File size in bytes */
  size: number;
  /** File content (if loaded) */
  content?: string;
}

/**
 * Options for file scanning
 */
export interface ScanOptions {
  /** Glob pattern(s) to match files */
  pattern: string | string[];
  /** Base directory to scan from (default: process.cwd()) */
  cwd?: string;
  /** Patterns to ignore */
  ignore?: string[];
  /** Whether to load file contents (default: false) */
  loadContent?: boolean;
  /** Maximum file size to load in bytes (default: 10MB) */
  maxFileSize?: number;
  /** File extensions to include (e.g., ['.ts', '.tsx']) */
  extensions?: string[];
  /** Whether to follow symbolic links (default: false) */
  followSymlinks?: boolean;
}

/**
 * Options for recursive directory scanning
 */
export interface RecursiveScanOptions {
  /** Directory to scan */
  directory: string;
  /** File extensions to include (e.g., ['.ts', '.tsx']) */
  extensions?: string[];
  /** Directories to skip */
  skipDirs?: string[];
  /** Whether to load file contents (default: false) */
  loadContent?: boolean;
  /** Maximum file size to load in bytes (default: 10MB) */
  maxFileSize?: number;
}

// =============================================================================
// Main Scanning Functions
// =============================================================================

/**
 * Scan files using glob patterns
 *
 * @param options - Scan options
 * @returns Array of file information
 *
 * @example
 * ```typescript
 * const tsFiles = await scanFiles({
 *   pattern: '**&#47;*.ts',
 *   cwd: 'src',
 *   ignore: ['**&#47;*.test.ts']
 * })
 * ```
 */
export async function scanFiles(options: ScanOptions): Promise<FileInfo[]> {
  const {
    pattern,
    cwd = process.cwd(),
    ignore = ['**/node_modules/**', '**/dist/**', '**/.git/**'],
    loadContent = false,
    maxFileSize = 10 * 1024 * 1024, // 10MB
    extensions,
    followSymlinks = false,
  } = options;

  // Use fast-glob for efficient file matching
  const files = await glob(pattern, {
    cwd,
    ignore,
    absolute: true,
    followSymbolicLinks: followSymlinks,
    onlyFiles: true,
  });

  // Filter by extension if specified
  const filteredFiles = extensions
    ? files.filter((file) => extensions.some((ext) => file.endsWith(ext)))
    : files;

  // Build file info objects
  const fileInfos: FileInfo[] = [];

  for (const filePath of filteredFiles) {
    try {
      const stats = await stat(filePath);
      const name = filePath.split('/').pop() || '';
      const extension = name.includes('.') ? `.${name.split('.').pop()}` : '';

      const fileInfo: FileInfo = {
        path: filePath,
        relativePath: relative(cwd, filePath),
        name,
        extension,
        size: stats.size,
      };

      // Load content if requested and file size is acceptable
      if (loadContent && stats.size <= maxFileSize) {
        fileInfo.content = await readFile(filePath, 'utf-8');
      }

      fileInfos.push(fileInfo);
    } catch (error) {
      // Skip files that can't be read
      console.warn(`Warning: Could not read file ${filePath}:`, error);
    }
  }

  return fileInfos;
}

/**
 * Scan files using async generator for memory efficiency
 *
 * @param options - Scan options
 * @yields File information one at a time
 *
 * @example
 * ```typescript
 * for await (const file of scanFilesGenerator({ pattern: '**&#47;*.ts' })) {
 *   await processFile(file)
 * }
 * ```
 */
export async function* scanFilesGenerator(options: ScanOptions): AsyncGenerator<FileInfo> {
  const {
    pattern,
    cwd = process.cwd(),
    ignore = ['**/node_modules/**', '**/dist/**', '**/.git/**'],
    loadContent = false,
    maxFileSize = 10 * 1024 * 1024,
    extensions,
    followSymlinks = false,
  } = options;

  const files = await glob(pattern, {
    cwd,
    ignore,
    absolute: true,
    followSymbolicLinks: followSymlinks,
    onlyFiles: true,
  });

  const filteredFiles = extensions
    ? files.filter((file) => extensions.some((ext) => file.endsWith(ext)))
    : files;

  for (const filePath of filteredFiles) {
    try {
      const stats = await stat(filePath);
      const name = filePath.split('/').pop() || '';
      const extension = name.includes('.') ? `.${name.split('.').pop()}` : '';

      const fileInfo: FileInfo = {
        path: filePath,
        relativePath: relative(cwd, filePath),
        name,
        extension,
        size: stats.size,
      };

      if (loadContent && stats.size <= maxFileSize) {
        fileInfo.content = await readFile(filePath, 'utf-8');
      }

      yield fileInfo;
    } catch (error) {
      console.warn(`Warning: Could not read file ${filePath}:`, error);
    }
  }
}

/**
 * Recursively scan directory for files
 *
 * @param options - Recursive scan options
 * @returns Array of file information
 *
 * @example
 * ```typescript
 * const files = await scanDirectoryRecursive({
 *   directory: 'src',
 *   extensions: ['.ts', '.tsx'],
 *   skipDirs: ['node_modules', 'dist']
 * })
 * ```
 */
export async function scanDirectoryRecursive(options: RecursiveScanOptions): Promise<FileInfo[]> {
  const {
    directory,
    extensions,
    skipDirs = ['node_modules', 'dist', '.git', 'coverage'],
    loadContent = false,
    maxFileSize = 10 * 1024 * 1024,
  } = options;

  const files: FileInfo[] = [];

  async function scan(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip directories in skipDirs list
        if (!skipDirs.includes(entry.name)) {
          await scan(fullPath);
        }
      } else if (entry.isFile()) {
        // Check extension filter
        if (!extensions || extensions.some((ext) => entry.name.endsWith(ext))) {
          const stats = await stat(fullPath);
          const extension = entry.name.includes('.') ? `.${entry.name.split('.').pop()}` : '';

          const fileInfo: FileInfo = {
            path: fullPath,
            relativePath: relative(directory, fullPath),
            name: entry.name,
            extension,
            size: stats.size,
          };

          if (loadContent && stats.size <= maxFileSize) {
            fileInfo.content = await readFile(fullPath, 'utf-8');
          }

          files.push(fileInfo);
        }
      }
    }
  }

  await scan(directory);
  return files;
}

// =============================================================================
// Filter Utilities
// =============================================================================

/**
 * Filter files by extension
 *
 * @param files - Array of file paths or FileInfo objects
 * @param extensions - Extensions to match (e.g., ['.ts', '.tsx'])
 * @returns Filtered files
 */
export function filterByExtension<T extends string | FileInfo>(
  files: T[],
  extensions: string[],
): T[] {
  return files.filter((file) => {
    const filePath = typeof file === 'string' ? file : file.path;
    return extensions.some((ext) => filePath.endsWith(ext));
  });
}

/**
 * Filter files by pattern
 *
 * @param files - Array of file paths or FileInfo objects
 * @param pattern - RegExp pattern to match
 * @returns Filtered files
 */
export function filterByPattern<T extends string | FileInfo>(files: T[], pattern: RegExp): T[] {
  return files.filter((file) => {
    const filePath = typeof file === 'string' ? file : file.relativePath;
    return pattern.test(filePath);
  });
}

/**
 * Group files by directory
 *
 * @param files - Array of FileInfo objects
 * @returns Map of directory to files
 */
export function groupByDirectory(files: FileInfo[]): Map<string, FileInfo[]> {
  const groups = new Map<string, FileInfo[]>();

  for (const file of files) {
    // Use relativePath and extract directory
    const lastSlash = file.relativePath.lastIndexOf('/');
    const dir = lastSlash >= 0 ? file.relativePath.substring(0, lastSlash) : '.';

    if (!groups.has(dir)) {
      groups.set(dir, []);
    }
    groups.get(dir)?.push(file);
  }

  return groups;
}
