#!/usr/bin/env tsx

/**
 * Documentation Merge Utility
 *
 * Merges multiple documentation files into a single consolidated file.
 * Preserves all content while organizing it logically.
 *
 * Usage:
 *   pnpm tsx scripts/docs/merge-docs.ts <target-file> <source-file1> [source-file2] ...
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { createLogger, getProjectRoot } from '../shared/utils.js'

const logger = createLogger()

interface MergeOptions {
  target: string
  sources: string[]
  dryRun: boolean
  preserveHeaders: boolean
}

async function mergeFiles(options: MergeOptions): Promise<void> {
  const projectRoot = await getProjectRoot(import.meta.url)
  const targetPath = path.join(projectRoot, options.target)

  logger.header('Documentation Merge')

  // Read all source files
  const sourceContents: Array<{
    path: string
    content: string
    title: string
  }> = []

  for (const source of options.sources) {
    const sourcePath = path.join(projectRoot, source)
    try {
      const content = await fs.readFile(sourcePath, 'utf-8')
      const title = extractTitle(content) || path.basename(source, path.extname(source))
      sourceContents.push({ path: source, content, title })
      logger.info(`  ✅ Read: ${source}`)
    } catch (error) {
      logger.error(
        `  ❌ Failed to read ${source}: ${error instanceof Error ? error.message : String(error)}`,
      )
      throw error
    }
  }

  // Build merged content
  let mergedContent = ''

  // Add main title
  const targetTitle =
    extractTitle(sourceContents[0]?.content) ||
    path.basename(options.target, path.extname(options.target))
  mergedContent += `# ${targetTitle}\n\n`
  mergedContent += `*This document was automatically merged from multiple sources.*\n\n`
  mergedContent += `**Last Updated**: ${new Date().toISOString().split('T')[0]}\n\n`
  mergedContent += `---\n\n`

  // Add table of contents if multiple sources
  if (sourceContents.length > 1) {
    mergedContent += `## Table of Contents\n\n`
    for (let i = 0; i < sourceContents.length; i++) {
      mergedContent += `${i + 1}. [${sourceContents[i].title}](#${sourceContents[i].title.toLowerCase().replace(/\s+/g, '-')})\n`
    }
    mergedContent += `\n---\n\n`
  }

  // Merge content from each source
  for (let i = 0; i < sourceContents.length; i++) {
    const { path: sourcePath, content, title } = sourceContents[i]

    if (options.preserveHeaders && sourceContents.length > 1) {
      mergedContent += `## ${title}\n\n`
      mergedContent += `*Source: \`${sourcePath}\`*\n\n`
    }

    // Remove frontmatter and title from content
    let processedContent = content

    // Remove YAML frontmatter
    processedContent = processedContent.replace(/^---\n[\s\S]*?\n---\n/, '')

    // Remove main title (first # heading)
    processedContent = processedContent.replace(/^#\s+.*?\n+/, '')

    // Remove "Last Updated" lines
    processedContent = processedContent.replace(/\*\*Last Updated\*\*:.*?\n+/gi, '')

    mergedContent += processedContent

    if (i < sourceContents.length - 1) {
      mergedContent += `\n\n---\n\n`
    }
  }

  // Add source attribution
  mergedContent += `\n\n---\n\n`
  mergedContent += `## Source Files\n\n`
  mergedContent += `This document was merged from the following files:\n\n`
  for (const source of sourceContents) {
    mergedContent += `- \`${source.path}\`\n`
  }

  if (options.dryRun) {
    logger.warning('\n[DRY RUN] Merged content preview:')
    logger.info('\n' + '='.repeat(80))
    logger.info(mergedContent.substring(0, 2000))
    if (mergedContent.length > 2000) {
      logger.info(`\n... (${mergedContent.length - 2000} more characters)`)
    }
    logger.info('\n' + '='.repeat(80))
    logger.warning('\n[DRY RUN] File was not written. Run without --dry-run to create merged file.')
    return
  }

  // Write merged file
  const targetDir = path.dirname(targetPath)
  await fs.mkdir(targetDir, { recursive: true })
  await fs.writeFile(targetPath, mergedContent, 'utf-8')

  logger.success(`\n✅ Merged ${sourceContents.length} files into: ${options.target}`)

  // Optionally archive source files
  logger.info(`\n💡 Consider archiving source files after verifying the merge:`)
  for (const source of options.sources) {
    logger.info(`  - ${source}`)
  }
}

function extractTitle(content: string): string | null {
  // Try to extract title from first # heading
  const titleMatch = content.match(/^#\s+(.+)$/m)
  if (titleMatch) {
    return titleMatch[1].trim()
  }

  // Try to extract from frontmatter
  const frontmatterMatch = content.match(/^---\n[\s\S]*?title:\s*(.+?)\n/m)
  if (frontmatterMatch) {
    return frontmatterMatch[1].trim().replace(/^["']|["']$/g, '')
  }

  return null
}

async function main() {
  const args = process.argv.slice(2)

  if (args.length < 2) {
    logger.error(
      'Usage: pnpm tsx scripts/docs/merge-docs.ts <target-file> <source-file1> [source-file2] ...',
    )
    logger.info('\nExample:')
    logger.info('  pnpm tsx scripts/docs/merge-docs.ts docs/guides/auth-complete.md docs/AUTH_*.md')
    process.exit(1)
  }

  const dryRun = args.includes('--dry-run') || args.includes('-d')
  const preserveHeaders = !args.includes('--no-headers')

  const target = args.find((arg) => !arg.startsWith('--'))
  const sources = args.filter(
    (arg, index) => index > args.indexOf(target!) && !arg.startsWith('--'),
  )

  if (!target || sources.length === 0) {
    logger.error('Error: Target file and at least one source file are required')
    process.exit(1)
  }

  try {
    await mergeFiles({
      target,
      sources,
      dryRun,
      preserveHeaders,
    })
  } catch (error) {
    logger.error(`Script failed: ${error instanceof Error ? error.message : String(error)}`)
    if (error instanceof Error && error.stack) {
      logger.error(`Stack trace: ${error.stack}`)
    }
    process.exit(1)
  }
}

main()
