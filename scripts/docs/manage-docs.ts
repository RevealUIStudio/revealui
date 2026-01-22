#!/usr/bin/env tsx

/**
 * Documentation Management Tool
 *
 * Consolidated replacement for:
 * - docs-lifecycle.ts
 * - detect-duplicates.ts
 * - detect-stale-docs.ts
 * - organize-docs.ts
 * - consolidate-root-docs.ts
 * - maintenance-check.ts
 * - review-archive.ts
 *
 * Usage:
 *   pnpm tsx scripts/docs/manage-docs.ts lifecycle
 *   pnpm tsx scripts/docs/manage-docs.ts duplicates
 *   pnpm tsx scripts/docs/manage-docs.ts stale
 *   pnpm tsx scripts/docs/manage-docs.ts organize
 *   pnpm tsx scripts/docs/manage-docs.ts consolidate
 *   pnpm tsx scripts/docs/manage-docs.ts maintenance
 *   pnpm tsx scripts/docs/manage-docs.ts archive
 */

import { readdir, stat, readFile, writeFile } from 'node:fs/promises'
import { join, extname, relative } from 'node:path'
import { createLogger, getProjectRoot } from '../shared/utils.js'

const logger = createLogger()

interface DocFile {
  path: string
  mtime: Date
  size: number
  content?: string
}

interface DuplicateGroup {
  content: string
  files: string[]
}

async function scanDocsDirectory(): Promise<DocFile[]> {
  const projectRoot = await getProjectRoot(import.meta.url)
  const docsDir = join(projectRoot, 'docs')
  const files: DocFile[] = []

  async function scan(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = join(dir, entry.name)

      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        await scan(fullPath)
      } else if (entry.isFile() && ['.md', '.mdx'].includes(extname(entry.name))) {
        const stats = await stat(fullPath)
        files.push({
          path: relative(projectRoot, fullPath),
          mtime: stats.mtime,
          size: stats.size,
        })
      }
    }
  }

  await scan(docsDir)
  return files
}

async function detectDuplicates(): Promise<DuplicateGroup[]> {
  logger.info('Scanning for duplicate documentation content...')

  const files = await scanDocsDirectory()
  const contentMap = new Map<string, string[]>()

  // Read all files and group by content
  for (const file of files) {
    try {
      const content = await readFile(
        join(await getProjectRoot(import.meta.url), file.path),
        'utf-8',
      )
      const normalizedContent = content.trim()

      if (!contentMap.has(normalizedContent)) {
        contentMap.set(normalizedContent, [])
      }
      contentMap.get(normalizedContent)!.push(file.path)
    } catch (error) {
      logger.warning(`Failed to read ${file.path}: ${error}`)
    }
  }

  // Filter to only duplicates (more than 1 file)
  const duplicates: DuplicateGroup[] = []
  for (const [content, files] of contentMap.entries()) {
    if (files.length > 1 && content.length > 100) {
      // Ignore very short duplicates
      duplicates.push({ content, files })
    }
  }

  return duplicates
}

async function detectStaleDocs(daysThreshold = 90): Promise<DocFile[]> {
  logger.info(`Scanning for documentation older than ${daysThreshold} days...`)

  const files = await scanDocsDirectory()
  const threshold = new Date()
  threshold.setDate(threshold.getDate() - daysThreshold)

  return files.filter((file) => file.mtime < threshold)
}

async function organizeDocs(): Promise<void> {
  logger.info('Organizing documentation structure...')

  const projectRoot = await getProjectRoot(import.meta.url)
  const docsDir = join(projectRoot, 'docs')

  // This would implement automatic organization logic
  // For now, just report current structure
  const files = await scanDocsDirectory()

  logger.info(`Found ${files.length} documentation files`)

  // Group by directory
  const byDir = new Map<string, DocFile[]>()
  for (const file of files) {
    const dir = file.path.split('/').slice(0, -1).join('/')
    if (!byDir.has(dir)) {
      byDir.set(dir, [])
    }
    byDir.get(dir)!.push(file)
  }

  for (const [dir, dirFiles] of byDir.entries()) {
    logger.info(`  ${dir}: ${dirFiles.length} files`)
  }
}

async function consolidateRootDocs(): Promise<void> {
  logger.info('Consolidating root documentation files...')

  const projectRoot = await getProjectRoot(import.meta.url)
  const rootFiles = ['README.md', 'CONTRIBUTING.md', 'CHANGELOG.md']

  for (const file of rootFiles) {
    const filePath = join(projectRoot, file)
    try {
      const content = await readFile(filePath, 'utf-8')
      logger.info(`${file}: ${content.length} characters`)
      // Could implement consolidation logic here
    } catch (error) {
      logger.warning(`Could not read ${file}: ${error}`)
    }
  }
}

async function runLifecycleCheck(): Promise<void> {
  logger.header('Documentation Lifecycle Check')

  const duplicates = await detectDuplicates()
  const stale = await detectStaleDocs()

  logger.info(`Found ${duplicates.length} duplicate content groups`)
  logger.info(`Found ${stale.length} stale documentation files`)

  if (duplicates.length > 0) {
    logger.warning('Duplicate content detected:')
    for (const dup of duplicates.slice(0, 5)) {
      logger.warning(`  ${dup.files.length} files with same content`)
      logger.warning(`  Files: ${dup.files.join(', ')}`)
    }
  }

  if (stale.length > 0) {
    logger.warning('Stale documentation detected:')
    for (const file of stale.slice(0, 5)) {
      const days = Math.floor((Date.now() - file.mtime.getTime()) / (1000 * 60 * 60 * 24))
      logger.warning(`  ${file.path}: ${days} days old`)
    }
  }
}

async function maintenanceCheck(): Promise<void> {
  logger.header('Documentation Maintenance Check')

  const files = await scanDocsDirectory()
  let totalSize = 0
  let markdownFiles = 0
  let mdxFiles = 0

  for (const file of files) {
    totalSize += file.size
    if (file.path.endsWith('.md')) markdownFiles++
    if (file.path.endsWith('.mdx')) mdxFiles++
  }

  logger.info(`Total documentation files: ${files.length}`)
  logger.info(`Markdown files: ${markdownFiles}`)
  logger.info(`MDX files: ${mdxFiles}`)
  logger.info(`Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`)

  const recent = files.filter((f) => {
    const days = (Date.now() - f.mtime.getTime()) / (1000 * 60 * 60 * 24)
    return days < 30
  })

  logger.info(`Files updated in last 30 days: ${recent.length}`)
}

async function reviewArchive(): Promise<void> {
  logger.info('Reviewing documentation archive...')

  const projectRoot = await getProjectRoot(import.meta.url)
  const archiveDir = join(projectRoot, 'docs', 'archive')

  try {
    const entries = await readdir(archiveDir, { withFileTypes: true })
    const archivedFiles = entries.filter((e) => e.isFile())

    logger.info(`Found ${archivedFiles.length} archived documentation files`)

    for (const file of archivedFiles.slice(0, 10)) {
      logger.info(`  ${file.name}`)
    }

    if (archivedFiles.length > 10) {
      logger.info(`  ... and ${archivedFiles.length - 10} more`)
    }
  } catch (error) {
    logger.warning(`Archive directory not found or accessible: ${error}`)
  }
}

async function main() {
  try {
    const command = process.argv[2]

    switch (command) {
      case 'lifecycle':
        await runLifecycleCheck()
        break

      case 'duplicates':
        const duplicates = await detectDuplicates()
        logger.header('Duplicate Content Report')
        if (duplicates.length === 0) {
          logger.success('No duplicate content found!')
        } else {
          logger.warning(`Found ${duplicates.length} groups of duplicate content`)
          for (const dup of duplicates) {
            logger.info(`Files: ${dup.files.join(', ')}`)
          }
        }
        break

      case 'stale':
        const stale = await detectStaleDocs()
        logger.header('Stale Documentation Report')
        if (stale.length === 0) {
          logger.success('No stale documentation found!')
        } else {
          logger.warning(`Found ${stale.length} stale files`)
          for (const file of stale) {
            const days = Math.floor((Date.now() - file.mtime.getTime()) / (1000 * 60 * 60 * 24))
            logger.info(`${file.path}: ${days} days old`)
          }
        }
        break

      case 'organize':
        await organizeDocs()
        break

      case 'consolidate':
        await consolidateRootDocs()
        break

      case 'maintenance':
        await maintenanceCheck()
        break

      case 'archive':
        await reviewArchive()
        break

      default:
        logger.error('Usage: manage-docs.ts <command>')
        logger.info(
          'Commands: lifecycle, duplicates, stale, organize, consolidate, maintenance, archive',
        )
        process.exit(1)
    }

    logger.success('Documentation management completed')
  } catch (error) {
    logger.error(`Documentation management failed: ${error}`)
    process.exit(1)
  }
}

main()
