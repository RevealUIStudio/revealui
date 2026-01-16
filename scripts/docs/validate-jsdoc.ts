#!/usr/bin/env tsx

/**
 * JSDoc Validation Script
 *
 * Validates JSDoc comments in TypeScript source files.
 * Checks for required JSDoc on public APIs, missing parameter descriptions, etc.
 *
 * Usage:
 *   pnpm docs:validate:jsdoc
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import ts from 'typescript'
import { createLogger, getProjectRoot } from '../shared/utils.js'
import fg from 'fast-glob'

const logger = createLogger()

interface ValidationIssue {
  file: string
  line: number
  name: string
  kind: string
  issue: string
  severity: 'error' | 'warning'
}

interface ValidationResult {
  total: number
  documented: number
  issues: ValidationIssue[]
}

async function validateFile(filePath: string): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = []
  const content = await fs.readFile(filePath, 'utf-8')
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true)

  function visit(node: ts.Node) {
    // Check exported functions
    if (ts.isFunctionDeclaration(node) && node.name) {
      const isExported = node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
      if (isExported) {
        const hasJSDoc = ts.getJSDocCommentsAndTags(node, false).length > 0
        if (!hasJSDoc) {
          const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1
          issues.push({
            file: filePath,
            line,
            name: node.name.text,
            kind: 'function',
            issue: 'Missing JSDoc comment',
            severity: 'error',
          })
        } else {
          // Check for parameter documentation
          const jsDocTags = ts.getJSDocTags(node)
          const paramTags = jsDocTags.filter((tag) => tag.tagName.text === 'param')
          const paramNames = new Set(paramTags.map((tag) => tag.name?.text).filter(Boolean))

          node.parameters.forEach((param) => {
            if (ts.isIdentifier(param.name)) {
              const paramName = param.name.text
              if (!paramNames.has(paramName)) {
                const line = sourceFile.getLineAndCharacterOfPosition(param.getStart()).line + 1
                issues.push({
                  file: filePath,
                  line,
                  name: `${node.name.text}.${paramName}`,
                  kind: 'parameter',
                  issue: `Missing @param documentation for '${paramName}'`,
                  severity: 'warning',
                })
              }
            }
          })

          // Check for return documentation
          const hasReturnTag = jsDocTags.some((tag) => tag.tagName.text === 'returns' || tag.tagName.text === 'return')
          if (!hasReturnTag && node.type) {
            const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1
            issues.push({
              file: filePath,
              line,
              name: node.name.text,
              kind: 'function',
              issue: 'Missing @returns documentation',
              severity: 'warning',
            })
          }
        }
      }
    }

    // Check exported classes
    if (ts.isClassDeclaration(node) && node.name) {
      const isExported = node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
      if (isExported) {
        const hasJSDoc = ts.getJSDocCommentsAndTags(node, false).length > 0
        if (!hasJSDoc) {
          const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1
          issues.push({
            file: filePath,
            line,
            name: node.name.text,
            kind: 'class',
            issue: 'Missing JSDoc comment',
            severity: 'error',
          })
        }
      }
    }

    // Check exported interfaces
    if (ts.isInterfaceDeclaration(node) && node.name) {
      const isExported = node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
      if (isExported) {
        const hasJSDoc = ts.getJSDocCommentsAndTags(node, false).length > 0
        if (!hasJSDoc) {
          const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1
          issues.push({
            file: filePath,
            line,
            name: node.name.text,
            kind: 'interface',
            issue: 'Missing JSDoc comment',
            severity: 'warning',
          })
        }
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)

  return issues
}

async function validateJSDoc(): Promise<ValidationResult> {
  const projectRoot = await getProjectRoot(import.meta.url)

  logger.header('JSDoc Validation')

  // Find all TypeScript source files in packages
  const sourceFiles = await fg(['packages/**/*.ts', 'packages/**/*.tsx'], {
    ignore: ['**/*.test.ts', '**/*.spec.ts', '**/node_modules/**', '**/dist/**'],
    cwd: projectRoot,
    absolute: true,
  })

  logger.info(`Analyzing ${sourceFiles.length} source files...\n`)

  const allIssues: ValidationIssue[] = []
  let totalExported = 0
  let documented = 0

  for (const file of sourceFiles) {
    try {
      const issues = await validateFile(file)
      allIssues.push(...issues)

      // Count exported entities (simplified)
      const content = await fs.readFile(file, 'utf-8')
      const exportedMatches = content.match(/export\s+(function|class|interface|type|const|let)\s+\w+/g)
      if (exportedMatches) {
        totalExported += exportedMatches.length
      }

      // Count documented (entities without issues)
      const fileIssues = issues.filter((i) => i.severity === 'error')
      if (fileIssues.length === 0 && exportedMatches) {
        documented += exportedMatches.length
      }
    } catch (error) {
      logger.warning(`Failed to validate ${file}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // Group issues by severity
  const errors = allIssues.filter((i) => i.severity === 'error')
  const warnings = allIssues.filter((i) => i.severity === 'warning')

  // Display results
  if (errors.length > 0) {
    logger.error(`\nErrors (${errors.length}):\n`)
    for (const issue of errors) {
      const relativePath = path.relative(projectRoot, issue.file)
      logger.error(`  ${relativePath}:${issue.line} - ${issue.name} (${issue.kind})`)
      logger.error(`    ${issue.issue}`)
    }
  }

  if (warnings.length > 0) {
    logger.warning(`\nWarnings (${warnings.length}):\n`)
    for (const issue of warnings.slice(0, 20)) {
      // Limit warnings display
      const relativePath = path.relative(projectRoot, issue.file)
      logger.warning(`  ${relativePath}:${issue.line} - ${issue.name} (${issue.kind})`)
      logger.warning(`    ${issue.issue}`)
    }
    if (warnings.length > 20) {
      logger.warning(`  ... and ${warnings.length - 20} more warnings`)
    }
  }

  if (errors.length === 0 && warnings.length === 0) {
    logger.success('\n✅ All exported APIs have proper JSDoc documentation!')
  }

  logger.info(`\n\nSummary:`)
  logger.info(`  Total exported entities: ${totalExported}`)
  logger.info(`  Documented: ${documented}`)
  logger.info(`  Coverage: ${totalExported > 0 ? ((documented / totalExported) * 100).toFixed(1) : 0}%`)
  logger.info(`  Errors: ${errors.length}`)
  logger.info(`  Warnings: ${warnings.length}`)

  return {
    total: totalExported,
    documented,
    issues: allIssues,
  }
}

async function main() {
  try {
    const result = await validateJSDoc()

    if (result.issues.some((i) => i.severity === 'error')) {
      process.exit(1)
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
