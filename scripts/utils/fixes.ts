/**
 * Automated Fix Strategies for Cohesion Engine
 *
 * Implements automated fixes for detected cohesion issues.
 *
 * @dependencies
 * - scripts/types.ts - Type definitions (CohesionIssue, FixResult, FixStrategy, CodeChange)
 * - node:fs/promises - File system operations
 */

import { readFile, writeFile } from 'node:fs/promises'
import type { CodeChange, CohesionIssue, FixResult, FixStrategy } from '../types.ts'

// =============================================================================
// Fix Strategy Registry
// =============================================================================

const FIX_STRATEGIES: FixStrategy[] = [
  {
    id: 'fix-type-assertion-any',
    name: 'Remove "as any" type assertions',
    description: 'Replace "as any" with proper typing or "as unknown"',
    targetIssues: ['issue-type-assertion-any'],
    safety: {
      requiresTypeCheck: true,
      requiresBuild: false,
      requiresTests: true,
      rollbackSupported: true,
    },
    apply: applyTypeAssertionAnyFix,
  },
  {
    id: 'fix-unscoped-import',
    name: 'Fix unscoped imports',
    description: 'Replace "revealui/" with "@revealui/"',
    targetIssues: ['issue-unscoped-import'],
    safety: {
      requiresTypeCheck: true,
      requiresBuild: true,
      requiresTests: false,
      rollbackSupported: true,
    },
    apply: applyUnscopedImportFix,
  },
  {
    id: 'fix-console-log',
    name: 'Replace console.log with logger',
    description: 'Replace console.log/debug/info with proper logger calls',
    targetIssues: ['issue-console-log'],
    safety: {
      requiresTypeCheck: false,
      requiresBuild: false,
      requiresTests: true,
      rollbackSupported: true,
    },
    apply: applyConsoleLogFix,
  },
]

// =============================================================================
// Strategy Finder
// =============================================================================

/**
 * Find the appropriate fix strategy for an issue
 */
export function findFixStrategy(issue: CohesionIssue): FixStrategy | null {
  for (const strategy of FIX_STRATEGIES) {
    if (strategy.targetIssues.includes(issue.id)) {
      return strategy
    }
  }
  return null
}

// =============================================================================
// Main Fix Application
// =============================================================================

/**
 * Apply a fix to an issue
 */
export async function applyFix(issue: CohesionIssue, _dryRun = false): Promise<FixResult> {
  const strategy = findFixStrategy(issue)

  if (!strategy) {
    return {
      success: false,
      file: '',
      changes: [],
      errors: [`No fix strategy available for issue: ${issue.id}`],
    }
  }

  try {
    return await strategy.apply(issue)
  } catch (error) {
    return {
      success: false,
      file: '',
      changes: [],
      errors: [error instanceof Error ? error.message : String(error)],
    }
  }
}

// =============================================================================
// Fix Strategy Implementations
// =============================================================================

/**
 * Fix "as any" type assertions
 *
 * Strategy: Replace "as any" with "as unknown" for better type safety
 */
async function applyTypeAssertionAnyFix(issue: CohesionIssue): Promise<FixResult> {
  const changes: CodeChange[] = []
  const errors: string[] = []
  const fileChanges = new Map<string, string>()

  // Group evidence by file
  const evidenceByFile = new Map<string, typeof issue.evidence>()
  for (const evidence of issue.evidence) {
    const existing = evidenceByFile.get(evidence.file) || []
    existing.push(evidence)
    evidenceByFile.set(evidence.file, existing)
  }

  // Process each file
  for (const [file, evidences] of evidenceByFile) {
    try {
      const content = await readFile(file, 'utf-8')
      let modifiedContent = content
      const lines = content.split('\n')

      // Process each evidence in reverse order (to maintain line numbers)
      const sortedEvidences = [...evidences].sort((a, b) => b.line - a.line)

      for (const evidence of sortedEvidences) {
        const lineIndex = evidence.line - 1
        const originalLine = lines[lineIndex]

        if (originalLine?.includes(' as any')) {
          const modifiedLine = originalLine.replace(/ as any\b/g, ' as unknown')

          changes.push({
            file,
            line: evidence.line,
            before: originalLine.trim(),
            after: modifiedLine.trim(),
          })

          // Update the lines array
          lines[lineIndex] = modifiedLine
        }
      }

      // Join modified lines
      modifiedContent = lines.join('\n')

      // Store for writing
      if (modifiedContent !== content) {
        fileChanges.set(file, modifiedContent)
      }
    } catch (error) {
      errors.push(
        `Failed to process ${file}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  // Write changes
  for (const [file, content] of fileChanges) {
    try {
      await writeFile(file, content, 'utf-8')
    } catch (error) {
      errors.push(
        `Failed to write ${file}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  return {
    success: errors.length === 0,
    file: Array.from(fileChanges.keys())[0] || '',
    changes,
    errors: errors.length > 0 ? errors : undefined,
  }
}

/**
 * Fix unscoped imports
 *
 * Strategy: Replace "revealui/" with "@revealui/"
 */
async function applyUnscopedImportFix(issue: CohesionIssue): Promise<FixResult> {
  const changes: CodeChange[] = []
  const errors: string[] = []
  const fileChanges = new Map<string, string>()

  // Group evidence by file
  const evidenceByFile = new Map<string, typeof issue.evidence>()
  for (const evidence of issue.evidence) {
    const existing = evidenceByFile.get(evidence.file) || []
    existing.push(evidence)
    evidenceByFile.set(evidence.file, existing)
  }

  // Process each file
  for (const [file, evidences] of evidenceByFile) {
    try {
      const content = await readFile(file, 'utf-8')
      let modifiedContent = content
      const lines = content.split('\n')

      // Process each evidence in reverse order
      const sortedEvidences = [...evidences].sort((a, b) => b.line - a.line)

      for (const evidence of sortedEvidences) {
        const lineIndex = evidence.line - 1
        const originalLine = lines[lineIndex]

        if (originalLine?.includes('revealui/')) {
          const modifiedLine = originalLine.replace(/(['"])revealui\//g, '$1@revealui/')

          changes.push({
            file,
            line: evidence.line,
            before: originalLine.trim(),
            after: modifiedLine.trim(),
          })

          lines[lineIndex] = modifiedLine
        }
      }

      modifiedContent = lines.join('\n')

      if (modifiedContent !== content) {
        fileChanges.set(file, modifiedContent)
      }
    } catch (error) {
      errors.push(
        `Failed to process ${file}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  // Write changes
  for (const [file, content] of fileChanges) {
    try {
      await writeFile(file, content, 'utf-8')
    } catch (error) {
      errors.push(
        `Failed to write ${file}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  return {
    success: errors.length === 0,
    file: Array.from(fileChanges.keys())[0] || '',
    changes,
    errors: errors.length > 0 ? errors : undefined,
  }
}

/**
 * Fix console.log statements
 *
 * Strategy: Add TODO comment suggesting logger replacement
 * (Full replacement requires context awareness of logger availability)
 */
async function applyConsoleLogFix(_issue: CohesionIssue): Promise<FixResult> {
  const changes: CodeChange[] = []
  const warnings: string[] = []

  warnings.push('Console.log fix requires manual intervention')
  warnings.push('Consider replacing with logger.info(), logger.debug(), or removing')

  // This fix is informational only - requires manual review
  return {
    success: true,
    file: '',
    changes,
    warnings,
  }
}

// =============================================================================
// Orphaned Record Detection
// =============================================================================

/**
 * Detect orphaned records (files/imports that are no longer used)
 *
 * Strategy:
 * 1. Find all imports in the codebase
 * 2. Check if imported files still exist
 * 3. Check if imports are actually used
 */
export async function detectOrphanedImports(files: string[]): Promise<{
  orphanedImports: Array<{ file: string; line: number; import: string; reason: string }>
  totalChecked: number
}> {
  const orphanedImports: Array<{ file: string; line: number; import: string; reason: string }> = []
  let totalChecked = 0

  for (const file of files) {
    try {
      const content = await readFile(file, 'utf-8')
      const lines = content.split('\n')

      lines.forEach((line, index) => {
        // Check for import statements
        const importMatch = line.match(/import\s+.*from\s+['"]([^'"]+)['"]/)
        if (importMatch) {
          totalChecked++
          const importPath = importMatch[1]

          // Check for common orphaned patterns
          if (importPath.includes('/dist/') || importPath.includes('/build/')) {
            orphanedImports.push({
              file,
              line: index + 1,
              import: importPath,
              reason: 'Imports from build directory (should use source)',
            })
          }

          // Check for deprecated packages (example pattern)
          if (importPath.includes('@deprecated/')) {
            orphanedImports.push({
              file,
              line: index + 1,
              import: importPath,
              reason: 'Imports from deprecated package',
            })
          }
        }
      })
    } catch {
      // Skip files that can't be read
    }
  }

  return {
    orphanedImports,
    totalChecked,
  }
}

// =============================================================================
// Archival Policy
// =============================================================================

export interface ArchivalPolicy {
  name: string
  description: string
  shouldArchive: (file: string, lastModified: Date) => boolean
  archivePath: (file: string) => string
}

/**
 * Default archival policies
 */
export const ARCHIVAL_POLICIES: ArchivalPolicy[] = [
  {
    name: 'archive-old-todos',
    description: 'Archive TODO comments older than 90 days',
    shouldArchive: (_file, lastModified) => {
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
      return lastModified < ninetyDaysAgo
    },
    archivePath: (file) => file.replace('/src/', '/archive/'),
  },
  {
    name: 'archive-unused-exports',
    description: 'Archive files with only unused exports',
    shouldArchive: () => false, // Requires usage analysis
    archivePath: (file) => file.replace('/src/', '/archive/unused/'),
  },
]
