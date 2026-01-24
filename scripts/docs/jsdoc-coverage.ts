#!/usr/bin/env tsx

/**
 * JSDoc Coverage Report
 *
 * Generates a coverage report for JSDoc documentation across the codebase.
 *
 * Usage:
 *   pnpm tsx scripts/docs/jsdoc-coverage.ts
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import fg from 'fast-glob'
import ts from 'typescript'
import { createLogger, getProjectRoot } from '../shared/utils.js'

const logger = createLogger()

interface CoverageStats {
  package: string
  total: number
  documented: number
  coverage: number
  byKind: Record<string, { total: number; documented: number }>
}

async function analyzeFile(filePath: string): Promise<{
  total: number
  documented: number
  byKind: Record<string, { total: number; documented: number }>
}> {
  const content = await fs.readFile(filePath, 'utf-8')
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true)

  let total = 0
  let documented = 0
  const byKind: Record<string, { total: number; documented: number }> = {}

  function visit(node: ts.Node) {
    let kind: string | null = null
    let isExported = false

    if (ts.isFunctionDeclaration(node) && node.name) {
      kind = 'function'
      isExported = node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    } else if (ts.isClassDeclaration(node) && node.name) {
      kind = 'class'
      isExported = node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    } else if (ts.isInterfaceDeclaration(node) && node.name) {
      kind = 'interface'
      isExported = node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    } else if (ts.isTypeAliasDeclaration(node) && node.name) {
      kind = 'type'
      isExported = node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    }

    if (kind && isExported) {
      total++
      if (!byKind[kind]) {
        byKind[kind] = { total: 0, documented: 0 }
      }
      byKind[kind].total++

      const hasJSDoc = ts.getJSDocCommentsAndTags(node, false).length > 0
      if (hasJSDoc) {
        documented++
        byKind[kind].documented++
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)

  return { total, documented, byKind }
}

async function generateCoverageReport(): Promise<void> {
  const projectRoot = await getProjectRoot(import.meta.url)

  logger.header('JSDoc Coverage Report')

  // Find packages
  const packageDirs = await fg(['packages/*/package.json'], {
    cwd: projectRoot,
    absolute: false,
  })

  const stats: CoverageStats[] = []

  for (const packageFile of packageDirs) {
    const packageDir = path.dirname(packageFile)
    const packageJsonPath = path.join(projectRoot, packageFile)

    try {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'))
      const packageName = packageJson.name || packageDir

      // Find source files
      const sourceFiles = await fg(['**/*.ts', '**/*.tsx'], {
        cwd: path.join(projectRoot, packageDir, 'src'),
        ignore: ['**/*.test.ts', '**/*.spec.ts', '**/node_modules/**', '**/dist/**'],
        absolute: true,
      })

      let total = 0
      let documented = 0
      const byKind: Record<string, { total: number; documented: number }> = {}

      for (const file of sourceFiles) {
        try {
          const fileStats = await analyzeFile(file)
          total += fileStats.total
          documented += fileStats.documented

          for (const [kind, kindStats] of Object.entries(fileStats.byKind)) {
            if (!byKind[kind]) {
              byKind[kind] = { total: 0, documented: 0 }
            }
            byKind[kind].total += kindStats.total
            byKind[kind].documented += kindStats.documented
          }
        } catch (error) {
          logger.warning(
            `Failed to analyze ${file}: ${error instanceof Error ? error.message : String(error)}`,
          )
        }
      }

      const coverage = total > 0 ? (documented / total) * 100 : 0

      stats.push({
        package: packageName,
        total,
        documented,
        coverage,
        byKind,
      })
    } catch (error) {
      logger.warning(
        `Failed to process ${packageFile}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  // Display report
  logger.info('\nCoverage by Package:\n')

  for (const stat of stats.sort((a, b) => b.coverage - a.coverage)) {
    const barLength = 40
    const filled = Math.round((stat.coverage / 100) * barLength)
    const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled)

    logger.info(`${stat.package}:`)
    logger.info(`  Coverage: ${stat.coverage.toFixed(1)}% [${bar}]`)
    logger.info(`  Documented: ${stat.documented}/${stat.total}`)

    if (Object.keys(stat.byKind).length > 0) {
      logger.info(`  By kind:`)
      for (const [kind, kindStats] of Object.entries(stat.byKind)) {
        const kindCoverage =
          kindStats.total > 0 ? (kindStats.documented / kindStats.total) * 100 : 0
        logger.info(
          `    ${kind}: ${kindCoverage.toFixed(1)}% (${kindStats.documented}/${kindStats.total})`,
        )
      }
    }
    logger.info('')
  }

  // Overall stats
  const overallTotal = stats.reduce((sum, s) => sum + s.total, 0)
  const overallDocumented = stats.reduce((sum, s) => sum + s.documented, 0)
  const overallCoverage = overallTotal > 0 ? (overallDocumented / overallTotal) * 100 : 0

  logger.info(`\nOverall Coverage: ${overallCoverage.toFixed(1)}%`)
  logger.info(`  Documented: ${overallDocumented}/${overallTotal}`)

  // Generate markdown report
  const reportPath = path.join(projectRoot, 'docs/COVERAGE.md')
  let report = '# Documentation Coverage Report\n\n'
  report += `*Auto-generated coverage report*\n\n`
  report += `**Last Updated**: ${new Date().toISOString().split('T')[0]}\n\n`
  report += `---\n\n`

  report += `## Overall Coverage\n\n`
  report += `**Coverage**: ${overallCoverage.toFixed(1)}%\n\n`
  report += `**Documented**: ${overallDocumented}/${overallTotal} exported entities\n\n`

  report += `## By Package\n\n`
  report += `| Package | Coverage | Documented | Total |\n`
  report += `|---------|----------|------------|-------|\n`

  for (const stat of stats.sort((a, b) => b.coverage - a.coverage)) {
    report += `| ${stat.package} | ${stat.coverage.toFixed(1)}% | ${stat.documented} | ${stat.total} |\n`
  }

  report += `\n---\n\n`
  report += `*This report is auto-generated. Run \`pnpm tsx scripts/docs/jsdoc-coverage.ts\` to regenerate.*\n`

  await fs.writeFile(reportPath, report, 'utf-8')
  logger.success(`\n✅ Coverage report written to: ${path.relative(projectRoot, reportPath)}`)
}

async function main() {
  try {
    await generateCoverageReport()
  } catch (error) {
    logger.error(`Script failed: ${error instanceof Error ? error.message : String(error)}`)
    if (error instanceof Error && error.stack) {
      logger.error(`Stack trace: ${error.stack}`)
    }
    process.exit(1)
  }
}

main()
