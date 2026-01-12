#!/usr/bin/env tsx

/**
 * Documentation Link Verification
 *
 * Verifies all markdown links in documentation files:
 * - Internal file links
 * - Internal anchor links
 * - External links (optional)
 * - Orphaned files (files not linked from anywhere)
 *
 * Usage:
 *   pnpm docs:verify:links
 */

import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import fg from 'fast-glob'
import { createLogger, getProjectRoot } from '../shared/utils.js'

const logger = createLogger()

interface Link {
  file: string
  line: number
  text: string
  url: string
  type: 'internal' | 'external' | 'anchor'
}

interface LinkIssue {
  file: string
  line: number
  link: string
  issue: string
  type: 'broken-file' | 'broken-anchor' | 'broken-external' | 'orphaned'
}

interface VerificationResult {
  totalLinks: number
  brokenLinks: LinkIssue[]
  orphanedFiles: string[]
  summary: {
    internal: number
    external: number
    anchors: number
    broken: number
  }
}

// Markdown link regex: [text](url) or [text](url "title")
const LINK_REGEX = /\[([^\]]+)\]\(([^)]+)\)/g
// Anchor regex: #heading-text
const _ANCHOR_REGEX = /^#+\s+(.+)$/gm

async function findMarkdownFiles(): Promise<string[]> {
  const files = await fg('**/*.md', {
    ignore: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/docs/archive/**',
      '**/coverage/**',
      '**/.git/**',
      '**/packages/**/node_modules/**',
    ],
    cwd: process.cwd(),
  })
  // Filter out node_modules paths manually as backup
  return files.filter((f) => !f.includes('node_modules')).map((f) => path.resolve(process.cwd(), f))
}

function extractLinks(content: string, filePath: string): Link[] {
  const links: Link[] = []
  const lines = content.split('\n')

  lines.forEach((line, index) => {
    let match: RegExpExecArray | null
    while ((match = LINK_REGEX.exec(line)) !== null) {
      const [, text, url] = match
      const fullUrl = url.split(' ')[0] // Remove title if present

      let type: 'internal' | 'external' | 'anchor'
      if (
        fullUrl.startsWith('http://') ||
        fullUrl.startsWith('https://') ||
        fullUrl.startsWith('mailto:')
      ) {
        type = 'external'
      } else if (fullUrl.startsWith('#')) {
        type = 'anchor'
      } else {
        type = 'internal'
      }

      links.push({
        file: filePath,
        line: index + 1,
        text,
        url: fullUrl,
        type,
      })
    }
  })

  return links
}

function extractAnchors(content: string): Set<string> {
  const anchors = new Set<string>()
  const lines = content.split('\n')

  lines.forEach((line) => {
    const match = line.match(/^#+\s+(.+)$/)
    if (match) {
      const heading = match[1]
      // Convert heading to anchor format (GitHub-style)
      // Remove emojis and special characters, convert to lowercase, replace spaces with hyphens
      const anchor = heading
        .toLowerCase()
        .replace(/[^\w\s-]/g, '') // Remove special chars (including emojis)
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Collapse multiple hyphens
        .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
        .trim()
      if (anchor) {
        anchors.add(`#${anchor}`)
      }
    }
  })

  return anchors
}

async function resolveInternalLink(linkUrl: string, fromFile: string): Promise<string | null> {
  const fromDir = path.dirname(fromFile)
  let targetPath: string

  if (linkUrl.startsWith('/')) {
    // Absolute path from repo root
    targetPath = path.resolve(process.cwd(), linkUrl.slice(1))
  } else {
    // Relative path
    targetPath = path.resolve(fromDir, linkUrl)
  }

  // Check if file exists
  if (existsSync(targetPath)) {
    return targetPath
  }

  // Check with .md extension
  if (!targetPath.endsWith('.md')) {
    const withMd = `${targetPath}.md`
    if (existsSync(withMd)) {
      return withMd
    }
  }

  return null
}

async function verifyLinks(files: string[]): Promise<VerificationResult> {
  const allLinks: Link[] = []
  const fileContents = new Map<string, string>()
  const fileAnchors = new Map<string, Set<string>>()
  const linkedFiles = new Set<string>()

  // Extract all links and anchors
  for (const file of files) {
    const content = await fs.readFile(file, 'utf-8')
    fileContents.set(file, content)
    const links = extractLinks(content, file)
    allLinks.push(...links)
    fileAnchors.set(file, extractAnchors(content))
  }

  const issues: LinkIssue[] = []

  // Verify each link
  for (const link of allLinks) {
    // Skip external links (including mailto) for now
    if (link.type === 'external') {
      continue
    }

    if (link.type === 'internal') {
      const resolved = await resolveInternalLink(link.url, link.file)
      if (!resolved) {
        issues.push({
          file: link.file,
          line: link.line,
          link: link.url,
          issue: `File not found: ${link.url}`,
          type: 'broken-file',
        })
      } else {
        linkedFiles.add(resolved)
        // Check if it's an anchor link
        const [filePath, anchor] = link.url.split('#')
        if (anchor) {
          const targetFile = await resolveInternalLink(filePath, link.file)
          if (targetFile) {
            const anchors = fileAnchors.get(targetFile)
            if (!anchors || !anchors.has(`#${anchor}`)) {
              issues.push({
                file: link.file,
                line: link.line,
                link: link.url,
                issue: `Anchor not found: #${anchor}`,
                type: 'broken-anchor',
              })
            }
          }
        }
      }
    } else if (link.type === 'anchor') {
      // Internal anchor link
      const anchor = link.url
      const anchors = fileAnchors.get(link.file)
      if (!anchors || !anchors.has(anchor)) {
        // Try alternative anchor formats
        const anchorWithoutHash = anchor.slice(1)
        const alternativeFormats = [
          `#${anchorWithoutHash}`,
          `#${anchorWithoutHash.toLowerCase()}`,
          `#${anchorWithoutHash.replace(/_/g, '-')}`,
          `#${anchorWithoutHash.replace(/-/g, '_')}`,
        ]

        const found = alternativeFormats.some((alt) => anchors?.has(alt))
        if (!found) {
          issues.push({
            file: link.file,
            line: link.line,
            link: link.url,
            issue: `Anchor not found: ${anchor}`,
            type: 'broken-anchor',
          })
        }
      }
    }
    // External links: skip for now (can be slow)
  }

  // Find orphaned files (not linked from anywhere)
  const orphanedFiles: string[] = []
  for (const file of files) {
    // Skip root README and docs/README.md (they're entry points)
    if (file.endsWith('README.md') && (file.includes('/README.md') || file.endsWith('README.md'))) {
      continue
    }
    if (!linkedFiles.has(file)) {
      orphanedFiles.push(file)
    }
  }

  return {
    totalLinks: allLinks.length,
    brokenLinks: issues,
    orphanedFiles,
    summary: {
      internal: allLinks.filter((l) => l.type === 'internal').length,
      external: allLinks.filter((l) => l.type === 'external').length,
      anchors: allLinks.filter((l) => l.type === 'anchor').length,
      broken: issues.length,
    },
  }
}

async function generateReport(result: VerificationResult): Promise<string> {
  const lines: string[] = []
  lines.push('# Documentation Link Verification Report')
  lines.push('')
  lines.push(`**Generated**: ${new Date().toISOString()}`)
  lines.push('')
  lines.push('## Summary')
  lines.push('')
  lines.push(`- **Total Links**: ${result.totalLinks}`)
  lines.push(`- **Internal Links**: ${result.summary.internal}`)
  lines.push(`- **External Links**: ${result.summary.external}`)
  lines.push(`- **Anchor Links**: ${result.summary.anchors}`)
  lines.push(`- **Broken Links**: ${result.brokenLinks.length}`)
  lines.push(`- **Orphaned Files**: ${result.orphanedFiles.length}`)
  lines.push('')

  if (result.brokenLinks.length > 0) {
    lines.push('## Broken Links')
    lines.push('')
    for (const issue of result.brokenLinks) {
      lines.push(`### ${path.relative(process.cwd(), issue.file)}:${issue.line}`)
      lines.push('')
      lines.push(`- **Link**: \`${issue.link}\``)
      lines.push(`- **Issue**: ${issue.issue}`)
      lines.push(`- **Type**: ${issue.type}`)
      lines.push('')
    }
  }

  if (result.orphanedFiles.length > 0) {
    lines.push('## Orphaned Files')
    lines.push('')
    lines.push('These files are not linked from anywhere and may be unused:')
    lines.push('')
    for (const file of result.orphanedFiles) {
      lines.push(`- \`${path.relative(process.cwd(), file)}\``)
    }
    lines.push('')
  }

  if (result.brokenLinks.length === 0 && result.orphanedFiles.length === 0) {
    lines.push('✅ **All links verified successfully!**')
    lines.push('')
  }

  return lines.join('\n')
}

async function runVerification() {
  try {
    await getProjectRoot(import.meta.url)
    logger.header('Documentation Link Verification')
    logger.info('Scanning markdown files...')
    const files = await findMarkdownFiles()
    logger.info(`Found ${files.length} markdown files`)

    logger.info('🔗 Verifying links...')
    const result = await verifyLinks(files)

    logger.info(`\n📊 Results:`)
    logger.info(`  Total links: ${result.totalLinks}`)
    logger.info(`  Broken links: ${result.brokenLinks.length}`)
    logger.info(`  Orphaned files: ${result.orphanedFiles.length}`)

    const report = await generateReport(result)
    const reportPath = path.join(process.cwd(), 'docs', 'VERIFICATION-REPORT.md')
    await fs.writeFile(reportPath, report, 'utf-8')
    logger.success(`\n📄 Report written to: ${reportPath}`)

    if (result.brokenLinks.length > 0 || result.orphanedFiles.length > 0) {
      logger.error('\n❌ Issues found. See report for details.')
      process.exit(1)
    } else {
      logger.success('\n✅ All links verified successfully!')
      process.exit(0)
    }
  } catch (error) {
    logger.error(`Verification failed: ${error instanceof Error ? error.message : String(error)}`)
    if (error instanceof Error && error.stack) {
      logger.error(`Stack trace: ${error.stack}`)
    }
    process.exit(1)
  }
}

/**
 * Main function
 */
async function main() {
  try {
    await runVerification()
  } catch (error) {
    logger.error(`Script failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}

main()
