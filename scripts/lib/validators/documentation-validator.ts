/**
 * Unified Documentation Validator
 *
 * Consolidates logic from:
 * - analyze/docs.ts (JSDoc coverage, quality metrics)
 * - validate/validate-docs.ts (JSDoc, references)
 * - validate/validate-docs-comprehensive.ts (script refs, links, patterns)
 * - analyze/audit-docs.ts (false claim detection)
 *
 * Provides modular validators for comprehensive documentation validation.
 */

import { existsSync } from 'node:fs'
import { readdir, readFile, stat } from 'node:fs/promises'
import { extname, join, relative, resolve } from 'node:path'

// =============================================================================
// Types
// =============================================================================

export interface ValidationIssue {
  file: string
  line?: number
  column?: number
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info' | 'error' | 'warning'
  category: ValidationCategory
  message: string
  suggestedFix?: string
  actual?: string
  expected?: string
}

export type ValidationCategory =
  | 'broken-link'
  | 'nonexistent-script'
  | 'nonexistent-directory'
  | 'outdated-package'
  | 'incorrect-path'
  | 'deprecated-reference'
  | 'version-mismatch'
  | 'naming-inconsistency'
  | 'false-claim'
  | 'missing-jsdoc'
  | 'incomplete-jsdoc'

export interface JSDocCoverage {
  totalExports: number
  documentedExports: number
  coverage: number
  undocumented: Array<{ file: string; exports: string[] }>
}

export interface QualityMetrics {
  totalFiles: number
  totalSize: number
  avgFileSize: number
  largestFile: { path: string; size: number }
  oldestFile: { path: string; mtime: Date }
  newestFile: { path: string; mtime: Date }
  filesByExtension: Record<string, number>
  filesByAge: {
    lastWeek: number
    lastMonth: number
    lastQuarter: number
    older: number
  }
}

export interface ValidationResult {
  totalFiles: number
  totalIssues: number
  bySeverity: Record<string, number>
  byCategory: Record<string, number>
  issues: ValidationIssue[]
  accuracyScore: number
}

export interface DocValidationOptions {
  projectRoot: string
  validateLinks?: boolean
  validateJSDoc?: boolean
  validateScriptRefs?: boolean
  validateFalseClaims?: boolean
  validateDeprecated?: boolean
  validateNaming?: boolean
}

interface PackageJson {
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  [key: string]: unknown
}

// =============================================================================
// Configuration Patterns
// =============================================================================

const DEPRECATED_PATTERNS = [
  {
    pattern: /@revealui\/schema\b/g,
    category: 'deprecated-reference' as const,
    message: 'Package @revealui/schema was renamed to @revealui/contracts',
    suggestedFix: '@revealui/contracts',
  },
  {
    pattern: /packages\/schema\//g,
    category: 'incorrect-path' as const,
    message: 'Directory packages/schema/ does not exist',
    suggestedFix: 'packages/contracts/',
  },
  {
    pattern: /packages\/revealui\//g,
    category: 'incorrect-path' as const,
    message: 'Directory packages/revealui/ does not exist',
    suggestedFix: 'packages/core/',
  },
  {
    pattern: /packages\/memory\//g,
    category: 'incorrect-path' as const,
    message: 'Directory packages/memory/ does not exist',
    suggestedFix: 'packages/ai/src/memory/',
  },
]

const FALSE_CLAIM_PATTERNS = [
  {
    pattern: /comprehensive tests/i,
    category: 'false-claim' as const,
    message: 'Claims comprehensive testing - requires verification',
  },
  {
    pattern: /console statements.*\d+.*target achieved/i,
    category: 'false-claim' as const,
    message: 'False achievement claims for console statements',
  },
  {
    pattern: /phase.*completed/i,
    category: 'false-claim' as const,
    message: 'Phase completion claims - requires verification',
  },
  {
    pattern: /cleanup.*complete/i,
    category: 'false-claim' as const,
    message: 'Cleanup completion claims - requires verification',
  },
]

// =============================================================================
// Core Validation Functions
// =============================================================================

/**
 * Find all markdown and documentation files in the project.
 * Scans common documentation locations and optionally source files.
 *
 * @param projectRoot - Root directory of the project
 * @param includeSource - Whether to include source files (*.ts, *.tsx) for JSDoc validation
 * @returns Array of relative file paths to documentation files
 *
 * @example
 * ```typescript
 * // Find only markdown files
 * const mdFiles = await findDocumentationFiles('/app')
 * console.log(`Found ${mdFiles.length} markdown files`)
 *
 * // Include source files for JSDoc analysis
 * const allFiles = await findDocumentationFiles('/app', true)
 * ```
 */
export async function findDocumentationFiles(
  projectRoot: string,
  includeSource = false,
): Promise<string[]> {
  const files: string[] = []
  const docsDir = join(projectRoot, 'docs')

  async function scan(dir: string, extensions: string[]): Promise<void> {
    try {
      const entries = await readdir(dir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = join(dir, entry.name)

        if (
          entry.isDirectory() &&
          !entry.name.startsWith('.') &&
          entry.name !== 'node_modules' &&
          entry.name !== 'dist' &&
          entry.name !== 'build'
        ) {
          await scan(fullPath, extensions)
        } else if (entry.isFile() && extensions.includes(extname(entry.name))) {
          files.push(relative(projectRoot, fullPath))
        }
      }
    } catch {
      // Skip directories we can't read
    }
  }

  // Scan docs directory
  await scan(docsDir, ['.md', '.mdx'])

  // Optionally scan source for JSDoc
  if (includeSource) {
    await scan(join(projectRoot, 'packages'), ['.ts', '.tsx', '.js', '.jsx'])
    await scan(join(projectRoot, 'apps'), ['.ts', '.tsx', '.js', '.jsx'])
  }

  return files
}

/**
 * Validate links in markdown content for broken references.
 * Checks relative file links (ignoring HTTP/HTTPS and anchor-only links).
 *
 * @param content - Markdown file content to validate
 * @param filePath - Relative path to the markdown file (for error reporting)
 * @param projectRoot - Root directory of the project
 * @returns Array of validation issues for broken links
 *
 * @example
 * ```typescript
 * const content = await readFile('README.md', 'utf-8')
 * const issues = await validateLinks(content, 'README.md', process.cwd())
 *
 * issues.forEach(issue => {
 *   console.log(`${issue.file}:${issue.line} - ${issue.message}`)
 * })
 * ```
 */
export async function validateLinks(
  content: string,
  filePath: string,
  projectRoot: string,
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = []
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
  let match = linkRegex.exec(content)

  while (match !== null) {
    const [fullMatch, , link] = match
    const matchIndex = match.index

    // Skip external links, anchors, and mailto
    if (!(link.startsWith('http') || link.startsWith('#') || link.startsWith('mailto:'))) {
      // Resolve relative link
      const fileDir = filePath.split('/').slice(0, -1).join('/')
      const resolvedPath = resolve(join(projectRoot, fileDir), link)

      if (!existsSync(resolvedPath)) {
        const lineNumber = content.substring(0, matchIndex).split('\n').length

        issues.push({
          file: filePath,
          line: lineNumber,
          severity: 'error',
          category: 'broken-link',
          message: `Broken link: ${link}`,
          suggestedFix: 'Verify the file path exists',
        })
      }
    }

    match = linkRegex.exec(content)
  }

  return issues
}

/**
 * Validate JSDoc coverage in source files
 */
export async function validateJSDoc(
  filePath: string,
  projectRoot: string,
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = []

  try {
    const content = await readFile(join(projectRoot, filePath), 'utf-8')

    // Find all exports
    const exportRegex =
      /export\s+(?:async\s+)?(?:function|class|const|let|var|interface|type)\s+(\w+)/g
    const exports: string[] = []
    let match = exportRegex.exec(content)

    while (match !== null) {
      exports.push(match[1])
      match = exportRegex.exec(content)
    }

    // Check each export for JSDoc
    for (const exportName of exports) {
      const exportIndex = content.indexOf(`export`)
      if (exportIndex > 0) {
        const beforeExport = content.substring(0, exportIndex)
        const lines = beforeExport.split('\n')
        const lastLines = lines.slice(-5) // Check last 5 lines before export

        const hasJSDoc = lastLines.some(
          (line) => line.trim().startsWith('/**') || line.trim().startsWith('*'),
        )

        if (!hasJSDoc) {
          issues.push({
            file: filePath,
            severity: 'warning',
            category: 'missing-jsdoc',
            message: `Exported ${exportName} missing JSDoc comment`,
          })
        }
      }
    }
  } catch (error) {
    issues.push({
      file: filePath,
      severity: 'error',
      category: 'missing-jsdoc',
      message: `Failed to analyze: ${error}`,
    })
  }

  return issues
}

/**
 * Calculate JSDoc coverage across project source directories.
 * Analyzes exported functions and classes for JSDoc documentation.
 *
 * @param sourceDirs - Array of source directories to scan (e.g., ['packages', 'apps'])
 * @param projectRoot - Root directory of the project
 * @returns JSDoc coverage statistics including percentage and undocumented exports
 *
 * @example
 * ```typescript
 * const coverage = await calculateJSDocCoverage(
 *   ['packages', 'apps'],
 *   process.cwd()
 * )
 *
 * console.log(`JSDoc Coverage: ${coverage.coverage}%`)
 * console.log(`Total exports: ${coverage.totalExports}`)
 * console.log(`Documented: ${coverage.documentedExports}`)
 * console.log(`Undocumented: ${coverage.undocumented.length}`)
 *
 * coverage.undocumented.forEach(item => {
 *   console.log(`Missing JSDoc in ${item.file}:`)
 *   item.exports.forEach(exp => console.log(`  - ${exp}`))
 * })
 * ```
 */
export async function calculateJSDocCoverage(
  sourceDirs: string[],
  projectRoot: string,
): Promise<JSDocCoverage> {
  let totalExports = 0
  let documentedExports = 0
  const undocumented: Array<{ file: string; exports: string[] }> = []

  async function scanDir(dir: string): Promise<void> {
    try {
      const entries = await readdir(dir, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = join(dir, entry.name)

        if (
          entry.isDirectory() &&
          !entry.name.startsWith('.') &&
          entry.name !== 'node_modules' &&
          entry.name !== 'dist'
        ) {
          await scanDir(fullPath)
        } else if (entry.isFile() && ['.ts', '.tsx', '.js', '.jsx'].includes(extname(entry.name))) {
          const content = await readFile(fullPath, 'utf-8')
          const exportRegex =
            /export\s+(?:async\s+)?(?:function|class|const|let|var|interface|type)\s+(\w+)/g
          const fileExports: string[] = []
          let match = exportRegex.exec(content)

          while (match !== null) {
            fileExports.push(match[1])
            totalExports++
            match = exportRegex.exec(content)
          }

          // Count documented exports
          const jsdocRegex = /\/\*\*[\s\S]*?\*\/\s*export/g
          const documentedCount = (content.match(jsdocRegex) || []).length
          documentedExports += documentedCount

          // Track undocumented
          if (fileExports.length > documentedCount) {
            undocumented.push({
              file: relative(projectRoot, fullPath),
              exports: fileExports.slice(documentedCount),
            })
          }
        }
      }
    } catch {
      // Skip directories we can't read
    }
  }

  for (const dir of sourceDirs) {
    await scanDir(join(projectRoot, dir))
  }

  const coverage = totalExports > 0 ? (documentedExports / totalExports) * 100 : 0

  return {
    totalExports,
    documentedExports,
    coverage,
    undocumented,
  }
}

/**
 * Validate script references in documentation
 */
export async function validateScriptRefs(
  content: string,
  filePath: string,
  projectRoot: string,
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = []

  // Load package.json to verify scripts
  let packageJson: PackageJson = {}
  try {
    const packagePath = join(projectRoot, 'package.json')
    const packageContent = await readFile(packagePath, 'utf-8')
    packageJson = JSON.parse(packageContent) as PackageJson
  } catch {
    // Can't validate without package.json
    return issues
  }

  // Find script references like `pnpm scriptname` or `npm run scriptname`
  const scriptRefRegex = /(?:pnpm|npm run)\s+([a-z][a-z0-9:-]*)/g
  let match = scriptRefRegex.exec(content)

  while (match !== null) {
    const scriptName = match[1]
    const matchIndex = match.index

    if (!packageJson.scripts?.[scriptName]) {
      const lineNumber = content.substring(0, matchIndex).split('\n').length

      issues.push({
        file: filePath,
        line: lineNumber,
        severity: 'high',
        category: 'nonexistent-script',
        message: `Script "${scriptName}" does not exist in package.json`,
        suggestedFix: 'Update script name or add script to package.json',
      })
    }

    match = scriptRefRegex.exec(content)
  }

  return issues
}

/**
 * Validate for false claims in documentation
 */
export async function validateFalseClaims(
  content: string,
  filePath: string,
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = []

  for (const { pattern, category, message } of FALSE_CLAIM_PATTERNS) {
    let match = pattern.exec(content)

    while (match !== null) {
      const matchIndex = match.index
      const lineNumber = content.substring(0, matchIndex).split('\n').length
      const context = content.substring(
        Math.max(0, matchIndex - 50),
        Math.min(content.length, matchIndex + 50),
      )

      issues.push({
        file: filePath,
        line: lineNumber,
        severity: 'warning',
        category,
        message,
        actual: context.replace(/\n/g, ' ').trim(),
      })

      match = pattern.exec(content)
    }
  }

  return issues
}

/**
 * Validate for deprecated references
 */
export async function validateDeprecated(
  content: string,
  filePath: string,
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = []

  for (const { pattern, category, message, suggestedFix } of DEPRECATED_PATTERNS) {
    let match = pattern.exec(content)

    while (match !== null) {
      const matchIndex = match.index
      const lineNumber = content.substring(0, matchIndex).split('\n').length

      issues.push({
        file: filePath,
        line: lineNumber,
        severity: 'medium',
        category,
        message,
        suggestedFix,
        actual: match[0],
        expected: suggestedFix,
      })

      match = pattern.exec(content)
    }
  }

  return issues
}

/**
 * Calculate quality metrics for documentation
 */
export async function calculateQualityMetrics(
  files: string[],
  projectRoot: string,
): Promise<QualityMetrics> {
  let totalSize = 0
  let largestFile = { path: '', size: 0 }
  let oldestFile = { path: '', mtime: new Date() }
  let newestFile = { path: '', mtime: new Date(0) }
  const filesByExtension: Record<string, number> = {}
  const filesByAge = {
    lastWeek: 0,
    lastMonth: 0,
    lastQuarter: 0,
    older: 0,
  }

  const now = Date.now()
  const week = 7 * 24 * 60 * 60 * 1000
  const month = 30 * 24 * 60 * 60 * 1000
  const quarter = 90 * 24 * 60 * 60 * 1000

  for (const file of files) {
    const fullPath = join(projectRoot, file)
    const stats = await stat(fullPath)

    totalSize += stats.size

    if (stats.size > largestFile.size) {
      largestFile = { path: file, size: stats.size }
    }

    if (stats.mtime < oldestFile.mtime) {
      oldestFile = { path: file, mtime: stats.mtime }
    }

    if (stats.mtime > newestFile.mtime) {
      newestFile = { path: file, mtime: stats.mtime }
    }

    const ext = extname(file)
    filesByExtension[ext] = (filesByExtension[ext] || 0) + 1

    const age = now - stats.mtime.getTime()
    if (age < week) filesByAge.lastWeek++
    else if (age < month) filesByAge.lastMonth++
    else if (age < quarter) filesByAge.lastQuarter++
    else filesByAge.older++
  }

  return {
    totalFiles: files.length,
    totalSize,
    avgFileSize: files.length > 0 ? totalSize / files.length : 0,
    largestFile,
    oldestFile,
    newestFile,
    filesByExtension,
    filesByAge,
  }
}

// =============================================================================
// Main Validator Class
// =============================================================================

/**
 * Comprehensive documentation validator for validating markdown files,
 * JSDoc coverage, links, script references, and documentation quality.
 *
 * Consolidates functionality from:
 * - analyze/docs.ts
 * - validate/validate-docs.ts
 * - validate/validate-docs-comprehensive.ts
 * - analyze/audit-docs.ts
 *
 * @example
 * ```typescript
 * const validator = new DocumentationValidator('/path/to/project')
 *
 * // Validate everything
 * const result = await validator.validate()
 * console.log(`Found ${result.issues.length} issues`)
 * console.log(`By category:`, result.byCategory)
 *
 * // Validate only links
 * const linkResult = await validator.validate({
 *   validateLinks: true,
 *   validateJSDoc: false,
 *   validateScriptRefs: false
 * })
 *
 * // Get JSDoc coverage metrics
 * const coverage = await validator.getJSDocCoverage()
 * console.log(`JSDoc coverage: ${coverage.coverage}%`)
 * ```
 */
export class DocumentationValidator {
  /**
   * Create a new DocumentationValidator instance.
   *
   * @param projectRoot - Root directory of the project
   */
  constructor(private projectRoot: string) {}

  /**
   * Validate all aspects of documentation with comprehensive checks.
   * Scans markdown files and optionally source code for various issues.
   *
   * @param options - Validation options (all checks enabled by default)
   * @returns Validation result with issues grouped by category and severity
   *
   * @example
   * ```typescript
   * const validator = new DocumentationValidator(process.cwd())
   *
   * // Full validation
   * const result = await validator.validate()
   *
   * // Selective validation
   * const result = await validator.validate({
   *   validateLinks: true,
   *   validateJSDoc: false,
   *   validateScriptRefs: true,
   *   validateFalseClaims: true
   * })
   *
   * // Print results
   * console.log(`Total issues: ${result.issues.length}`)
   * console.log(`Errors: ${result.bySeverity.error}`)
   * console.log(`Warnings: ${result.bySeverity.warning}`)
   * ```
   */
  async validate(options: Partial<DocValidationOptions> = {}): Promise<ValidationResult> {
    const opts: DocValidationOptions = {
      projectRoot: this.projectRoot,
      validateLinks: true,
      validateJSDoc: true,
      validateScriptRefs: true,
      validateFalseClaims: true,
      validateDeprecated: true,
      validateNaming: true,
      ...options,
    }

    const files = await findDocumentationFiles(opts.projectRoot, opts.validateJSDoc)
    const allIssues: ValidationIssue[] = []

    for (const file of files) {
      const fullPath = join(opts.projectRoot, file)
      const content = await readFile(fullPath, 'utf-8')
      const ext = extname(file)

      // Validate markdown files
      if (ext === '.md' || ext === '.mdx') {
        if (opts.validateLinks) {
          const linkIssues = await validateLinks(content, file, opts.projectRoot)
          allIssues.push(...linkIssues)
        }

        if (opts.validateScriptRefs) {
          const scriptIssues = await validateScriptRefs(content, file, opts.projectRoot)
          allIssues.push(...scriptIssues)
        }

        if (opts.validateFalseClaims) {
          const claimIssues = await validateFalseClaims(content, file)
          allIssues.push(...claimIssues)
        }

        if (opts.validateDeprecated) {
          const deprecatedIssues = await validateDeprecated(content, file)
          allIssues.push(...deprecatedIssues)
        }
      }

      // Validate source files for JSDoc
      if (opts.validateJSDoc && ['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
        const jsdocIssues = await validateJSDoc(file, opts.projectRoot)
        allIssues.push(...jsdocIssues)
      }
    }

    // Calculate summary
    const bySeverity: Record<string, number> = {}
    const byCategory: Record<string, number> = {}

    for (const issue of allIssues) {
      bySeverity[issue.severity] = (bySeverity[issue.severity] || 0) + 1
      byCategory[issue.category] = (byCategory[issue.category] || 0) + 1
    }

    // Calculate accuracy score (percentage of files without issues)
    const filesWithIssues = new Set(allIssues.map((i) => i.file)).size
    const accuracyScore =
      files.length > 0 ? ((files.length - filesWithIssues) / files.length) * 100 : 100

    return {
      totalFiles: files.length,
      totalIssues: allIssues.length,
      bySeverity,
      byCategory,
      issues: allIssues,
      accuracyScore,
    }
  }

  /**
   * Get JSDoc coverage across the project
   */
  async getJSDocCoverage(): Promise<JSDocCoverage> {
    return calculateJSDocCoverage(['packages', 'apps'], this.projectRoot)
  }

  /**
   * Get quality metrics for documentation
   */
  async getQualityMetrics(): Promise<QualityMetrics> {
    const files = await findDocumentationFiles(this.projectRoot, false)
    return calculateQualityMetrics(files, this.projectRoot)
  }
}
