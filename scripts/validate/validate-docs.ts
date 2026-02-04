#!/usr/bin/env tsx

/**
 * Documentation Validation Tool
 *
 * Consolidated replacement for:
 * - validate-jsdoc.ts
 * - validate-references.ts
 * - validate-references-core.ts
 * - validate-documentation-accuracy.ts
 * - validate-all.ts
 * - verify-docs.ts
 *
 * Usage:
 *   pnpm tsx scripts/docs/validate-docs.ts jsdoc
 *   pnpm tsx scripts/docs/validate-docs.ts references
 *   pnpm tsx scripts/docs/validate-docs.ts accuracy
 *   pnpm tsx scripts/docs/validate-docs.ts all
 *   pnpm tsx scripts/docs/validate-docs.ts verify
 *
 * @dependencies
 * - scripts/lib/errors.ts - ErrorCode enum for exit codes
 * - scripts/utils/base.ts - Base utilities (createLogger, getProjectRoot)
 * - node:fs/promises - Async file operations (readdir, readFile)
 * - node:path - Path manipulation utilities (extname, join, relative)
 */

import { readdir, readFile } from 'node:fs/promises'
import { extname, join, relative } from 'node:path'
import { createLogger, getProjectRoot } from '../../utils/base.ts'
import { ErrorCode } from '../lib/errors.js'

const logger = createLogger()

interface ValidationResult {
  file: string
  line?: number
  message: string
  severity: 'error' | 'warning' | 'info'
}

interface ValidationSummary {
  total: number
  errors: number
  warnings: number
  passed: number
}

async function scanDocsDirectory(): Promise<string[]> {
  const projectRoot = await getProjectRoot(import.meta.url)
  const docsDir = join(projectRoot, 'docs')
  const files: string[] = []

  async function scan(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = join(dir, entry.name)

      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        await scan(fullPath)
      } else if (
        entry.isFile() &&
        ['.md', '.mdx', '.ts', '.tsx', '.js', '.jsx'].includes(extname(entry.name))
      ) {
        files.push(relative(projectRoot, fullPath))
      }
    }
  }

  await scan(docsDir)
  await scan(join(projectRoot, 'packages')) // Also scan packages for JSDoc
  await scan(join(projectRoot, 'apps'))

  return files
}

async function validateJSDoc(): Promise<ValidationResult[]> {
  logger.info('Validating JSDoc comments in source files...')

  const results: ValidationResult[] = []
  const files = await scanDocsDirectory()

  const sourceFiles = files.filter((f) => ['.ts', '.tsx', '.js', '.jsx'].includes(extname(f)))

  for (const file of sourceFiles) {
    try {
      const content = await readFile(join(await getProjectRoot(import.meta.url), file), 'utf-8')

      // Check for exported functions/classes without JSDoc
      const exportedItems =
        content.match(/export\s+(?:async\s+)?(?:function|class|const|let|var)\s+(\w+)/g) || []

      for (const item of exportedItems) {
        const itemName = item.match(/(?:function|class|const|let|var)\s+(\w+)/)?.[1]
        if (itemName && !content.includes(`/**`)) {
          // Look for JSDoc before the export
          const linesBefore = content.substring(0, content.indexOf(item)).split('\n')
          const hasJSDoc = linesBefore.some((line) => line.trim().startsWith('/**'))

          if (!hasJSDoc) {
            results.push({
              file,
              message: `Exported ${itemName} missing JSDoc comment`,
              severity: 'warning',
            })
          }
        }
      }
    } catch (error) {
      results.push({
        file,
        message: `Failed to analyze: ${error}`,
        severity: 'error',
      })
    }
  }

  return results
}

async function validateReferences(): Promise<ValidationResult[]> {
  logger.info('Validating documentation references and links...')

  const results: ValidationResult[] = []
  const files = await scanDocsDirectory()

  const docFiles = files.filter((f) => ['.md', '.mdx'].includes(extname(f)))

  for (const file of docFiles) {
    try {
      const content = await readFile(join(await getProjectRoot(import.meta.url), file), 'utf-8')

      // Check for broken relative links
      const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
      let match = linkRegex.exec(content)

      while (match !== null) {
        const link = match[2]

        // Check relative links (not starting with http)
        if (!(link.startsWith('http') || link.startsWith('#') || link.startsWith('mailto:'))) {
          // Try to resolve the link
          const fileDir = file.split('/').slice(0, -1).join('/')
          const resolvedPath = join(fileDir, link)

          try {
            await readFile(join(await getProjectRoot(import.meta.url), resolvedPath))
          } catch {
            results.push({
              file,
              line: content.substring(0, match.index).split('\n').length,
              message: `Broken link: ${link}`,
              severity: 'error',
            })
          }
        }
        match = linkRegex.exec(content)
      }
    } catch (error) {
      results.push({
        file,
        message: `Failed to validate: ${error}`,
        severity: 'error',
      })
    }
  }

  return results
}

async function validateDocumentationAccuracy(): Promise<ValidationResult[]> {
  logger.info('Validating documentation accuracy...')

  const results: ValidationResult[] = []
  const files = await scanDocsDirectory()

  const docFiles = files.filter((f) => ['.md', '.mdx'].includes(extname(f)))

  for (const file of docFiles) {
    try {
      const content = await readFile(join(await getProjectRoot(import.meta.url), file), 'utf-8')

      // Check for common outdated patterns
      const outdatedPatterns = [
        { pattern: /Next\.js 12/, replacement: 'Next.js 16' },
        { pattern: /React 17/, replacement: 'React 19' },
        { pattern: /Node\.js 16/, replacement: 'Node.js 20+' },
      ]

      for (const { pattern, replacement } of outdatedPatterns) {
        if (pattern.test(content)) {
          results.push({
            file,
            message: `Potentially outdated reference - consider updating to ${replacement}`,
            severity: 'warning',
          })
        }
      }

      // Check for TODO/FIXME comments in docs
      if (content.includes('TODO') || content.includes('FIXME') || content.includes('XXX')) {
        results.push({
          file,
          message: 'Documentation contains TODO/FIXME comments',
          severity: 'info',
        })
      }
    } catch (error) {
      results.push({
        file,
        message: `Failed to validate: ${error}`,
        severity: 'error',
      })
    }
  }

  return results
}

async function verifyDocs(): Promise<ValidationResult[]> {
  logger.info('Verifying documentation completeness and quality...')

  const results: ValidationResult[] = []
  const files = await scanDocsDirectory()

  const docFiles = files.filter((f) => ['.md', '.mdx'].includes(extname(f)))

  for (const file of docFiles) {
    try {
      const content = await readFile(join(await getProjectRoot(import.meta.url), file), 'utf-8')

      // Check for basic documentation quality
      if (content.length < 100) {
        results.push({
          file,
          message: 'Documentation file is very short (< 100 characters)',
          severity: 'warning',
        })
      }

      // Check for headers
      if (!content.includes('# ')) {
        results.push({
          file,
          message: 'Documentation file missing main header (# )',
          severity: 'warning',
        })
      }

      // Check for code blocks in technical docs
      if (file.includes('/api/') || file.includes('/guides/')) {
        if (!content.includes('```')) {
          results.push({
            file,
            message: 'Technical documentation should include code examples',
            severity: 'info',
          })
        }
      }
    } catch (error) {
      results.push({
        file,
        message: `Failed to verify: ${error}`,
        severity: 'error',
      })
    }
  }

  return results
}

function summarizeResults(results: ValidationResult[]): ValidationSummary {
  return {
    total: results.length,
    errors: results.filter((r) => r.severity === 'error').length,
    warnings: results.filter((r) => r.severity === 'warning').length,
    passed: results.filter((r) => r.severity === 'info').length,
  }
}

async function runValidation(command: string): Promise<void> {
  logger.header(`Documentation Validation: ${command}`)

  let results: ValidationResult[] = []

  try {
    switch (command) {
      case 'jsdoc':
        results = await validateJSDoc()
        break

      case 'references':
        results = await validateReferences()
        break

      case 'accuracy':
        results = await validateDocumentationAccuracy()
        break

      case 'verify':
        results = await verifyDocs()
        break

      case 'all': {
        const jsdocResults = await validateJSDoc()
        const refResults = await validateReferences()
        const accuracyResults = await validateDocumentationAccuracy()
        const verifyResults = await verifyDocs()
        results = [...jsdocResults, ...refResults, ...accuracyResults, ...verifyResults]
        break
      }

      default:
        logger.error('Usage: validate-docs.ts <command>')
        logger.info('Commands: jsdoc, references, accuracy, verify, all')
        process.exit(ErrorCode.CONFIG_ERROR)
    }

    // Display results
    if (results.length === 0) {
      logger.success(`✅ All ${command} validations passed!`)
    } else {
      const summary = summarizeResults(results)

      logger.info(`Validation Summary: ${summary.total} issues found`)
      logger.info(`  Errors: ${summary.errors}`)
      logger.info(`  Warnings: ${summary.warnings}`)
      logger.info(`  Info: ${summary.passed}`)

      // Show details
      for (const result of results.slice(0, 20)) {
        // Limit output
        const prefix =
          result.severity === 'error' ? '❌' : result.severity === 'warning' ? '⚠️' : 'ℹ️'
        const location = result.line ? `${result.file}:${result.line}` : result.file
        logger.info(`${prefix} ${location}: ${result.message}`)
      }

      if (results.length > 20) {
        logger.info(`... and ${results.length - 20} more issues`)
      }

      if (summary.errors > 0) {
        logger.error(`❌ ${summary.errors} errors found - please fix`)
        process.exit(ErrorCode.CONFIG_ERROR)
      } else if (summary.warnings > 0) {
        logger.warning(`⚠️ ${summary.warnings} warnings found - consider fixing`)
      }
    }
  } catch (error) {
    logger.error(`Validation failed: ${error}`)
    process.exit(ErrorCode.EXECUTION_ERROR)
  }
}

async function main() {
  const command = process.argv[2] || 'all'
  await runValidation(command)
  logger.success('Documentation validation completed')
}

main()
