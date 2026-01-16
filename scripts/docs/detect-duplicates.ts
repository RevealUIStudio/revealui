#!/usr/bin/env tsx

/**
 * Duplicate Documentation Detection Script
 *
 * Identifies duplicate or similar documentation files that should be consolidated.
 * Uses content similarity and filename patterns to detect duplicates.
 *
 * Usage:
 *   pnpm tsx scripts/docs/detect-duplicates.ts
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import fg from 'fast-glob'
import { createLogger, getProjectRoot } from '../shared/utils.js'

const logger = createLogger()

interface DuplicateGroup {
  files: string[]
  similarity: number
  reason: string
  suggestedMerge: string
}

interface DuplicateResult {
  groups: DuplicateGroup[]
  totalFiles: number
  duplicateFiles: number
}

// Patterns for detecting similar files
const SIMILARITY_PATTERNS: Array<{
  pattern: RegExp
  description: string
  category: string
}> = [
  {
    pattern: /BRUTAL.*ASSESSMENT/i,
    description: 'Multiple BRUTAL assessment files',
    category: 'assessments',
  },
  {
    pattern: /AUTH.*(DESIGN|STATUS|COMPLETE|MIGRATION|USAGE|EXAMPLES)/i,
    description: 'Multiple auth documentation files',
    category: 'auth',
  },
  {
    pattern: /SYNC.*(STATUS|COMPLETE|VALIDATION|ASSESSMENT|IMPLEMENTATION)/i,
    description: 'Multiple sync documentation files',
    category: 'sync',
  },
  {
    pattern: /TANSTACK.*(DB|BENEFITS|IMPLEMENTATION|CURRENT|ELECTRIC|RESEARCH)/i,
    description: 'Multiple TanStack DB documentation files',
    category: 'tanstack-db',
  },
  {
    pattern: /TYPE.*(SYSTEM|ERROR|FIXES|UNIFICATION|ANALYSIS)/i,
    description: 'Multiple type system documentation files',
    category: 'types',
  },
  {
    pattern: /(COMPLETE|STATUS|FIXES|VERIFICATION|RESULTS)/i,
    description: 'Multiple status/completion files',
    category: 'status',
  },
]

async function calculateSimilarity(content1: string, content2: string): Promise<number> {
  // Simple similarity based on common words
  const words1 = new Set(content1.toLowerCase().split(/\s+/))
  const words2 = new Set(content2.toLowerCase().split(/\s+/))

  const intersection = new Set([...words1].filter((x) => words2.has(x)))
  const union = new Set([...words1, ...words2])

  if (union.size === 0) return 0

  return intersection.size / union.size
}

async function detectDuplicates(): Promise<DuplicateResult> {
  const projectRoot = await getProjectRoot(import.meta.url)

  logger.header('Duplicate Documentation Detection')

  // Find all markdown files
  const docFiles = await fg(['**/*.md'], {
    ignore: ['node_modules/**', '.next/**', 'dist/**', 'docs/archive/**'],
    cwd: projectRoot,
  })

  logger.info(`Analyzing ${docFiles.length} documentation files...\n`)

  const groups = new Map<string, DuplicateGroup>()
  const fileContents = new Map<string, string>()

  // Load file contents
  for (const file of docFiles) {
    try {
      const filePath = path.join(projectRoot, file)
      const content = await fs.readFile(filePath, 'utf-8')
      fileContents.set(file, content)
    } catch (error) {
      logger.warning(`Failed to read ${file}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // Group files by similarity patterns
  for (const pattern of SIMILARITY_PATTERNS) {
    const matchingFiles = docFiles.filter((file) => {
      const baseName = path.basename(file, path.extname(file))
      return pattern.pattern.test(baseName) || pattern.pattern.test(file)
    })

    if (matchingFiles.length > 1) {
      const key = pattern.category
      if (!groups.has(key)) {
        groups.set(key, {
          files: [],
          similarity: 0,
          reason: pattern.description,
          suggestedMerge: `${pattern.category}-consolidated.md`,
        })
      }

      const group = groups.get(key)!
      group.files.push(...matchingFiles)
    }
  }

  // Calculate content similarity for files in same groups
  for (const [key, group] of groups.entries()) {
    if (group.files.length < 2) {
      groups.delete(key)
      continue
    }

    // Calculate average similarity
    let totalSimilarity = 0
    let comparisons = 0

    for (let i = 0; i < group.files.length; i++) {
      for (let j = i + 1; j < group.files.length; j++) {
        const file1 = group.files[i]
        const file2 = group.files[j]

        const content1 = fileContents.get(file1) || ''
        const content2 = fileContents.get(file2) || ''

        if (content1 && content2) {
          const similarity = await calculateSimilarity(content1, content2)
          totalSimilarity += similarity
          comparisons++
        }
      }
    }

    group.similarity = comparisons > 0 ? totalSimilarity / comparisons : 0

    // Remove groups with low similarity
    if (group.similarity < 0.1) {
      groups.delete(key)
    }
  }

  // Sort groups by similarity (highest first)
  const sortedGroups = Array.from(groups.values()).sort((a, b) => b.similarity - a.similarity)

  const duplicateFiles = new Set<string>()
  for (const group of sortedGroups) {
    for (const file of group.files) {
      duplicateFiles.add(file)
    }
  }

  logger.info(`Found ${sortedGroups.length} potential duplicate groups:\n`)

  for (const group of sortedGroups) {
    logger.info(`\n${group.reason} (${group.files.length} files, ${(group.similarity * 100).toFixed(1)}% similar):`)
    for (const file of group.files) {
      logger.info(`  - ${file}`)
    }
    logger.info(`  Suggested merge: ${group.suggestedMerge}`)
  }

  if (sortedGroups.length === 0) {
    logger.info('\nNo duplicate groups found. Documentation is well-organized!')
  }

  return {
    groups: sortedGroups,
    totalFiles: docFiles.length,
    duplicateFiles: duplicateFiles.size,
  }
}

async function main() {
  try {
    const result = await detectDuplicates()

    logger.info(`\n\nSummary:`)
    logger.info(`  Total files analyzed: ${result.totalFiles}`)
    logger.info(`  Files in duplicate groups: ${result.duplicateFiles}`)
    logger.info(`  Duplicate groups found: ${result.groups.length}`)

    if (result.groups.length > 0) {
      logger.info(`\n💡 Consider using pnpm tsx scripts/docs/merge-docs.ts to consolidate these files.`)
    }
  } catch (error) {
    logger.error(`Script failed: ${error instanceof Error ? error.message : String(error)}`)
    if (error instanceof Error && error.stack) {
      logger.error(`Stack trace: ${error.stack}`)
    }
    process.exit(1)
  }
}

main()
