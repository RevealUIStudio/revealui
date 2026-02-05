/**
 * Pattern Detection Utilities for Cohesion Engine
 *
 * Detects common anti-patterns and cohesion issues in the codebase.
 *
 * @dependencies
 * - scripts/types.ts - Type definitions (PatternAnalysis, PatternInstance)
 * - node:fs/promises - File system operations
 * - node:path - Path manipulation
 */

import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { PatternAnalysis, PatternInstance } from '../types.ts'

// =============================================================================
// Pattern Matchers
// =============================================================================

export interface PatternMatcher {
  pattern: string
  description: string
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  impact: string
  regex: RegExp
  multiline?: boolean
}

export const COMMON_PATTERNS: PatternMatcher[] = [
  {
    pattern: 'config-import-duplicate',
    description: "Duplicate 'import config from @revealui/config'",
    severity: 'MEDIUM',
    impact: 'Code duplication, potential config singleton issues',
    regex: /import\s+config\s+from\s+['"]@revealui\/config['"]/g,
  },
  {
    pattern: 'getRevealUI-duplicate',
    description: 'Duplicate getRevealUI({ config }) calls',
    severity: 'MEDIUM',
    impact: 'Inefficient initialization, potential state issues',
    regex: /getRevealUI\s*\(\s*\{\s*config\s*\}\s*\)/g,
  },
  {
    pattern: 'type-assertion-any',
    description: 'Type assertion using "as any"',
    severity: 'HIGH',
    impact: 'Loss of type safety, potential runtime errors',
    regex: /\s+as\s+any\b/g,
  },
  {
    pattern: 'type-assertion-unknown',
    description: 'Type assertion using "as unknown"',
    severity: 'MEDIUM',
    impact: 'Reduced type safety, may hide type errors',
    regex: /\s+as\s+unknown\b/g,
  },
  {
    pattern: 'unscoped-import',
    description: 'Unscoped import (revealui/ instead of @revealui/)',
    severity: 'LOW',
    impact: 'Inconsistent import patterns, harder to maintain',
    regex: /from\s+['"]revealui\//g,
  },
  {
    pattern: 'direct-path-import',
    description: 'Direct path import workaround (../../packages/)',
    severity: 'HIGH',
    impact: 'Breaks module boundaries, fragile to refactoring',
    regex: /from\s+['"]\.\.(\/\.\.)+\/packages\//g,
  },
  {
    pattern: 'console-log',
    description: 'Console.log statements (should use logger)',
    severity: 'LOW',
    impact: 'Inconsistent logging, harder to control output',
    regex: /console\.(log|debug|info)/g,
  },
  {
    pattern: 'todo-comment',
    description: 'TODO comments in code',
    severity: 'LOW',
    impact: 'Technical debt marker, may indicate incomplete work',
    regex: /\/\/\s*TODO:|\/\*\s*TODO:/gi,
  },
]

// =============================================================================
// File Operations
// =============================================================================

/**
 * Recursively find all source files in a directory
 */
export async function findSourceFiles(directory: string): Promise<string[]> {
  const files: string[] = []

  async function scan(dir: string) {
    try {
      const entries = await readdir(dir)

      for (const entry of entries) {
        const fullPath = join(dir, entry)
        const stats = await stat(fullPath)

        if (stats.isDirectory()) {
          // Skip common ignore patterns
          if (
            !entry.startsWith('.') &&
            entry !== 'node_modules' &&
            entry !== 'dist' &&
            entry !== 'build' &&
            entry !== '__tests__' &&
            entry !== 'coverage'
          ) {
            await scan(fullPath)
          }
        } else if (stats.isFile()) {
          // Include TypeScript and JavaScript files
          if (
            entry.endsWith('.ts') ||
            entry.endsWith('.tsx') ||
            entry.endsWith('.js') ||
            entry.endsWith('.jsx')
          ) {
            // Exclude test files and type definitions
            if (
              !(
                entry.endsWith('.test.ts') ||
                entry.endsWith('.test.tsx') ||
                entry.endsWith('.d.ts')
              )
            ) {
              files.push(fullPath)
            }
          }
        }
      }
    } catch (_error) {
      // Ignore permission errors and continue
    }
  }

  await scan(directory)
  return files
}

// =============================================================================
// Pattern Analysis
// =============================================================================

/**
 * Analyze files for a specific pattern
 */
export async function analyzePattern(
  files: string[],
  matcher: PatternMatcher,
): Promise<PatternAnalysis> {
  const instances: PatternInstance[] = []
  const seenCodes = new Set<string>()

  for (const file of files) {
    try {
      const content = await readFile(file, 'utf-8')
      const lines = content.split('\n')

      // Reset regex lastIndex for global regex
      matcher.regex.lastIndex = 0

      let match = matcher.regex.exec(content)
      while (match !== null) {
        // Find the line number where this match occurs
        let charCount = 0
        let lineNumber = 0
        let lineContent = ''

        for (let i = 0; i < lines.length; i++) {
          charCount += lines[i].length + 1 // +1 for newline
          if (charCount > match.index) {
            lineNumber = i + 1
            lineContent = lines[i].trim()
            break
          }
        }

        instances.push({
          file,
          line: lineNumber,
          code: lineContent,
        })

        // Track unique code patterns
        seenCodes.add(lineContent)

        match = matcher.regex.exec(content)
      }
    } catch (_error) {
      // Skip files that can't be read
    }
  }

  return {
    pattern: matcher.pattern,
    description: matcher.description,
    instances,
    total: instances.length,
    variations: seenCodes.size,
    severity: matcher.severity,
    impact: matcher.impact,
  }
}
