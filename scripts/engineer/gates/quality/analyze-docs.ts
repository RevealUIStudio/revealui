#!/usr/bin/env tsx

/**
 * Documentation Quality Analysis Tool
 *
 * Consolidated replacement for:
 * - jsdoc-coverage.ts
 * - maintenance-check.ts (already in manage-docs)
 * - Parts of validate-all.ts
 *
 * Usage:
 *   pnpm tsx scripts/docs/analyze-quality.ts coverage
 *   pnpm tsx scripts/docs/analyze-quality.ts metrics
 *   pnpm tsx scripts/docs/analyze-quality.ts trends
 */

import {readdir,readFile,stat} from 'node:fs/promises'
import {extname,join,relative} from 'node:path'
import {createLogger,getProjectRoot} from '../../../../packages/core/src/.scripts/utils.ts'

const logger = createLogger()

interface QualityMetrics {
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

interface JSDocCoverage {
  totalExports: number
  documentedExports: number
  coverage: number
  undocumented: Array<{ file: string; exports: string[] }>
}

async function analyzeJSDocCoverage(): Promise<JSDocCoverage> {
  logger.header('Analyzing JSDoc Coverage')

  const projectRoot = await getProjectRoot(import.meta.url)
  const sourceDirs = [join(projectRoot, 'apps'), join(projectRoot, 'packages')]

  let totalExports = 0
  let documentedExports = 0
  const undocumented: Array<{ file: string; exports: string[] }> = []

  for (const sourceDir of sourceDirs) {
    const result = await analyzeDirectoryJSDoc(sourceDir)
    totalExports += result.totalExports
    documentedExports += result.documentedExports
    undocumented.push(...result.undocumented)
  }

  const coverage = totalExports > 0 ? (documentedExports / totalExports) * 100 : 0

  logger.info(`JSDoc Coverage: ${coverage.toFixed(1)}%`)
  logger.info(`Documented: ${documentedExports}/${totalExports} exports`)

  if (undocumented.length > 0) {
    logger.warning(`Found ${undocumented.length} files with undocumented exports`)
    for (const item of undocumented.slice(0, 10)) {
      logger.info(`  ${item.file}: ${item.exports.join(', ')}`)
    }
  }

  return {
    totalExports,
    documentedExports,
    coverage,
    undocumented,
  }
}

async function analyzeDirectoryJSDoc(dir: string): Promise<{
  totalExports: number
  documentedExports: number
  undocumented: Array<{ file: string; exports: string[] }>
}> {
  let totalExports = 0
  let documentedExports = 0
  const undocumented: Array<{ file: string; exports: string[] }> = []

  async function scan(currentDir: string): Promise<void> {
    const entries = await readdir(currentDir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name)

      if (
        entry.isDirectory() &&
        !entry.name.startsWith('.') &&
        entry.name !== 'node_modules' &&
        entry.name !== 'dist'
      ) {
        await scan(fullPath)
      } else if (entry.isFile() && ['.ts', '.tsx', '.js', '.jsx'].includes(extname(entry.name))) {
        const result = await analyzeFileJSDoc(fullPath)
        totalExports += result.totalExports
        documentedExports += result.documentedExports

        if (result.undocumented.length > 0) {
          undocumented.push({
            file: relative(await getProjectRoot(import.meta.url), fullPath),
            exports: result.undocumented,
          })
        }
      }
    }
  }

  await scan(dir)
  return { totalExports, documentedExports, undocumented }
}

async function analyzeFileJSDoc(filePath: string): Promise<{
  totalExports: number
  documentedExports: number
  undocumented: string[]
}> {
  try {
    const content = await readFile(filePath, 'utf-8')
    const exportRegex =
      /export\s+(?:async\s+)?(?:function|class|const|let|var|interface|type)\s+(\w+)/g
    const exports: string[] = []
    let match = exportRegex.exec(content)

    while (match !== null) {
      exports.push(match[1])
      match = exportRegex.exec(content)
    }

    let documentedCount = 0
    const undocumented: string[] = []

    for (const exportName of exports) {
      // Look for JSDoc comment before the export
      const exportIndex = content.indexOf(`export ${exportName}`)
      if (exportIndex > 0) {
        const beforeExport = content.substring(0, exportIndex)
        const lines = beforeExport.split('\n')
        let hasJSDoc = false

        // Check last few lines before export for JSDoc
        for (let i = lines.length - 1; i >= Math.max(0, lines.length - 10); i--) {
          const line = lines[i].trim()
          if (line.startsWith('/**')) {
            hasJSDoc = true
            break
          }
          if (line && !line.startsWith('//') && !line.startsWith('*')) {
            break // Stop if we hit non-comment, non-empty line
          }
        }

        if (hasJSDoc) {
          documentedCount++
        } else {
          undocumented.push(exportName)
        }
      }
    }

    return {
      totalExports: exports.length,
      documentedExports: documentedCount,
      undocumented,
    }
  } catch {
    return { totalExports: 0, documentedExports: 0, undocumented: [] }
  }
}

async function analyzeQualityMetrics(): Promise<QualityMetrics> {
  logger.header('Analyzing Documentation Quality Metrics')

  const projectRoot = await getProjectRoot(import.meta.url)
  const docsDir = join(projectRoot, 'docs')

  const files = await scanDocumentationFiles(docsDir)
  const metrics = calculateMetrics(files)

  logger.info(`Total documentation files: ${metrics.totalFiles}`)
  logger.info(`Total size: ${(metrics.totalSize / 1024 / 1024).toFixed(2)} MB`)
  logger.info(`Average file size: ${(metrics.avgFileSize / 1024).toFixed(1)} KB`)
  logger.info(
    `Largest file: ${metrics.largestFile.path} (${(metrics.largestFile.size / 1024).toFixed(1)} KB)`,
  )

  logger.info('Files by extension:')
  for (const [ext, count] of Object.entries(metrics.filesByExtension)) {
    logger.info(`  ${ext}: ${count}`)
  }

  logger.info('Files by age:')
  logger.info(`  Last week: ${metrics.filesByAge.lastWeek}`)
  logger.info(`  Last month: ${metrics.filesByAge.lastMonth}`)
  logger.info(`  Last quarter: ${metrics.filesByAge.lastQuarter}`)
  logger.info(`  Older: ${metrics.filesByAge.older}`)

  return metrics
}

async function scanDocumentationFiles(
  docsDir: string,
): Promise<Array<{ path: string; size: number; mtime: Date }>> {
  const files: Array<{ path: string; size: number; mtime: Date }> = []

  async function scan(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = join(dir, entry.name)

      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        await scan(fullPath)
      } else if (entry.isFile() && ['.md', '.mdx'].includes(extname(entry.name))) {
        const stats = await stat(fullPath)
        files.push({
          path: relative(await getProjectRoot(import.meta.url), fullPath),
          size: stats.size,
          mtime: stats.mtime,
        })
      }
    }
  }

  await scan(docsDir)
  return files
}

function calculateMetrics(
  files: Array<{ path: string; size: number; mtime: Date }>,
): QualityMetrics {
  const totalSize = files.reduce((sum, file) => sum + file.size, 0)
  const avgFileSize = files.length > 0 ? totalSize / files.length : 0

  const largestFile = files.reduce((max, file) => (file.size > max.size ? file : max), {
    path: '',
    size: 0,
  })

  const sortedByAge = files.sort((a, b) => a.mtime.getTime() - b.mtime.getTime())
  const oldestFile = sortedByAge[0] || { path: '', mtime: new Date() }
  const newestFile = sortedByAge[sortedByAge.length - 1] || {
    path: '',
    mtime: new Date(),
  }

  const filesByExtension: Record<string, number> = {}
  const filesByAge = {
    lastWeek: 0,
    lastMonth: 0,
    lastQuarter: 0,
    older: 0,
  }

  const now = Date.now()
  const oneWeek = 7 * 24 * 60 * 60 * 1000
  const oneMonth = 30 * 24 * 60 * 60 * 1000
  const oneQuarter = 90 * 24 * 60 * 60 * 1000

  for (const file of files) {
    // Count by extension
    const ext = extname(file.path) || 'no-ext'
    filesByExtension[ext] = (filesByExtension[ext] || 0) + 1

    // Count by age
    const age = now - file.mtime.getTime()
    if (age < oneWeek) {
      filesByAge.lastWeek++
    } else if (age < oneMonth) {
      filesByAge.lastMonth++
    } else if (age < oneQuarter) {
      filesByAge.lastQuarter++
    } else {
      filesByAge.older++
    }
  }

  return {
    totalFiles: files.length,
    totalSize,
    avgFileSize,
    largestFile,
    oldestFile,
    newestFile,
    filesByExtension,
    filesByAge,
  }
}

async function analyzeTrends(): Promise<void> {
  logger.header('Analyzing Documentation Trends')

  // This would analyze trends over time
  // For now, provide basic analysis
  logger.info('Trend analysis would show documentation growth over time...')
  logger.info('Trend analysis would identify most active documentation areas...')
  logger.success('Documentation trend analysis completed (placeholder)')
}

async function main() {
  try {
    const command = process.argv[2]

    switch (command) {
      case 'coverage':
        await analyzeJSDocCoverage()
        break

      case 'metrics':
        await analyzeQualityMetrics()
        break

      case 'trends':
        await analyzeTrends()
        break

      default:
        logger.error('Usage: analyze-quality.ts <command>')
        logger.info('Commands: coverage, metrics, trends')
        process.exit(1)
    }

    logger.success('Quality analysis completed')
  } catch (error) {
    logger.error(`Quality analysis failed: ${error}`)
    process.exit(1)
  }
}

main()
