/**
 * Fix strategies and utilities for Cohesion Engine
 */

import { readFile, writeFile } from '../../shared/utils.js'
import type { CodeChange, CohesionIssue, FixResult } from '../types.js'

export interface FixStrategy {
  id: string
  name: string
  description: string
  canFix: (issue: CohesionIssue) => boolean
  apply: (issue: CohesionIssue, dryRun?: boolean) => Promise<FixResult>
}

/**
 * Fix strategy: Remove type assertions (as any, as unknown)
 */
const typeAssertionFix: FixStrategy = {
  id: 'type-assertion-removal',
  name: 'Remove Type Assertions',
  description: 'Remove `as any` and `as unknown` type assertions',
  canFix: (issue: CohesionIssue) => {
    return issue.pattern === 'type-assertion-any' || issue.pattern === 'type-assertion-unknown'
  },
  apply: async (issue: CohesionIssue, dryRun = false) => {
    const changes: CodeChange[] = []
    const errors: string[] = []
    const processedFiles = new Set<string>()

    for (const evidence of issue.evidence) {
      if (processedFiles.has(evidence.file)) {
        continue // Process each file once
      }
      processedFiles.add(evidence.file)

      try {
        const content = await readFile(evidence.file)
        const lines = content.split('\n')
        const fileChanges: CodeChange[] = []

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]
          const lineNum = i + 1
          let modified = false
          const before = line
          let after = line

          // Remove `as any` assertions
          if (line.includes(' as any')) {
            after = line.replace(/\s+as\s+any(\s*[;,)]|$)/g, (_match, suffix) => {
              // Keep trailing punctuation/comma
              return suffix || ''
            })
            modified = true
          }

          // Remove `as unknown` assertions (if not already modified)
          if (!modified && line.includes(' as unknown')) {
            after = line.replace(/\s+as\s+unknown(\s*[;,)]|$)/g, (_match, suffix) => {
              return suffix || ''
            })
            modified = true
          }

          if (modified && before.trim() !== after.trim()) {
            fileChanges.push({
              file: evidence.file,
              line: lineNum,
              before: before.trim(),
              after: after.trim(),
            })
            lines[i] = after
          }
        }

        if (fileChanges.length > 0) {
          changes.push(...fileChanges)

          if (!dryRun) {
            const newContent = lines.join('\n')
            await writeFile(evidence.file, newContent)
          }
        }
      } catch (error) {
        errors.push(
          `Failed to process ${evidence.file}: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }

    return {
      success: errors.length === 0 && changes.length > 0,
      file: changes.length > 0 ? changes[0].file : '',
      changes,
      errors: errors.length > 0 ? errors : undefined,
      warnings: dryRun ? ['DRY RUN - No changes applied'] : undefined,
    }
  },
}

/**
 * Fix strategy: Standardize imports (revealui/ -> @revealui/)
 */
const importStandardizationFix: FixStrategy = {
  id: 'import-standardization',
  name: 'Standardize Imports',
  description: 'Convert unscoped imports (revealui/) to scoped imports (@revealui/)',
  canFix: (issue: CohesionIssue) => issue.pattern === 'unscoped-import',
  apply: async (issue: CohesionIssue, dryRun = false) => {
    const changes: CodeChange[] = []
    const errors: string[] = []
    const processedFiles = new Set<string>()

    for (const evidence of issue.evidence) {
      if (processedFiles.has(evidence.file)) {
        continue
      }
      processedFiles.add(evidence.file)

      try {
        const content = await readFile(evidence.file)
        const lines = content.split('\n')
        const fileChanges: CodeChange[] = []

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]
          const lineNum = i + 1

          // Convert 'revealui/' to '@revealui/'
          if (line.includes("from 'revealui/") || line.includes('from "revealui/')) {
            const before = line
            const after = line.replace(/from ['"]revealui\//g, (match) => {
              return match.replace('revealui/', '@revealui/')
            })

            if (before !== after) {
              fileChanges.push({
                file: evidence.file,
                line: lineNum,
                before: before.trim(),
                after: after.trim(),
              })
              lines[i] = after
            }
          }
        }

        if (fileChanges.length > 0) {
          changes.push(...fileChanges)

          if (!dryRun) {
            const newContent = lines.join('\n')
            await writeFile(evidence.file, newContent)
          }
        }
      } catch (error) {
        errors.push(
          `Failed to process ${evidence.file}: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }

    return {
      success: errors.length === 0 && changes.length > 0,
      file: changes.length > 0 ? changes[0].file : '',
      changes,
      errors: errors.length > 0 ? errors : undefined,
      warnings: dryRun ? ['DRY RUN - No changes applied'] : undefined,
    }
  },
}

/**
 * Fix strategy registry
 */
export const FIX_STRATEGIES: FixStrategy[] = [typeAssertionFix, importStandardizationFix]

/**
 * Find applicable fix strategy for an issue
 */
export function findFixStrategy(issue: CohesionIssue): FixStrategy | null {
  for (const strategy of FIX_STRATEGIES) {
    if (strategy.canFix(issue)) {
      return strategy
    }
  }
  return null
}

/**
 * Apply fix strategy to an issue
 */
export async function applyFix(issue: CohesionIssue, dryRun = false): Promise<FixResult> {
  const strategy = findFixStrategy(issue)

  if (!strategy) {
    return {
      success: false,
      file: '',
      changes: [],
      errors: [`No fix strategy available for issue: ${issue.id}`],
    }
  }

  return strategy.apply(issue, dryRun)
}

/**
 * Generate code diff for a fix
 */
export function generateDiff(changes: CodeChange[]): string {
  if (changes.length === 0) {
    return 'No changes'
  }

  let diff = ''

  for (const change of changes) {
    diff += `File: ${change.file}\n`
    diff += `Line ${change.line}:\n`
    diff += `- ${change.before}\n`
    diff += `+ ${change.after}\n`
    diff += '\n'
  }

  return diff
}

/**
 * Validate fix before applying
 */
export async function validateFix(fix: FixResult): Promise<{
  valid: boolean
  errors: string[]
  warnings: string[]
}> {
  const errors: string[] = []
  const warnings: string[] = []

  if (!fix.success) {
    errors.push('Fix reported failure')
  }

  if (fix.changes.length === 0) {
    warnings.push('Fix produces no changes')
  }

  // TODO: Add more validation
  // - Type checking
  // - Build verification
  // - Test execution

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}
