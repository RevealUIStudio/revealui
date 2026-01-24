import fs from 'node:fs/promises'
import path from 'node:path'
import fg from 'fast-glob'
import { type createLogger, getProjectRoot } from '../shared/utils.js'

export interface BrokenReference {
  file: string
  line: number
  reference: string
  target: string
  type: 'link' | 'anchor' | 'path' | 'archived'
  severity: 'error' | 'warning'
  message: string
  suggestion?: string
}

export interface ReferenceReport {
  totalFiles: number
  brokenReferences: BrokenReference[]
  summary: {
    errors: number
    warnings: number
    byType: Record<string, number>
  }
  generatedAt: Date
}

// Patterns for detecting references
export const LINK_PATTERN = /\[([^\]]+)\]\(([^)]+)\)/g
export const ANCHOR_PATTERN = /^#{1,6}\s+(.+)$/gm

export const EXCLUDE_PATTERNS = [
  'node_modules/**',
  '.next/**',
  'dist/**',
  'docs/archive/**',
  '**/coverage/**',
]

/**
 * Extract anchors from a markdown file
 */
export async function extractAnchors(
  filePath: string,
  logger: ReturnType<typeof createLogger>,
): Promise<Set<string>> {
  const anchors = new Set<string>()
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const anchorMatches = [...content.matchAll(ANCHOR_PATTERN)]

    for (const match of anchorMatches) {
      const heading = match[1]
      // Convert heading to anchor format (lowercase, spaces to hyphens, remove special chars)
      const anchor = heading
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim()
      anchors.add(anchor)
    }

    // Add common anchors
    anchors.add('')
    anchors.add('overview')
    anchors.add('introduction')
  } catch (error) {
    if (error instanceof Error) {
      logger.warning(`⚠️  Could not read file to extract anchors: ${filePath} - ${error.message}`)
    } else {
      logger.warning(`⚠️  Could not read file to extract anchors: ${filePath} - Unknown error`)
    }
  }

  return anchors
}

/**
 * Resolve a link target to check if it exists
 */
export async function resolveLinkTarget(
  linkTarget: string,
  sourceFile: string,
  projectRoot: string,
): Promise<{ exists: boolean; path?: string; isArchived?: boolean }> {
  // Skip external links, mailto, anchors
  if (
    linkTarget.startsWith('http://') ||
    linkTarget.startsWith('https://') ||
    linkTarget.startsWith('mailto:')
  ) {
    return { exists: true }
  }

  // Handle anchor-only links
  if (linkTarget.startsWith('#')) {
    return { exists: true } // Will be validated separately
  }

  // Split file path and anchor
  const [filePath, anchor] = linkTarget.split('#')

  // Resolve relative path
  let resolvedPath: string
  if (filePath.startsWith('./') || filePath.startsWith('../')) {
    resolvedPath = path.resolve(path.dirname(sourceFile), filePath)
  } else if (filePath.startsWith('/')) {
    resolvedPath = path.join(projectRoot, filePath.slice(1))
  } else {
    // Relative to current file
    resolvedPath = path.resolve(path.dirname(sourceFile), filePath)
  }

  // Try with .md extension if no extension
  if (!path.extname(resolvedPath)) {
    const mdPath = `${resolvedPath}.md`
    try {
      await fs.access(mdPath)
      resolvedPath = mdPath
    } catch {
      // Try without .md
    }
  }

  // Check if file exists
  try {
    await fs.access(resolvedPath)
    return { exists: true, path: resolvedPath }
  } catch {
    // Check if in archive
    const relativePath = path.relative(projectRoot, resolvedPath)
    if (relativePath.includes('archive') || relativePath.startsWith('docs/archive/')) {
      return { exists: false, isArchived: true }
    }
    return { exists: false, path: resolvedPath }
  }
}

/**
 * Validate references in a single file
 */
export async function validateReferences(
  filePath: string,
  projectRoot: string,
  logger: ReturnType<typeof createLogger>,
): Promise<BrokenReference[]> {
  const issues: BrokenReference[] = []
  let content: string

  try {
    content = await fs.readFile(filePath, 'utf-8')
  } catch (error) {
    if (error instanceof Error) {
      logger.warning(`⚠️  Could not read file: ${filePath} - ${error.message}`)
    }
    return issues
  }

  const lines = content.split('\n')

  // Extract all links
  const linkMatches = [...content.matchAll(LINK_PATTERN)]

  for (const match of linkMatches) {
    const linkText = match[1]
    const linkTarget = match[2]
    const matchIndex = match.index || 0
    const lineNumber = content.substring(0, matchIndex).split('\n').length

    // Skip external links
    if (
      linkTarget.startsWith('http://') ||
      linkTarget.startsWith('https://') ||
      linkTarget.startsWith('mailto:')
    ) {
      continue
    }

    // Handle anchor-only links
    if (linkTarget.startsWith('#')) {
      const anchor = linkTarget.slice(1)
      const anchors = await extractAnchors(filePath, logger)

      if (!anchors.has(anchor) && anchor !== '') {
        issues.push({
          file: path.relative(projectRoot, filePath),
          line: lineNumber,
          reference: `[${linkText}](${linkTarget})`,
          target: linkTarget,
          type: 'anchor',
          severity: 'warning',
          message: `Anchor not found: ${linkTarget}`,
          suggestion: `Verify anchor exists in file: ${filePath}`,
        })
      }
      continue
    }

    // Validate file link
    const [filePathPart, anchor] = linkTarget.split('#')
    const targetResult = await resolveLinkTarget(filePathPart, filePath, projectRoot)

    if (!targetResult.exists) {
      if (targetResult.isArchived) {
        issues.push({
          file: path.relative(projectRoot, filePath),
          line: lineNumber,
          reference: `[${linkText}](${linkTarget})`,
          target: linkTarget,
          type: 'archived',
          severity: 'warning',
          message: `Link points to archived file: ${linkTarget}`,
          suggestion: 'Update link to point to current documentation or remove if obsolete',
        })
      } else {
        issues.push({
          file: path.relative(projectRoot, filePath),
          line: lineNumber,
          reference: `[${linkText}](${linkTarget})`,
          target: linkTarget,
          type: 'link',
          severity: 'error',
          message: `Broken link: ${linkTarget}`,
          suggestion: `Verify file exists: ${targetResult.path || linkTarget}`,
        })
      }
    } else if (targetResult.path && anchor) {
      // Validate anchor in target file
      const anchors = await extractAnchors(targetResult.path, logger)
      if (!anchors.has(anchor)) {
        issues.push({
          file: path.relative(projectRoot, filePath),
          line: lineNumber,
          reference: `[${linkText}](${linkTarget})`,
          target: linkTarget,
          type: 'anchor',
          severity: 'warning',
          message: `Anchor not found in target file: ${anchor}`,
          suggestion: `Verify anchor exists in: ${targetResult.path}`,
        })
      }
    }
  }

  return issues
}

/**
 * Validate all references in the project
 */
export async function validateAllReferences(
  logger: ReturnType<typeof createLogger>,
): Promise<ReferenceReport> {
  const projectRoot = getProjectRoot()
  const files = await fg(['**/*.md'], {
    cwd: projectRoot,
    ignore: EXCLUDE_PATTERNS,
    absolute: true,
  })

  logger.info(`Validating references in ${files.length} markdown files...`)

  const allIssues: BrokenReference[] = []

  for (const file of files) {
    const issues = await validateReferences(file, projectRoot, logger)
    allIssues.push(...issues)
  }

  // Group by type
  const byType: Record<string, number> = {}
  for (const issue of allIssues) {
    byType[issue.type] = (byType[issue.type] || 0) + 1
  }

  const summary = {
    errors: allIssues.filter((i) => i.severity === 'error').length,
    warnings: allIssues.filter((i) => i.severity === 'warning').length,
    byType,
  }

  return {
    totalFiles: files.length,
    brokenReferences: allIssues,
    summary,
    generatedAt: new Date(),
  }
}

/**
 * Generate markdown report
 */
export function generateReportMarkdown(report: ReferenceReport): string {
  const lines: string[] = []

  lines.push('# Reference Validation Report')
  lines.push('')
  lines.push(`**Generated**: ${report.generatedAt.toISOString()}`)
  lines.push(`**Total Files Scanned**: ${report.totalFiles}`)
  lines.push(`**Broken References Found**: ${report.brokenReferences.length}`)
  lines.push('')

  lines.push('## Summary')
  lines.push('')
  lines.push(`- 🔴 **Errors**: ${report.summary.errors}`)
  lines.push(`- 🟡 **Warnings**: ${report.summary.warnings}`)
  lines.push('')

  lines.push('### By Type')
  lines.push('')
  for (const [type, count] of Object.entries(report.summary.byType)) {
    lines.push(`- **${type}**: ${count}`)
  }
  lines.push('')

  if (report.brokenReferences.length === 0) {
    lines.push('✅ **No broken references found!**')
    lines.push('')
    return lines.join('\n')
  }

  // Group by file
  const byFile = new Map<string, BrokenReference[]>()
  for (const issue of report.brokenReferences) {
    if (!byFile.has(issue.file)) {
      byFile.set(issue.file, [])
    }
    byFile.get(issue.file)!.push(issue)
  }

  // Show errors first
  const errors = report.brokenReferences.filter((i) => i.severity === 'error')
  if (errors.length > 0) {
    lines.push('## 🔴 Errors')
    lines.push('')

    const errorByFile = new Map<string, BrokenReference[]>()
    for (const issue of errors) {
      if (!errorByFile.has(issue.file)) {
        errorByFile.set(issue.file, [])
      }
      errorByFile.get(issue.file)!.push(issue)
    }

    for (const [file, fileIssues] of errorByFile.entries()) {
      lines.push(`### ${file}`)
      lines.push('')
      for (const issue of fileIssues) {
        lines.push(`- **Line ${issue.line}**: ${issue.reference}`)
        lines.push(`  - Message: ${issue.message}`)
        if (issue.suggestion) {
          lines.push(`  - Suggestion: ${issue.suggestion}`)
        }
        lines.push('')
      }
    }
  }

  // Show warnings
  const warnings = report.brokenReferences.filter((i) => i.severity === 'warning')
  if (warnings.length > 0) {
    lines.push('## 🟡 Warnings')
    lines.push('')

    const warningByFile = new Map<string, BrokenReference[]>()
    for (const issue of warnings) {
      if (!warningByFile.has(issue.file)) {
        warningByFile.set(issue.file, [])
      }
      warningByFile.get(issue.file)!.push(issue)
    }

    for (const [file, fileIssues] of warningByFile.entries()) {
      lines.push(`### ${file}`)
      lines.push('')
      for (const issue of fileIssues) {
        lines.push(`- **Line ${issue.line}**: ${issue.reference}`)
        lines.push(`  - Message: ${issue.message}`)
        if (issue.suggestion) {
          lines.push(`  - Suggestion: ${issue.suggestion}`)
        }
        lines.push('')
      }
    }
  }

  return lines.join('\n')
}
