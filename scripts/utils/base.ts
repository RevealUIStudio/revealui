/**
 * Base Utilities for Cohesion Engine
 *
 * Provides foundational utilities for file operations, logging, and project navigation.
 *
 * @dependencies
 * - node:fs/promises - File system operations
 * - node:path - Path manipulation
 * - node:url - URL utilities for import.meta.url
 */

import { access, constants } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// =============================================================================
// Logger
// =============================================================================

export interface Logger {
  header: (message: string) => void
  info: (message: string) => void
  success: (message: string) => void
  warning: (message: string) => void
  error: (message: string) => void
}

/**
 * Create a simple console logger
 */
export function createLogger(): Logger {
  return {
    header: (message: string) => {
      console.log(`\n${'='.repeat(60)}`)
      console.log(message)
      console.log('='.repeat(60))
    },
    info: (message: string) => {
      console.log(`ℹ ${message}`)
    },
    success: (message: string) => {
      console.log(`✓ ${message}`)
    },
    warning: (message: string) => {
      console.warn(`⚠ ${message}`)
    },
    error: (message: string) => {
      console.error(`✗ ${message}`)
    },
  }
}

// =============================================================================
// File System
// =============================================================================

/**
 * Check if a file exists
 */
export async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK)
    return true
  } catch {
    return false
  }
}

/**
 * Get project root directory from import.meta.url
 */
export async function getProjectRoot(importMetaUrl: string): Promise<string> {
  const currentFile = fileURLToPath(importMetaUrl)
  const currentDir = dirname(currentFile)

  // Navigate up from scripts/utils/ or scripts/gates/cohesion/ to project root
  const possibleRoots = [
    join(currentDir, '../..'), // From scripts/utils/
    join(currentDir, '../../..'), // From scripts/gates/cohesion/
  ]

  for (const root of possibleRoots) {
    const packageJsonPath = join(root, 'package.json')
    if (await fileExists(packageJsonPath)) {
      return root
    }
  }

  throw new Error('Could not find project root (package.json not found)')
}
