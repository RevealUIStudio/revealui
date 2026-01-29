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
