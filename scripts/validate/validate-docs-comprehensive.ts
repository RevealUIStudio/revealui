#!/usr/bin/env tsx

/**
 * Comprehensive Documentation Validation Script
 *
 * Validates documentation against actual source code, package.json,
 * node_modules, and file system to prevent documentation drift.
 *
 * Based on findings from 2026-01-29 Documentation Accuracy Audit.
 *
 * Usage:
 *   pnpm validate:docs
 *   pnpm validate:docs --json
 *   pnpm validate:docs --fix (future: auto-fix common issues)
 *
 * @dependencies
 * - scripts/lib/args.ts - Argument parsing utilities (parseArgs)
 * - scripts/lib/errors.ts - ErrorCode and ScriptError for error handling
 * - scripts/lib/index.ts - Shared utilities (scanDirectoryAll)
 * - scripts/lib/output.ts - Output formatting (createOutput)
 * - scripts/lib/verification-requirements.ts - Verification rules (VERIFICATION_RULES, validateVerificationClaims)
 * - node:fs - File system operations (existsSync)
 * - node:fs/promises - Async file operations (readFile)
 * - node:path - Path manipulation utilities (dirname, join, relative, resolve)
 */

import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { parseArgs } from '../lib/args.js'
import { ErrorCode, ScriptError } from '../lib/errors.js'
import { scanDirectoryAll } from '../lib/index.js'
import { createOutput } from '../lib/output.js'
import { VERIFICATION_RULES, validateVerificationClaims } from '../lib/verification-requirements.js'

// =============================================================================
// Types
// =============================================================================

interface ValidationIssue {
  file: string
  line?: number
  column?: number
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  category: ValidationCategory
  message: string
  suggested_fix?: string
  actual?: string
  expected?: string
}

type ValidationCategory =
  | 'broken-link'
  | 'nonexistent-script'
  | 'nonexistent-directory'
  | 'outdated-package'
  | 'incorrect-path'
  | 'deprecated-reference'
  | 'version-mismatch'
  | 'naming-inconsistency'
  | 'false-claim'

interface ValidationResult {
  total_files: number
  total_issues: number
  by_severity: Record<string, number>
  by_category: Record<string, number>
  issues: ValidationIssue[]
  accuracy_score: number
}

interface PackageJson {
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  [key: string]: unknown
}

// =============================================================================
// Configuration
// =============================================================================

const PROJECT_ROOT = resolve(process.cwd())
const DOCS_DIR = join(PROJECT_ROOT, 'docs')

// Patterns to check
const DEPRECATED_PATTERNS = [
  {
    pattern: /@revealui\/schema\b/g,
    category: 'deprecated-reference' as const,
    message: 'Package @revealui/schema was renamed to @revealui/contracts',
    suggested_fix: '@revealui/contracts',
  },
  {
    pattern: /packages\/schema\//g,
    category: 'incorrect-path' as const,
    message: 'Directory packages/schema/ does not exist',
    suggested_fix: 'packages/contracts/',
  },
  {
    pattern: /packages\/revealui\//g,
    category: 'incorrect-path' as const,
    message: 'Directory packages/revealui/ does not exist',
    suggested_fix: 'packages/core/',
  },
  {
    pattern: /packages\/memory\//g,
    category: 'incorrect-path' as const,
    message: 'Directory packages/memory/ does not exist',
    suggested_fix: 'packages/ai/src/memory/',
  },
  {
    pattern: /SQLite.*IndexedDB/gi,
    category: 'false-claim' as const,
    message: 'ElectricSQL uses HTTP sync with browser cache, not SQLite/IndexedDB',
    suggested_fix: 'browser cache via HTTP sync',
  },
  {
    pattern: /pnpm\s+(9\.14\.2|9\.)/g,
    category: 'version-mismatch' as const,
    message: 'pnpm version should be 10.28.2',
    suggested_fix: 'pnpm 10.28.2',
  },
]

// Known non-existent directories (from audit)
const NONEXISTENT_DIRECTORIES = [
  'docs/assessments/',
  'docs/implementation/',
  'docs/development/',
  'docs/planning/',
  'docs/reference/',
  'docs/migrations/',
  'docs/guides/',
  'scripts/automation/',
]

// File naming patterns (UPPERCASE_UNDERSCORES is standard)
const INCORRECT_NAMING_PATTERN = /[A-Z][A-Z_]+-[A-Z]/

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * Load and parse package.json
 */
async function loadPackageJson(): Promise<PackageJson> {
  const packagePath = join(PROJECT_ROOT, 'package.json')
  const content = await readFile(packagePath, 'utf-8')
  return JSON.parse(content) as PackageJson
}

/**
 * Get all markdown files in docs directory
 */
async function findMarkdownFiles(dir: string): Promise<string[]> {
  // Use centralized scanner to find markdown files
  return scanDirectoryAll(dir, {
    extensions: ['.md', '.mdx'],
    includeHidden: false,
  })
}

// Built-in pnpm commands that shouldn't be validated against package.json
const BUILTIN_PNPM_COMMANDS = new Set([
  'install',
  'add',
  'remove',
  'update',
  'why',
  'audit',
  'outdated',
  'list',
  'run',
  'exec',
  'dlx',
  'create',
  'init',
  'import',
  'rebuild',
  'store',
  'publish',
  'pack',
  'link',
  'unlink',
  'prune',
  'dedupe',
  'patch',
  'patch-commit',
  'deploy',
  'fetch',
  'server',
  'recursive',
  '-r', // recursive flag
])

/**
 * Validate package.json script references
 */
async function validateScriptReferences(
  content: string,
  filePath: string,
  packageJson: PackageJson,
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = []
  const scriptPattern = /`pnpm\s+([\w:.-]+)`/g

  let match = scriptPattern.exec(content)
  while (match !== null) {
    const scriptName = match[1]

    // Skip built-in pnpm commands
    if (!BUILTIN_PNPM_COMMANDS.has(scriptName)) {
      // Check if script exists in package.json
      if (!packageJson.scripts?.[scriptName]) {
        const line = content.substring(0, match.index).split('\n').length

        issues.push({
          file: relative(PROJECT_ROOT, filePath),
          line,
          severity: 'critical',
          category: 'nonexistent-script',
          message: `Script '${scriptName}' does not exist in package.json`,
          actual: `pnpm ${scriptName}`,
          expected: 'Check package.json for correct script name',
        })
      }
    }

    match = scriptPattern.exec(content)
  }

  return issues
}

/**
 * Validate directory references
 */
function validateDirectoryReferences(content: string, filePath: string): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  for (const dir of NONEXISTENT_DIRECTORIES) {
    if (content.includes(dir)) {
      const lines = content.split('\n')
      const lineIndex = lines.findIndex((line) => line.includes(dir))

      issues.push({
        file: relative(PROJECT_ROOT, filePath),
        line: lineIndex + 1,
        severity: 'high',
        category: 'nonexistent-directory',
        message: `Directory '${dir}' does not exist`,
        actual: dir,
      })
    }
  }

  return issues
}

/**
 * Validate internal links (markdown links to local files)
 */
async function validateInternalLinks(
  content: string,
  filePath: string,
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = []
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g

  let match = linkPattern.exec(content)
  while (match !== null) {
    const _linkText = match[1]
    const linkPath = match[2]

    // Only check relative links (not http, mailto, or anchors)
    if (
      !(linkPath.startsWith('http') || linkPath.startsWith('mailto:') || linkPath.startsWith('#'))
    ) {
      // Resolve relative to current file
      const fileDir = dirname(filePath)
      const targetPath = resolve(fileDir, linkPath.split('#')[0]) // Remove anchor

      if (!existsSync(targetPath)) {
        const line = content.substring(0, match.index).split('\n').length

        issues.push({
          file: relative(PROJECT_ROOT, filePath),
          line,
          severity: 'high',
          category: 'broken-link',
          message: `Broken link: ${linkPath}`,
          actual: linkPath,
        })
      }
    }

    match = linkPattern.exec(content)
  }

  return issues
}

/**
 * Validate deprecated patterns
 */
function validateDeprecatedPatterns(content: string, filePath: string): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  for (const { pattern, category, message, suggested_fix } of DEPRECATED_PATTERNS) {
    const matches = Array.from(content.matchAll(pattern))

    for (const match of matches) {
      const line = content.substring(0, match.index).split('\n').length

      issues.push({
        file: relative(PROJECT_ROOT, filePath),
        line,
        severity: category === 'deprecated-reference' ? 'high' : 'medium',
        category,
        message,
        actual: match[0],
        suggested_fix,
      })
    }
  }

  return issues
}

/**
 * Validate file naming consistency
 */
function validateFileNaming(filePath: string): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const fileName = filePath.split('/').pop() || ''

  // Check for hyphenated uppercase names (should be underscores)
  if (INCORRECT_NAMING_PATTERN.test(fileName)) {
    issues.push({
      file: relative(PROJECT_ROOT, filePath),
      severity: 'low',
      category: 'naming-inconsistency',
      message: 'File uses hyphens instead of underscores in uppercase name',
      actual: fileName,
      suggested_fix: fileName.replace(/-/g, '_'),
    })
  }

  return issues
}

/**
 * Validate MCP package versions against node_modules
 */
async function validateMcpVersions(content: string, filePath: string): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = []

  // Check for version claims like @stripe/mcp@0.1.4
  const versionPattern = /@([\w/-]+)@([\d.]+)/g

  let match = versionPattern.exec(content)
  while (match !== null) {
    const packageName = match[1]
    const claimedVersion = match[2]

    try {
      const packageJsonPath = join(PROJECT_ROOT, 'node_modules', packageName, 'package.json')
      if (existsSync(packageJsonPath)) {
        const pkgContent = await readFile(packageJsonPath, 'utf-8')
        const pkg = JSON.parse(pkgContent) as PackageJson
        const actualVersion = pkg.version as string

        if (actualVersion && actualVersion !== claimedVersion) {
          const line = content.substring(0, match.index).split('\n').length

          issues.push({
            file: relative(PROJECT_ROOT, filePath),
            line,
            severity: 'medium',
            category: 'version-mismatch',
            message: `Package version mismatch for ${packageName}`,
            actual: claimedVersion,
            expected: actualVersion,
            suggested_fix: `@${packageName}@${actualVersion}`,
          })
        }
      }
    } catch {
      // Ignore errors reading package.json
    }

    match = versionPattern.exec(content)
  }

  return issues
}

/**
 * Validate a single file
 */
async function validateFile(
  filePath: string,
  packageJson: PackageJson,
): Promise<ValidationIssue[]> {
  const content = await readFile(filePath, 'utf-8')
  const issues: ValidationIssue[] = []

  // Run all validations
  issues.push(...(await validateScriptReferences(content, filePath, packageJson)))
  issues.push(...validateDirectoryReferences(content, filePath))
  issues.push(...(await validateInternalLinks(content, filePath)))
  issues.push(...validateDeprecatedPatterns(content, filePath))
  issues.push(...validateFileNaming(filePath))
  issues.push(...(await validateMcpVersions(content, filePath)))
  issues.push(...validateAutomatedReports(content, filePath))

  return issues
}

/**
 * Validate that automated reports don't make false claims
 */
function validateAutomatedReports(content: string, filePath: string): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  // Use verification requirements module
  const validation = validateVerificationClaims(content, filePath)

  if (!validation.valid) {
    for (const error of validation.errors) {
      issues.push({
        file: relative(PROJECT_ROOT, filePath),
        severity: 'critical',
        category: 'false-claim',
        message: error,
        suggested_fix:
          'Add human review section or remove unverified claims. See scripts/lib/verification-requirements.ts',
      })
    }
  }

  // Additional specific checks
  const isGenerated =
    content.includes('Auto-generated') ||
    content.includes('Generated by automation') ||
    filePath.includes('assessment-report') ||
    filePath.includes('review-validated')

  if (isGenerated) {
    // Check for required disclaimer
    if (!content.includes(VERIFICATION_RULES.requiredDisclaimer)) {
      issues.push({
        file: relative(PROJECT_ROOT, filePath),
        severity: 'critical',
        category: 'false-claim',
        message: 'Automated report missing required disclaimer',
        suggested_fix: `Add: ${VERIFICATION_RULES.requiredDisclaimer}`,
      })
    }

    // Check for forbidden patterns
    for (const pattern of VERIFICATION_RULES.forbiddenAutomatedClaims) {
      if (pattern.test(content)) {
        const match = content.match(pattern)
        issues.push({
          file: relative(PROJECT_ROOT, filePath),
          severity: 'critical',
          category: 'false-claim',
          message: `Automated report makes unverified claim: "${match?.[0]}"`,
          actual: match?.[0],
          suggested_fix:
            'Remove claim or add human review section with reviewDate and reviewedBy fields',
        })
      }
    }
  }

  return issues
}

/**
 * Calculate accuracy score based on issues
 */
function calculateAccuracyScore(totalFiles: number, issues: ValidationIssue[]): number {
  // Weight issues by severity
  const weights = { critical: 10, high: 5, medium: 2, low: 1, info: 0.5 }

  const totalWeight = issues.reduce((sum, issue) => sum + weights[issue.severity], 0)

  // Perfect score is 100, reduce based on weighted issues
  const maxPenalty = totalFiles * 10 // Assume max 10 points per file
  const penalty = Math.min(totalWeight, maxPenalty)
  const score = Math.max(0, 100 - (penalty / maxPenalty) * 100)

  return Math.round(score * 10) / 10 // Round to 1 decimal
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  const config: import('../lib/args.js').ParserConfig = {
    name: 'validate-docs-comprehensive',
    description: 'Comprehensive documentation validation against source code',
    args: [
      { name: 'json', type: 'boolean', description: 'Output JSON for machine parsing' },
      { name: 'verbose', short: 'v', type: 'boolean', description: 'Show detailed output' },
      { name: 'exit-zero', type: 'boolean', description: 'Exit with 0 even if issues found' },
    ],
  }

  const args = parseArgs(process.argv.slice(2), config)

  const output = createOutput(args.flags, { loggerPrefix: 'validate-docs' })

  try {
    output.header('Comprehensive Documentation Validation')

    // Load package.json
    output.progress('Loading package.json...')
    const packageJson = await loadPackageJson()

    // Find all markdown files
    output.progress('Scanning documentation files...')
    const files = await findMarkdownFiles(DOCS_DIR)
    output.progress(`Found ${files.length} documentation files`)

    // Also check root README
    files.push(join(PROJECT_ROOT, 'README.md'))

    // Validate each file
    const allIssues: ValidationIssue[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      output.progressBar(i + 1, files.length, `Validating ${relative(PROJECT_ROOT, file)}`)

      try {
        const issues = await validateFile(file, packageJson)
        allIssues.push(...issues)
      } catch (error) {
        output.warn(`Failed to validate ${relative(PROJECT_ROOT, file)}: ${error}`)
      }
    }

    // Organize results
    const bySeverity: Record<string, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    }

    const byCategory: Record<string, number> = {}

    for (const issue of allIssues) {
      bySeverity[issue.severity]++
      byCategory[issue.category] = (byCategory[issue.category] || 0) + 1
    }

    const accuracyScore = calculateAccuracyScore(files.length, allIssues)

    const result: ValidationResult = {
      total_files: files.length,
      total_issues: allIssues.length,
      by_severity: bySeverity,
      by_category: byCategory,
      issues: allIssues,
      accuracy_score: accuracyScore,
    }

    // Output results
    if (output.isJsonMode()) {
      output.success(result)
    } else {
      output.divider()
      output.getLogger().info(`\n📊 Validation Summary\n`)
      output.getLogger().info(`Files validated: ${result.total_files}`)
      output.getLogger().info(`Issues found: ${result.total_issues}`)
      output.getLogger().info(`Accuracy score: ${result.accuracy_score}%\n`)

      if (result.total_issues > 0) {
        output.getLogger().info('Issues by severity:')
        output.getLogger().error(`  🔴 Critical: ${bySeverity.critical}`)
        output.getLogger().warn(`  🟠 High: ${bySeverity.high}`)
        output.getLogger().info(`  🟡 Medium: ${bySeverity.medium}`)
        output.getLogger().info(`  ⚪ Low: ${bySeverity.low}`)
        output.getLogger().info(`  ℹ️  Info: ${bySeverity.info}\n`)

        output.getLogger().info('Issues by category:')
        for (const [category, count] of Object.entries(byCategory)) {
          output.getLogger().info(`  ${category}: ${count}`)
        }

        // Show first 20 issues
        const displayCount = Math.min(20, allIssues.length)
        output.getLogger().info(`\n🔍 Top ${displayCount} Issues:\n`)

        for (const issue of allIssues.slice(0, displayCount)) {
          const icon =
            issue.severity === 'critical'
              ? '🔴'
              : issue.severity === 'high'
                ? '🟠'
                : issue.severity === 'medium'
                  ? '🟡'
                  : '⚪'

          const location = issue.line ? `${issue.file}:${issue.line}` : issue.file
          output.getLogger().info(`${icon} ${location}`)
          output.getLogger().info(`   ${issue.message}`)

          if (issue.actual && issue.suggested_fix) {
            output.getLogger().info(`   Current: ${issue.actual}`)
            output.getLogger().info(`   Suggested: ${issue.suggested_fix}`)
          }

          output.getLogger().info('')
        }

        if (allIssues.length > displayCount) {
          output.getLogger().info(`... and ${allIssues.length - displayCount} more issues\n`)
          output.getLogger().info('Run with --json flag to see all issues\n')
        }
      }

      // Summary message
      if (result.total_issues === 0) {
        output.getLogger().success('\n✅ All documentation is accurate!')
      } else if (bySeverity.critical > 0) {
        output
          .getLogger()
          .error(`\n❌ Found ${bySeverity.critical} critical issues - must fix before release`)
      } else if (bySeverity.high > 0) {
        output
          .getLogger()
          .warn(`\n⚠️  Found ${bySeverity.high} high priority issues - should fix soon`)
      } else {
        output.getLogger().info(`\n💡 Found ${result.total_issues} minor issues`)
      }
    }

    // Exit with error code if critical issues found (unless --exit-zero)
    if (bySeverity.critical > 0 && !args.flags['exit-zero']) {
      process.exit(ErrorCode.VALIDATION_ERROR)
    }
  } catch (error) {
    if (error instanceof ScriptError) {
      output.error({
        code: error.codeString,
        message: error.message,
        details: error.details,
      })
      process.exit(error.code)
    }

    output.error({
      code: 'GENERAL_ERROR',
      message: error instanceof Error ? error.message : String(error),
    })
    process.exit(ErrorCode.GENERAL_ERROR)
  }
}

main()
