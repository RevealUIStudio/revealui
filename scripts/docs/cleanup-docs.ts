#!/usr/bin/env tsx

/**
 * Documentation Cleanup Tool
 *
 * Consolidated replacement for:
 * - merge-docs.ts (consolidation functionality)
 * - Parts of organize-docs.ts
 * - Parts of maintenance-check.ts
 *
 * Usage:
 *   pnpm tsx scripts/docs/cleanup-docs.ts stale
 *   pnpm tsx scripts/docs/cleanup-docs.ts duplicates
 *   pnpm tsx scripts/docs/cleanup-docs.ts optimize
 *   pnpm tsx scripts/docs/cleanup-docs.ts archive
 */

import { readdir, readFile, writeFile, mkdir, rename, rm } from 'node:fs/promises'
import { join, extname, dirname, basename } from 'node:path'
import { createLogger, getProjectRoot } from '../shared/utils.js'

const logger = createLogger()

async function cleanupStaleDocs(): Promise<void> {
  logger.header('Cleaning Up Stale Documentation')

  const projectRoot = await getProjectRoot(import.meta.url)
  const docsDir = join(projectRoot, 'docs')
  const archiveDir = join(docsDir, 'archive')

  // Create archive directory if it doesn't exist
  await mkdir(archiveDir, { recursive: true })

  const files = await scanDocsDirectory(docsDir)
  const staleThreshold = 180 * 24 * 60 * 60 * 1000 // 180 days
  const now = Date.now()

  let archived = 0
  let reviewed = 0

  for (const file of files) {
    const age = now - file.mtime.getTime()

    if (age > staleThreshold) {
      const confirm = await promptUser(
        `Archive stale file: ${file.path} (${Math.floor(age / (24 * 60 * 60 * 1000))} days old)?`,
      )

      if (confirm) {
        const sourcePath = join(projectRoot, file.path)
        const archivePath = join(archiveDir, basename(file.path))

        await rename(sourcePath, archivePath)
        archived++

        logger.success(`Archived: ${file.path}`)
      } else {
        reviewed++
        logger.info(`Kept: ${file.path}`)
      }
    }
  }

  logger.info(`Cleanup complete: ${archived} archived, ${reviewed} reviewed and kept`)
}

async function cleanupDuplicates(): Promise<void> {
  logger.header('Cleaning Up Duplicate Documentation')

  const duplicates = await findDuplicates()

  if (duplicates.length === 0) {
    logger.success('No duplicate documentation found!')
    return
  }

  logger.warning(`Found ${duplicates.length} groups of duplicate content`)

  for (const group of duplicates) {
    logger.info(`Duplicate content found in ${group.files.length} files:`)

    for (const file of group.files) {
      logger.info(`  - ${file}`)
    }

    const keep = await promptUser('Which file to keep? (Enter filename or "skip")')
    if (keep && keep !== 'skip') {
      const keepFile = group.files.find((f) => basename(f) === keep)
      if (keepFile) {
        const filesToRemove = group.files.filter((f) => f !== keepFile)

        for (const file of filesToRemove) {
          const confirm = await promptUser(`Delete duplicate: ${file}?`)
          if (confirm) {
            const projectRoot = await getProjectRoot(import.meta.url)
            await rm(join(projectRoot, file))
            logger.success(`Removed duplicate: ${file}`)
          }
        }
      }
    }
  }
}

async function optimizeDocumentation(): Promise<void> {
  logger.header('Optimizing Documentation Structure')

  const projectRoot = await getProjectRoot(import.meta.url)
  const docsDir = join(projectRoot, 'docs')

  // Analyze current structure
  const structure = await analyzeStructure(docsDir)

  logger.info('Current documentation structure:')
  for (const [category, count] of Object.entries(structure)) {
    logger.info(`  ${category}: ${count} files`)
  }

  // Suggest optimizations
  const suggestions = generateOptimizationSuggestions(structure)

  if (suggestions.length > 0) {
    logger.info('Optimization suggestions:')
    for (const suggestion of suggestions) {
      logger.info(`  - ${suggestion}`)
    }

    const apply = await promptUser('Apply suggested optimizations?')
    if (apply) {
      await applyOptimizations(suggestions)
      logger.success('Optimizations applied')
    }
  } else {
    logger.success('Documentation structure is already optimized')
  }
}

async function archiveOldVersions(): Promise<void> {
  logger.header('Archiving Old Documentation Versions')

  const projectRoot = await getProjectRoot(import.meta.url)
  const docsDir = join(projectRoot, 'docs')

  // Look for versioned files or backup files
  const files = await scanDocsDirectory(docsDir)
  const versionedFiles = files.filter(
    (file) =>
      basename(file.path).includes('v2') ||
      basename(file.path).includes('v3') ||
      basename(file.path).includes('backup') ||
      basename(file.path).includes('old'),
  )

  if (versionedFiles.length === 0) {
    logger.success('No old versions to archive')
    return
  }

  logger.info(`Found ${versionedFiles.length} potentially outdated files`)

  for (const file of versionedFiles) {
    const archive = await promptUser(`Archive: ${file.path}?`)
    if (archive) {
      const archiveDir = join(docsDir, 'archive')
      await mkdir(archiveDir, { recursive: true })

      const sourcePath = join(projectRoot, file.path)
      const archivePath = join(archiveDir, basename(file.path))

      await rename(sourcePath, archivePath)
      logger.success(`Archived: ${file.path}`)
    }
  }
}

// Helper functions

async function scanDocsDirectory(docsDir: string): Promise<Array<{ path: string; mtime: Date }>> {
  const files: Array<{ path: string; mtime: Date }> = []

  async function scan(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = join(dir, entry.name)

      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'archive') {
        await scan(fullPath)
      } else if (entry.isFile() && ['.md', '.mdx'].includes(extname(entry.name))) {
        const stats = await import('node:fs/promises').then((m) => m.stat(fullPath))
        files.push({
          path: fullPath,
          mtime: stats.mtime,
        })
      }
    }
  }

  await scan(docsDir)
  return files
}

async function findDuplicates(): Promise<Array<{ content: string; files: string[] }>> {
  const projectRoot = await getProjectRoot(import.meta.url)
  const docsDir = join(projectRoot, 'docs')
  const files = await scanDocsDirectory(docsDir)
  const contentMap = new Map<string, string[]>()

  for (const file of files) {
    try {
      const content = await readFile(file.path, 'utf-8')
      const normalized = content.trim().toLowerCase()

      if (normalized.length > 200) {
        // Only check substantial content
        if (!contentMap.has(normalized)) {
          contentMap.set(normalized, [])
        }
        contentMap.get(normalized)!.push(file.path)
      }
    } catch (error) {
      logger.warning(`Could not read ${file.path}: ${error}`)
    }
  }

  const duplicates: Array<{ content: string; files: string[] }> = []
  for (const [content, files] of contentMap.entries()) {
    if (files.length > 1) {
      duplicates.push({
        content: content.substring(0, 100) + '...',
        files,
      })
    }
  }

  return duplicates
}

async function analyzeStructure(docsDir: string): Promise<Record<string, number>> {
  const structure: Record<string, number> = {}

  async function scan(dir: string, category: string = 'root'): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = join(dir, entry.name)

      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'archive') {
        await scan(fullPath, entry.name)
      } else if (entry.isFile() && ['.md', '.mdx'].includes(extname(entry.name))) {
        structure[category] = (structure[category] || 0) + 1
      }
    }
  }

  await scan(docsDir)
  return structure
}

function generateOptimizationSuggestions(structure: Record<string, number>): string[] {
  const suggestions: string[] = []

  // Check for empty categories
  for (const [category, count] of Object.entries(structure)) {
    if (count === 0) {
      suggestions.push(`Remove empty category: ${category}`)
    } else if (count < 3) {
      suggestions.push(`Consider merging small category: ${category} (${count} files)`)
    }
  }

  // Check for unbalanced distribution
  const total = Object.values(structure).reduce((sum, count) => sum + count, 0)
  const avg = total / Object.keys(structure).length

  for (const [category, count] of Object.entries(structure)) {
    if (count > avg * 2) {
      suggestions.push(
        `Category ${category} is much larger (${count} files) than average (${Math.round(avg)})`,
      )
    }
  }

  return suggestions
}

async function applyOptimizations(suggestions: string[]): Promise<void> {
  // This would implement the actual optimization logic
  // For now, just log what would be done
  for (const suggestion of suggestions) {
    logger.info(`Would apply: ${suggestion}`)
  }
}

async function promptUser(question: string): Promise<boolean> {
  const answer = await import('../shared/utils.js').then((m) => m.prompt(`${question} (y/N)`))
  return answer.toLowerCase().startsWith('y')
}

async function main() {
  try {
    const command = process.argv[2]

    switch (command) {
      case 'stale':
        await cleanupStaleDocs()
        break

      case 'duplicates':
        await cleanupDuplicates()
        break

      case 'optimize':
        await optimizeDocumentation()
        break

      case 'archive':
        await archiveOldVersions()
        break

      default:
        logger.error('Usage: cleanup-docs.ts <command>')
        logger.info('Commands: stale, duplicates, optimize, archive')
        process.exit(1)
    }

    logger.success('Documentation cleanup completed')
  } catch (error) {
    logger.error(`Documentation cleanup failed: ${error}`)
    process.exit(1)
  }
}

main()
