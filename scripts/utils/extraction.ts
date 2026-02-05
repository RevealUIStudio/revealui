/**
 * Code Extraction Utilities for Cohesion Engine
 *
 * Extracts code snippets with context for evidence display.
 *
 * @dependencies
 * - scripts/types.ts - Type definitions (CodeLocation, PatternInstance)
 * - node:fs/promises - File system operations
 */

import { readFile } from 'node:fs/promises'
import type { CodeLocation, PatternInstance } from '../types.ts'

// =============================================================================
// Code Extraction
// =============================================================================

/**
 * Convert a pattern instance to a code location with context
 */
export async function patternInstanceToCodeLocation(
  instance: PatternInstance,
): Promise<CodeLocation> {
  try {
    const content = await readFile(instance.file, 'utf-8')
    const lines = content.split('\n')

    const lineIndex = instance.line - 1 // Convert to 0-based index
    const code = lines[lineIndex]?.trim() || instance.code

    // Get context lines (2 before and 2 after)
    const contextBefore: string[] = []
    const contextAfter: string[] = []

    for (let i = Math.max(0, lineIndex - 2); i < lineIndex; i++) {
      if (lines[i]) {
        contextBefore.push(lines[i])
      }
    }

    for (let i = lineIndex + 1; i <= Math.min(lines.length - 1, lineIndex + 2); i++) {
      if (lines[i]) {
        contextAfter.push(lines[i])
      }
    }

    return {
      file: instance.file,
      line: instance.line,
      code,
      context: {
        before: contextBefore.length > 0 ? contextBefore : undefined,
        after: contextAfter.length > 0 ? contextAfter : undefined,
      },
    }
  } catch (_error) {
    // If we can't read the file, return without context
    return {
      file: instance.file,
      line: instance.line,
      code: instance.code,
    }
  }
}

/**
 * Extract code snippet from file at specific line
 */
export async function extractCodeSnippet(
  file: string,
  line: number,
  contextLines = 2,
): Promise<string[]> {
  try {
    const content = await readFile(file, 'utf-8')
    const lines = content.split('\n')

    const startLine = Math.max(0, line - 1 - contextLines)
    const endLine = Math.min(lines.length, line + contextLines)

    return lines.slice(startLine, endLine)
  } catch (_error) {
    return []
  }
}
