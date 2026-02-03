/**
 * Miscellaneous Utility Functions
 *
 * These functions are migrated from the legacy utils files
 * to provide backward compatibility.
 */

import { access, readFile } from 'node:fs/promises'
import { createInterface } from 'node:readline'

/**
 * Reads a file and returns its contents as a string.
 *
 * @example
 * ```typescript
 * const content = await readFileContent('./config.json')
 * ```
 */
export async function readFileContent(filePath: string): Promise<string> {
  return readFile(filePath, 'utf-8')
}

/**
 * Writes content to a file.
 *
 * @example
 * ```typescript
 * await writeFileContent('./output.txt', 'Hello, world!')
 * ```
 */
export async function writeFileContent(filePath: string, content: string): Promise<void> {
  const { writeFile: fsWriteFile } = await import('node:fs/promises')
  await fsWriteFile(filePath, content, 'utf-8')
}

/**
 * Checks if a file exists.
 *
 * @example
 * ```typescript
 * if (await fileExists('./config.json')) {
 *   // File exists
 * }
 * ```
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

/**
 * Reads a file and returns true if it exists and has content.
 * Returns false if the file doesn't exist.
 */
export async function readFileIfExists(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, 'utf-8')
  } catch {
    return null
  }
}

/**
 * Prompts the user for input and returns their response.
 *
 * @example
 * ```typescript
 * const name = await prompt('Enter your name: ')
 * ```
 */
export async function prompt(question: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer)
    })
  })
}

/**
 * Prompts the user for confirmation (yes/no).
 *
 * @example
 * ```typescript
 * if (await confirm('Are you sure?')) {
 *   // User confirmed
 * }
 * ```
 */
export async function confirm(question: string, defaultValue = false): Promise<boolean> {
  const suffix = defaultValue ? '(Y/n)' : '(y/N)'
  const answer = await prompt(`${question} ${suffix}: `)
  const trimmed = answer.trim().toLowerCase()

  if (!trimmed) {
    return defaultValue
  }

  return trimmed === 'y' || trimmed === 'yes'
}

/**
 * Sleeps for the specified number of milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Waits for a condition to be true, polling at regular intervals.
 *
 * @param condition - Function that returns true when the condition is met
 * @param timeout - Maximum time to wait in milliseconds (default: 30000)
 * @param interval - Polling interval in milliseconds (default: 1000)
 * @returns True if condition was met, false if timeout
 *
 * @example
 * ```typescript
 * await waitFor(() => serverIsReady(), 10000)
 * ```
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout = 30000,
  interval = 1000,
): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const result = await condition()
    if (result) return true
    await sleep(interval)
  }
  return false
}

/**
 * Generates a random ID string.
 */
export function generateId(prefix = '', length = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let id = prefix ? `${prefix}-` : ''
  for (let i = 0; i < length; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return id
}

/**
 * Formats bytes into a human-readable string.
 */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex++
  }

  return `${value.toFixed(unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`
}

/**
 * Formats a duration in milliseconds into a human-readable string.
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`
}

/**
 * Truncates a string to a maximum length.
 */
export function truncate(str: string, maxLength: number, suffix = '...'): string {
  if (str.length <= maxLength) return str
  return str.substring(0, maxLength - suffix.length) + suffix
}

/**
 * Ensures a value is an array.
 */
export function ensureArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value]
}

/**
 * Debounces a function call.
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    timeoutId = setTimeout(() => {
      fn(...args)
      timeoutId = null
    }, delay)
  }
}

/**
 * Requires an environment variable to be set.
 * Throws an error if the variable is not defined.
 *
 * @param key - Primary environment variable name
 * @param fallbackKey - Optional fallback variable name
 * @returns The environment variable value
 * @throws Error if neither variable is set
 *
 * @example
 * ```typescript
 * const dbUrl = requireEnv('POSTGRES_URL', 'DATABASE_URL')
 * ```
 */
export function requireEnv(key: string, fallbackKey?: string): string {
  const value = process.env[key]
  if (value) return value

  if (fallbackKey) {
    const fallbackValue = process.env[fallbackKey]
    if (fallbackValue) return fallbackValue
    throw new Error(`Required environment variable ${key} or ${fallbackKey} is not set`)
  }

  throw new Error(`Required environment variable ${key} is not set`)
}

/**
 * Options for dependency validation.
 */
export interface ValidateDependenciesOptions {
  /** Log missing dependencies */
  log?: boolean
  /** Throw on missing dependencies */
  throwOnMissing?: boolean
}

/**
 * Validates that required npm packages are installed.
 *
 * @param packages - List of package names to check
 * @param options - Validation options
 * @returns True if all dependencies are available
 *
 * @example
 * ```typescript
 * await validateDependencies(['pg', 'dotenv'], { log: true })
 * ```
 */
export async function validateDependencies(
  packages: string[],
  options: ValidateDependenciesOptions = {},
): Promise<boolean> {
  const missing: string[] = []

  for (const pkg of packages) {
    try {
      await import(pkg)
    } catch {
      missing.push(pkg)
    }
  }

  if (missing.length > 0) {
    if (options.log) {
      console.error(`Missing dependencies: ${missing.join(', ')}`)
    }
    if (options.throwOnMissing) {
      throw new Error(`Missing dependencies: ${missing.join(', ')}`)
    }
    return false
  }

  return true
}

// =============================================================================
// File System Scanning
// =============================================================================

/**
 * Options for directory scanning
 */
export interface ScanDirectoryOptions {
  /** File extensions to include (e.g., ['.ts', '.tsx']) */
  extensions?: string[]
  /** Directory names to exclude (defaults to common build/cache dirs) */
  excludeDirs?: string[]
  /** Regex patterns to exclude files/directories */
  excludePatterns?: RegExp[]
  /** Include hidden files/directories (starting with .) */
  includeHidden?: boolean
  /** Maximum depth to scan (default: unlimited) */
  maxDepth?: number
  /** Follow symbolic links (default: false) */
  followSymlinks?: boolean
}

/**
 * Default directories to exclude from scanning
 */
const DEFAULT_EXCLUDE_DIRS = [
  'node_modules',
  'dist',
  'build',
  '.next',
  '.turbo',
  '.cursor',
  'coverage',
  '.git',
  '.nuxt',
  '.output',
  '.vercel',
  '.cache',
]

/**
 * Scan a directory recursively for files matching criteria (async generator).
 *
 * This is the most memory-efficient approach for large directories.
 * Use this when processing files one at a time or when dealing with
 * potentially huge file sets. The generator yields files as they're found,
 * allowing immediate processing without loading everything into memory.
 *
 * @param dir - Directory path to scan (absolute or relative)
 * @param options - Scanning options
 * @param options.extensions - File extensions to include (default: ['.ts', '.tsx', '.js', '.jsx'])
 * @param options.excludeDirs - Directory names to exclude (default: node_modules, dist, .next, etc.)
 * @param options.excludePatterns - Regex patterns for paths to exclude
 * @param options.includeHidden - Whether to include hidden files/directories (default: false)
 * @param options.maxDepth - Maximum recursion depth (default: Infinity)
 * @param options.followSymlinks - Whether to follow symbolic links (default: false)
 * @yields Absolute file paths matching the criteria
 *
 * @example
 * ```typescript
 * // Process files one at a time (memory efficient)
 * for await (const file of scanDirectory('./src', { extensions: ['.ts', '.tsx'] })) {
 *   const content = await readFile(file, 'utf-8')
 *   // Process file...
 * }
 *
 * // With custom exclusions
 * for await (const file of scanDirectory('./packages', {
 *   extensions: ['.ts'],
 *   excludeDirs: ['node_modules', '__tests__'],
 *   excludePatterns: [/\.test\.ts$/],
 *   maxDepth: 3
 * })) {
 *   console.log(file)
 * }
 * ```
 *
 * @see {@link scanDirectoryAll} to get all files as an array
 * @see {@link scanDirectorySync} for synchronous version
 */
export async function* scanDirectory(
  dir: string,
  options: ScanDirectoryOptions = {},
): AsyncGenerator<string> {
  const {
    extensions = ['.ts', '.tsx', '.js', '.jsx'],
    excludeDirs = DEFAULT_EXCLUDE_DIRS,
    excludePatterns = [],
    includeHidden = false,
    maxDepth = Infinity,
    followSymlinks = false,
  } = options

  async function* scan(currentDir: string, depth: number): AsyncGenerator<string> {
    if (depth > maxDepth) return

    try {
      const { readdir } = await import('node:fs/promises')
      const entries = await readdir(currentDir, { withFileTypes: true })

      for (const entry of entries) {
        // Skip hidden files/directories unless explicitly included
        if (!includeHidden && entry.name.startsWith('.')) {
          continue
        }

        const fullPath = `${currentDir}/${entry.name}`

        // Skip excluded directories
        if (entry.isDirectory() && excludeDirs.includes(entry.name)) {
          continue
        }

        // Skip files/dirs matching exclude patterns
        if (excludePatterns.some((pattern) => pattern.test(fullPath))) {
          continue
        }

        if (entry.isDirectory()) {
          yield* scan(fullPath, depth + 1)
        } else if (entry.isFile() || (followSymlinks && entry.isSymbolicLink())) {
          // Check file extension
          const ext = entry.name.substring(entry.name.lastIndexOf('.'))
          if (extensions.length === 0 || extensions.includes(ext)) {
            yield fullPath
          }
        }
      }
    } catch (_error) {
      // Skip directories we can't read (permissions, etc.)
      // Silently fail to avoid breaking the scan
    }
  }

  yield* scan(dir, 0)
}

/**
 * Scan a directory and return all matching files as an array (async).
 *
 * Use this when you need all files at once for batch processing or analysis.
 * For large directories (>1000 files), prefer scanDirectory() generator to
 * avoid loading everything into memory at once.
 *
 * @param dir - Directory path to scan (absolute or relative)
 * @param options - Scanning options (same as scanDirectory)
 * @returns Promise resolving to array of absolute file paths
 *
 * @example
 * ```typescript
 * // Get all TypeScript files
 * const files = await scanDirectoryAll('./src', { extensions: ['.ts', '.tsx'] })
 * console.log(`Found ${files.length} TypeScript files`)
 *
 * // Analyze all files at once
 * const result = await analyzeFiles(files, process.cwd())
 *
 * // With custom options
 * const sourceFiles = await scanDirectoryAll('./packages', {
 *   extensions: ['.ts'],
 *   excludeDirs: ['node_modules', 'dist', '__tests__'],
 *   includeHidden: false
 * })
 * ```
 *
 * @see {@link scanDirectory} for memory-efficient generator version
 * @see {@link scanDirectorySync} for synchronous version
 */
export async function scanDirectoryAll(
  dir: string,
  options: ScanDirectoryOptions = {},
): Promise<string[]> {
  const files: string[] = []
  for await (const file of scanDirectory(dir, options)) {
    files.push(file)
  }
  return files
}

/**
 * Scan a directory synchronously (blocking).
 *
 * Use this only when you absolutely must have synchronous file scanning
 * (e.g., in module initialization, config loading). Prefer scanDirectory()
 * or scanDirectoryAll() for better performance and non-blocking I/O.
 * This is provided for backward compatibility with existing scripts.
 *
 * @param dir - Directory path to scan (absolute or relative)
 * @param options - Scanning options (same as scanDirectory)
 * @param options.extensions - File extensions to include (default: ['.ts', '.tsx', '.js', '.jsx'])
 * @param options.excludeDirs - Directory names to exclude
 * @param options.excludePatterns - Regex patterns for paths to exclude
 * @param options.includeHidden - Whether to include hidden files
 * @param options.maxDepth - Maximum recursion depth
 * @param options.followSymlinks - Whether to follow symbolic links
 * @returns Array of absolute file paths
 *
 * @example
 * ```typescript
 * // Basic synchronous scanning
 * const files = scanDirectorySync('./src', { extensions: ['.ts', '.tsx'] })
 * console.log(`Found ${files.length} files`)
 *
 * // In config file where async not available
 * const configFiles = scanDirectorySync('./config', {
 *   extensions: ['.json', '.yaml'],
 *   maxDepth: 2
 * })
 * ```
 *
 * @see {@link scanDirectory} for async generator version
 * @see {@link scanDirectoryAll} for async array version
 */
export function scanDirectorySync(dir: string, options: ScanDirectoryOptions = {}): string[] {
  const {
    extensions = ['.ts', '.tsx', '.js', '.jsx'],
    excludeDirs = DEFAULT_EXCLUDE_DIRS,
    excludePatterns = [],
    includeHidden = false,
    maxDepth = Infinity,
    followSymlinks = false,
  } = options

  const files: string[] = []

  function scan(currentDir: string, depth: number): void {
    if (depth > maxDepth) return

    try {
      const { readdirSync } = require('node:fs')
      const entries = readdirSync(currentDir, { withFileTypes: true })

      for (const entry of entries) {
        // Skip hidden files/directories unless explicitly included
        if (!includeHidden && entry.name.startsWith('.')) {
          continue
        }

        const fullPath = `${currentDir}/${entry.name}`

        // Skip excluded directories
        if (entry.isDirectory() && excludeDirs.includes(entry.name)) {
          continue
        }

        // Skip files/dirs matching exclude patterns
        if (excludePatterns.some((pattern: RegExp) => pattern.test(fullPath))) {
          continue
        }

        if (entry.isDirectory()) {
          scan(fullPath, depth + 1)
        } else if (entry.isFile() || (followSymlinks && entry.isSymbolicLink())) {
          // Check file extension
          const ext = entry.name.substring(entry.name.lastIndexOf('.'))
          if (extensions.length === 0 || extensions.includes(ext)) {
            files.push(fullPath)
          }
        }
      }
    } catch {
      // Skip directories we can't read
    }
  }

  scan(dir, 0)
  return files
}
