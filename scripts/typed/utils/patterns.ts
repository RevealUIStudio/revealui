/**
 * Pattern detection utilities for Cohesion Engine
 */

import {readFile} from '../../../packages/core/src/scripts/utils.ts'
import type {PatternAnalysis,PatternInstance} from '../cohesion/types.ts'

export interface PatternMatcher {
  name: string
  pattern: RegExp
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  description: string
  impact: string
}

export const COMMON_PATTERNS: PatternMatcher[] = [
  {
    name: 'config-import',
    pattern: /^import config from ['"]@revealui\/config['"]/m,
    severity: 'HIGH',
    description: 'Import of @revealui/config (duplicate pattern)',
    impact: 'Developers copy-paste config import pattern',
  },
  {
    name: 'get-revealui-call',
    pattern: /getRevealUI\(\s*\{\s*config/,
    severity: 'HIGH',
    description: 'Call to getRevealUI({ config }) (duplicate pattern)',
    impact: 'Developers copy-paste instance management code',
  },
  {
    name: 'type-assertion-any',
    pattern: /\bas any\b/,
    severity: 'CRITICAL',
    description: 'Type assertion with `as any` (type safety violation)',
    impact: 'Type safety is broken, IDE autocomplete fails',
  },
  {
    name: 'type-assertion-unknown',
    pattern: /\bas unknown\b/,
    severity: 'MEDIUM',
    description: 'Type assertion with `as unknown`',
    impact: 'Type safety is weakened',
  },
  {
    name: 'unscoped-import',
    pattern: /^import .* from ['"]revealui\//m,
    severity: 'MEDIUM',
    description: 'Unscoped import (revealui/ instead of @revealui/)',
    impact: 'Inconsistent import patterns across apps',
  },
  {
    name: 'direct-path-import',
    pattern: /from ['"]\.\.\/\.\.\/packages\//,
    severity: 'HIGH',
    description: 'Direct path import (workaround for TypeScript resolution)',
    impact: 'Framework requires developers to know internal package structure',
  },
]

/**
 * Find pattern instances in a file
 */
export async function findPatternInstances(
  filePath: string,
  matcher: PatternMatcher,
): Promise<PatternInstance[]> {
  try {
    const content = await readFile(filePath)
    const lines = content.split('\n')
    const instances: PatternInstance[] = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (matcher.pattern.test(line)) {
        const before = i > 0 ? lines[i - 1].trim() : undefined
        const after = i < lines.length - 1 ? lines[i + 1].trim() : undefined

        instances.push({
          file: filePath,
          line: i + 1, // 1-indexed
          code: line.trim(),
          context: before || after ? { before, after } : undefined,
        })
      }
    }

    return instances
  } catch (_error) {
    // File doesn't exist or can't be read, skip it
    return []
  }
}

/**
 * Analyze pattern across multiple files
 */
export async function analyzePattern(
  filePaths: string[],
  matcher: PatternMatcher,
): Promise<PatternAnalysis> {
  const allInstances: PatternInstance[] = []

  for (const filePath of filePaths) {
    const instances = await findPatternInstances(filePath, matcher)
    allInstances.push(...instances)
  }

  // Count variations (slight differences in code)
  const codeSignatures = new Set(allInstances.map((inst) => inst.code.replace(/\s+/g, ' ').trim()))
  const variations = codeSignatures.size

  return {
    pattern: matcher.name,
    description: matcher.description,
    instances: allInstances,
    total: allInstances.length,
    variations,
    severity: matcher.severity,
    impact: matcher.impact,
  }
}

/**
 * Find all TypeScript/JavaScript files in directory
 */
export async function findSourceFiles(
  directory: string,
  ignorePatterns: string[] = ['node_modules', '.next', 'dist', '__tests__'],
): Promise<string[]> {
  const { readdir } = await import('node:fs/promises')
  const { join, relative } = await import('node:path')

  const files: string[] = []

  async function traverse(dir: string): Promise<void> {
    try {
      const entries = await readdir(dir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = join(dir, entry.name)
        const relPath = relative(process.cwd(), fullPath)

        // Skip ignored patterns
        if (ignorePatterns.some((pattern) => relPath.includes(pattern))) {
          continue
        }

        if (entry.isDirectory()) {
          await traverse(fullPath)
        } else if (entry.isFile()) {
          const ext = entry.name.split('.').pop()?.toLowerCase()
          if (ext === 'ts' || ext === 'tsx' || ext === 'js' || ext === 'jsx') {
            files.push(fullPath)
          }
        }
      }
    } catch (_error) {
      // Directory doesn't exist or can't be read, skip it
    }
  }

  await traverse(directory)
  return files
}
