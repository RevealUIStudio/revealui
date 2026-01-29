/**
 * Miscellaneous Utility Functions
 *
 * These functions are migrated from the legacy utils files
 * to provide backward compatibility.
 */

import { access, readFile } from 'node:fs/promises'
import { createInterface } from 'node:readline'

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
