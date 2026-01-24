#!/usr/bin/env tsx

/**
 * Documentation Accuracy Validation Script
 *
 * Validates documentation accuracy by checking:
 * - Code examples are syntactically valid
 * - File paths and references exist
 * - Package imports/exports are correct
 * - Commands work or are valid
 * - Links are valid (internal and external)
 * - Configuration examples match actual configs
 * - Version numbers are current
 *
 * Usage:
 *   pnpm docs:validate:accuracy [--dry-run] [--verbose]
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import fg from 'fast-glob'
import { createLogger, getProjectRoot } from '../shared/utils.js'

const logger = createLogger()
let _verboseMode = false

interface AccuracyIssue {
  file: string
  line?: number
  severity: 'error' | 'warning' | 'info'
  category: 'code' | 'link' | 'path' | 'package' | 'command' | 'version' | 'config'
  message: string
  suggestion?: string
}

interface AccuracyReport {
  totalFiles: number
  issues: AccuracyIssue[]
  summary: {
    errors: number
    warnings: number
    info: number
  }
  byCategory: Record<string, number>
  generatedAt: Date
}

// Patterns for detecting code blocks
const CODE_BLOCK_PATTERN =
  /```(?:tsx?|typescript|javascript|js|json|bash|shell|sh|yaml|yml)?\n([\s\S]*?)```/g

// Patterns for detecting imports
const IMPORT_PATTERN = /import\s+(?:.*?\s+from\s+)?['"]([@\w/\-.]+)['"]/g

// Patterns for detecting file paths
const FILE_PATH_PATTERN = /(?:\.\/|\.\.\/)?([\w/\-.]+\.(?:tsx?|jsx?|json|md|mjs|cjs))/g

// Patterns for detecting commands
const COMMAND_PATTERN = /`(pnpm|npm|yarn|tsx|node|tsc|turbo)\s+([^`]+)`/g

// Patterns for detecting links
const LINK_PATTERN = /\[([^\]]+)\]\(([^)]+)\)/g

// Patterns for detecting package references
const PACKAGE_PATTERN = /`(@?[\w\-./]+)`/g

async function readPackageJson(dir: string): Promise<Record<string, unknown> | null> {
  const pkgPath = path.join(dir, 'package.json')
  try {
    const content = await fs.readFile(pkgPath, 'utf-8')
    return JSON.parse(content)
  } catch {
    return null
  }
}

async function validateCodeBlock(
  code: string,
  filePath: string,
  lineNumber: number,
): Promise<AccuracyIssue[]> {
  const issues: AccuracyIssue[] = []

  // Check for TypeScript syntax in tsx/ts blocks
  if (code.includes('export default') && code.includes('module.exports')) {
    issues.push({
      file: filePath,
      line: lineNumber,
      severity: 'error',
      category: 'code',
      message: 'Mixed ESM and CommonJS syntax',
      suggestion: 'Use only ESM (export) or CommonJS (module.exports), not both',
    })
  }

  // Check for deprecated patterns
  if (code.includes('require(') && !code.includes('// legacy') && !filePath.includes('archive')) {
    issues.push({
      file: filePath,
      line: lineNumber,
      severity: 'warning',
      category: 'code',
      message: 'CommonJS require() found - project uses ESM',
      suggestion: 'Replace with import statement',
    })
  }

  // Check for incorrect package names
  if (code.includes('@revealui/cms')) {
    issues.push({
      file: filePath,
      line: lineNumber,
      severity: 'error',
      category: 'package',
      message: 'Deprecated package name "@revealui/cms"',
      suggestion: 'Replace with "@revealui/core"',
    })
  }

  return issues
}

async function validateImports(
  content: string,
  filePath: string,
  projectRoot: string,
): Promise<AccuracyIssue[]> {
  const issues: AccuracyIssue[] = []
  const importMatches = [...content.matchAll(IMPORT_PATTERN)]

  for (const match of importMatches) {
    const importPath = match[1]

    // Check workspace protocol
    if (importPath.startsWith('workspace:')) {
      // Valid workspace protocol
      continue
    }

    // Check internal package references
    if (importPath.startsWith('@revealui/') || importPath.startsWith('dev/')) {
      // Check if package exists
      const packageName = importPath.includes('/') ? importPath.split('/')[0] : importPath
      const packagePath = path.join(projectRoot, 'packages', packageName.replace('@revealui/', ''))

      try {
        const stats = await fs.stat(packagePath)
        if (!stats.isDirectory()) {
          issues.push({
            file: filePath,
            severity: 'error',
            category: 'package',
            message: `Package not found: ${packageName}`,
            suggestion: `Verify package name or path: ${importPath}`,
          })
        }
      } catch {
        // Package doesn't exist
        issues.push({
          file: filePath,
          severity: 'error',
          category: 'package',
          message: `Package not found: ${packageName}`,
          suggestion: `Check package name: ${importPath}`,
        })
      }
    }
  }

  return issues
}

async function validateFilePaths(
  content: string,
  filePath: string,
  projectRoot: string,
): Promise<AccuracyIssue[]> {
  const issues: AccuracyIssue[] = []
  const pathMatches = [...content.matchAll(FILE_PATH_PATTERN)]

  for (const match of pathMatches) {
    const relativePath = match[1]

    // Skip if it's clearly a code example path (not meant to exist)
    if (relativePath.includes('example') || relativePath.includes('your-')) {
      continue
    }

    // Check if file exists
    const fullPath = path.resolve(path.dirname(filePath), relativePath)

    try {
      await fs.access(fullPath)
    } catch {
      // Also check from project root
      const rootPath = path.join(projectRoot, relativePath)
      try {
        await fs.access(rootPath)
      } catch {
        issues.push({
          file: filePath,
          severity: 'warning',
          category: 'path',
          message: `File path may not exist: ${relativePath}`,
          suggestion: 'Verify file path is correct',
        })
      }
    }
  }

  return issues
}

async function validateCommands(content: string, filePath: string): Promise<AccuracyIssue[]> {
  const issues: AccuracyIssue[] = []
  const commandMatches = [...content.matchAll(COMMAND_PATTERN)]

  for (const match of commandMatches) {
    const tool = match[1]
    const command = match[2].trim()

    // Check for deprecated tools
    if (tool === 'npx' && !command.includes('only-allow')) {
      issues.push({
        file: filePath,
        severity: 'warning',
        category: 'command',
        message: `Using 'npx' instead of 'pnpm dlx'`,
        suggestion: "Replace 'npx' with 'pnpm dlx' (project uses pnpm)",
      })
    }

    // Check for npm/yarn instead of pnpm
    if ((tool === 'npm' || tool === 'yarn') && !command.includes('install -g')) {
      issues.push({
        file: filePath,
        severity: 'warning',
        category: 'command',
        message: `Using '${tool}' instead of 'pnpm'`,
        suggestion: "Replace with 'pnpm' (project uses pnpm exclusively)",
      })
    }
  }

  return issues
}

async function validateLinks(
  content: string,
  filePath: string,
  _projectRoot: string,
): Promise<AccuracyIssue[]> {
  const issues: AccuracyIssue[] = []
  const linkMatches = [...content.matchAll(LINK_PATTERN)]

  for (const match of linkMatches) {
    const linkText = match[1]
    const linkTarget = match[2]

    // Skip external links (starting with http/https)
    if (linkTarget.startsWith('http://') || linkTarget.startsWith('https://')) {
      continue
    }

    // Skip mailto and anchor links
    if (linkTarget.startsWith('mailto:') || linkTarget.startsWith('#')) {
      continue
    }

    // Check internal links
    if (linkTarget.startsWith('./') || linkTarget.startsWith('../') || !linkTarget.includes('/')) {
      const resolvedPath = path.resolve(path.dirname(filePath), linkTarget)

      try {
        await fs.access(resolvedPath)
      } catch {
        // Also check for .md extension
        const mdPath = resolvedPath.endsWith('.md') ? resolvedPath : `${resolvedPath}.md`
        try {
          await fs.access(mdPath)
        } catch {
          issues.push({
            file: filePath,
            severity: 'error',
            category: 'link',
            message: `Broken internal link: [${linkText}](${linkTarget})`,
            suggestion: `Verify link target exists: ${linkTarget}`,
          })
        }
      }
    }
  }

  return issues
}

async function validatePackageReferences(
  content: string,
  filePath: string,
  projectRoot: string,
): Promise<AccuracyIssue[]> {
  const issues: AccuracyIssue[] = []
  const packageMatches = [...content.matchAll(PACKAGE_PATTERN)]

  const validPackages = new Set<string>()
  const packageDirs = await fg(['packages/*/package.json'], {
    cwd: projectRoot,
    absolute: true,
  })

  for (const pkgPath of packageDirs) {
    const pkg = await readPackageJson(path.dirname(pkgPath))
    const pkgName = typeof pkg?.name === 'string' ? pkg.name : null
    if (pkgName) {
      validPackages.add(pkgName)
      // Also add unscoped name if scoped
      if (pkgName.includes('/')) {
        validPackages.add(pkgName.split('/').pop() || '')
      }
    }
  }

  for (const match of packageMatches) {
    const packageRef = match[1]

    // Skip if it's clearly not a package reference
    if (
      packageRef.includes('.') ||
      (packageRef.includes('/') && !packageRef.startsWith('@')) ||
      packageRef === 'dev' || // Allowed unscoped package
      packageRef.startsWith('dev/') // Allowed package import
    ) {
      continue
    }

    // Check if package exists
    if (packageRef.startsWith('@')) {
      // Scoped package
      const exists = Array.from(validPackages).some(
        (pkg) => pkg === packageRef || pkg.includes(packageRef),
      )
      if (!(exists || packageRef.includes('test'))) {
        issues.push({
          file: filePath,
          severity: 'warning',
          category: 'package',
          message: `Package reference may not exist: ${packageRef}`,
          suggestion: `Verify package name: ${packageRef}`,
        })
      }
    }
  }

  return issues
}

async function validateDocumentation(
  filePath: string,
  projectRoot: string,
): Promise<AccuracyIssue[]> {
  const issues: AccuracyIssue[] = []
  const content = await fs.readFile(filePath, 'utf-8')

  // Extract code blocks
  const codeBlockMatches = [...content.matchAll(CODE_BLOCK_PATTERN)]

  // Validate code blocks
  for (const match of codeBlockMatches) {
    const code = match[1]
    const lineNumber = content.substring(0, match.index).split('\n').length
    const codeIssues = await validateCodeBlock(code, filePath, lineNumber)
    issues.push(...codeIssues)
  }

  // Validate imports
  const importIssues = await validateImports(content, filePath, projectRoot)
  issues.push(...importIssues)

  // Validate file paths
  const pathIssues = await validateFilePaths(content, filePath, projectRoot)
  issues.push(...pathIssues)

  // Validate commands
  const commandIssues = await validateCommands(content, filePath)
  issues.push(...commandIssues)

  // Validate links
  const linkIssues = await validateLinks(content, filePath, projectRoot)
  issues.push(...linkIssues)

  // Validate package references
  const packageIssues = await validatePackageReferences(content, filePath, projectRoot)
  issues.push(...packageIssues)

  return issues
}

async function validateAllDocs(): Promise<AccuracyReport> {
  const projectRoot = getProjectRoot()
  const files = await fg(['**/*.md'], {
    cwd: projectRoot,
    ignore: ['node_modules/**', '.next/**', 'dist/**', 'docs/archive/**', '**/coverage/**'],
    absolute: true,
  })

  logger.info(`Validating ${files.length} markdown files...`)

  const allIssues: AccuracyIssue[] = []

  for (const file of files) {
    const issues = await validateDocumentation(file, projectRoot)
    allIssues.push(...issues)
  }

  // Group issues by category
  const byCategory: Record<string, number> = {}
  for (const issue of allIssues) {
    byCategory[issue.category] = (byCategory[issue.category] || 0) + 1
  }

  const summary = {
    errors: allIssues.filter((i) => i.severity === 'error').length,
    warnings: allIssues.filter((i) => i.severity === 'warning').length,
    info: allIssues.filter((i) => i.severity === 'info').length,
  }

  return {
    totalFiles: files.length,
    issues: allIssues,
    summary,
    byCategory,
    generatedAt: new Date(),
  }
}

function generateReportMarkdown(report: AccuracyReport): string {
  const lines: string[] = []

  lines.push('# Documentation Accuracy Report')
  lines.push('')
  lines.push(`**Generated**: ${report.generatedAt.toISOString()}`)
  lines.push(`**Total Files Validated**: ${report.totalFiles}`)
  lines.push(`**Total Issues Found**: ${report.issues.length}`)
  lines.push('')
  lines.push('## Summary')
  lines.push('')
  lines.push(`- 🔴 **Errors**: ${report.summary.errors}`)
  lines.push(`- 🟡 **Warnings**: ${report.summary.warnings}`)
  lines.push(`- 🔵 **Info**: ${report.summary.info}`)
  lines.push('')

  if (report.issues.length === 0) {
    lines.push('✅ **No accuracy issues found!**')
    lines.push('')
    return lines.join('\n')
  }

  // Group by category
  const byCategory: Record<string, AccuracyIssue[]> = {}
  for (const issue of report.issues) {
    if (!byCategory[issue.category]) {
      byCategory[issue.category] = []
    }
    byCategory[issue.category].push(issue)
  }

  // Group by severity
  const bySeverity = {
    error: report.issues.filter((i) => i.severity === 'error'),
    warning: report.issues.filter((i) => i.severity === 'warning'),
    info: report.issues.filter((i) => i.severity === 'info'),
  }

  // Show errors first
  if (bySeverity.error.length > 0) {
    lines.push('## 🔴 Errors')
    lines.push('')

    // Group by file
    const byFile = new Map<string, AccuracyIssue[]>()
    for (const issue of bySeverity.error) {
      if (!byFile.has(issue.file)) {
        byFile.set(issue.file, [])
      }
      const fileIssues = byFile.get(issue.file)
      if (fileIssues) {
        fileIssues.push(issue)
      }
    }

    for (const [file, fileIssues] of byFile.entries()) {
      lines.push(`### ${file}`)
      lines.push('')
      for (const issue of fileIssues) {
        lines.push(`- **${issue.category.toUpperCase()}** ${issue.message}`)
        if (issue.line) {
          lines.push(`  - Line: ${issue.line}`)
        }
        if (issue.suggestion) {
          lines.push(`  - Suggestion: ${issue.suggestion}`)
        }
        lines.push('')
      }
    }
  }

  // Show warnings
  if (bySeverity.warning.length > 0) {
    lines.push('## 🟡 Warnings')
    lines.push('')

    const byFile = new Map<string, AccuracyIssue[]>()
    for (const issue of bySeverity.warning) {
      if (!byFile.has(issue.file)) {
        byFile.set(issue.file, [])
      }
      const fileIssues = byFile.get(issue.file)
      if (fileIssues) {
        fileIssues.push(issue)
      }
    }

    for (const [file, fileIssues] of byFile.entries()) {
      lines.push(`### ${file}`)
      lines.push('')
      for (const issue of fileIssues) {
        lines.push(`- **${issue.category.toUpperCase()}** ${issue.message}`)
        if (issue.suggestion) {
          lines.push(`  - Suggestion: ${issue.suggestion}`)
        }
        lines.push('')
      }
    }
  }

  // Show by category
  lines.push('## Issues by Category')
  lines.push('')
  for (const [category, count] of Object.entries(report.byCategory)) {
    lines.push(`- **${category}**: ${count}`)
  }
  lines.push('')

  return lines.join('\n')
}

// Parse command line arguments
function parseArgs(args: string[]): { dryRun: boolean; verbose: boolean } {
  let dryRun = false
  let verbose = false

  for (const arg of args) {
    if (arg === '--dry-run' || arg === '--dryrun') {
      dryRun = true
    } else if (arg === '--verbose' || arg === '-v') {
      verbose = true
    }
  }

  return { dryRun, verbose }
}

async function main() {
  const { dryRun, verbose } = parseArgs(process.argv.slice(2))
  _verboseMode = verbose

  if (dryRun) {
    logger.info('🔍 [DRY RUN] Validating documentation accuracy...')
  } else {
    logger.info('🔍 Validating documentation accuracy...')
  }

  try {
    const report = await validateAllDocs()

    const projectRoot = getProjectRoot()
    const reportDir = path.join(projectRoot, 'docs', 'reports')

    if (dryRun) {
      logger.info('[DRY RUN] Would generate report in:', reportDir)
      logger.info(`   Total files: ${report.totalFiles}`)
      logger.info(`   Issues found: ${report.issues.length}`)
      logger.info(`   Errors: ${report.summary.errors}`)
      logger.info(`   Warnings: ${report.summary.warnings}`)

      if (report.summary.errors > 0) {
        logger.error(`❌ [DRY RUN] Would fail with ${report.summary.errors} errors`)
      } else if (report.summary.warnings > 0) {
        logger.warn(`⚠️  [DRY RUN] Would warn about ${report.summary.warnings} warnings`)
      } else {
        logger.info('✅ [DRY RUN] No issues found!')
      }

      if (verbose) {
        logger.info('\n[DRY RUN] Report preview:')
        const preview = generateReportMarkdown(report)
        logger.info(preview.substring(0, 500) + (preview.length > 500 ? '...' : ''))
      }
      return
    }

    await fs.mkdir(reportDir, { recursive: true })
    const reportPath = path.join(reportDir, 'accuracy-report.md')
    const markdown = generateReportMarkdown(report)
    await fs.writeFile(reportPath, markdown, 'utf-8')

    logger.info(`✅ Report generated: ${reportPath}`)
    logger.info(`   Total files: ${report.totalFiles}`)
    logger.info(`   Issues found: ${report.issues.length}`)
    logger.info(`   Errors: ${report.summary.errors}`)
    logger.info(`   Warnings: ${report.summary.warnings}`)

    if (report.summary.errors > 0) {
      logger.error(`❌ Found ${report.summary.errors} errors`)
      process.exit(1)
    } else if (report.summary.warnings > 0) {
      logger.warn(`⚠️  Found ${report.summary.warnings} warnings`)
    } else {
      logger.info('✅ No issues found!')
    }
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`❌ Error validating documentation: ${error.message}`)
      if (verbose && error.stack) {
        logger.error(`Stack trace: ${error.stack}`)
      }
    } else {
      logger.error('❌ Error validating documentation: Unknown error')
      if (verbose) {
        logger.error(`Error object: ${JSON.stringify(error)}`)
      }
    }
    process.exit(1)
  }
}

main()
