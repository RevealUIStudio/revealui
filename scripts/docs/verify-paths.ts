#!/usr/bin/env tsx

/**
 * Documentation File Path Verification
 *
 * Verifies that file paths referenced in documentation actually exist.
 *
 * Usage:
 *   pnpm docs:verify:paths
 */

import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import fg from 'fast-glob'
import { createLogger, getProjectRoot } from '../shared/utils.js'

const logger = createLogger()

interface PathReference {
  file: string
  line: number
  path: string
  exists: boolean
  resolvedPath: string | null
}

interface VerificationResult {
  references: PathReference[]
  broken: PathReference[]
  summary: {
    total: number
    found: number
    broken: number
  }
}

// Patterns for file paths in markdown - only in code blocks and links
const _CODE_BLOCK_PATH_REGEX = /```[\s\S]*?```/g
const LINK_PATH_REGEX = /\[([^\]]+)\]\(([^)]+\.(md|ts|tsx|js|jsx|json|yml|yaml|sh|ps1))\)/g
const INLINE_CODE_PATH_REGEX = /`([^`]+\.(ts|tsx|js|jsx|json|md|yml|yaml|sh|ps1))`/g

function extractPaths(content: string, filePath: string): PathReference[] {
  const paths: PathReference[] = []
  const lines = content.split('\n')

  // Track if we're in a code block
  let inCodeBlock = false
  let _codeBlockLanguage = ''

  lines.forEach((line, index) => {
    // Check for code block start
    const codeBlockStartMatch = line.match(/^```(\w+)?/)
    if (codeBlockStartMatch) {
      inCodeBlock = true
      _codeBlockLanguage = codeBlockStartMatch[1] || ''
      return
    }

    // Check for code block end
    if (line.trim() === '```') {
      inCodeBlock = false
      return
    }

    // Extract paths from markdown links (always check)
    let match: RegExpExecArray | null
    while ((match = LINK_PATH_REGEX.exec(line)) !== null) {
      const filePathStr = match[2]
      if (
        !filePathStr.startsWith('http') &&
        !filePathStr.startsWith('mailto:') &&
        !filePathStr.startsWith('@')
      ) {
        paths.push({
          file: filePath,
          line: index + 1,
          path: filePathStr,
          exists: false,
          resolvedPath: null,
        })
      }
    }

    // Extract paths from inline code (only in code blocks, not prose)
    // Skip if line looks like prose (has sentence structure, not just a path)
    if (inCodeBlock) {
      while ((match = INLINE_CODE_PATH_REGEX.exec(line)) !== null) {
        const filePathStr = match[1]
        // Filter out URLs, package names, and non-path strings
        // Skip if path is part of a sentence (has words before/after)
        const lineBefore = line.substring(0, match.index).trim()
        const lineAfter = line.substring(match.index + match[0].length).trim()
        const isInProse =
          (lineBefore.length > 0 && !lineBefore.endsWith('`')) ||
          (lineAfter.length > 0 && !lineAfter.startsWith('`'))

        if (
          !isInProse &&
          !filePathStr.startsWith('http') &&
          !filePathStr.startsWith('mailto:') &&
          !filePathStr.startsWith('@') &&
          !filePathStr.startsWith('npm:') &&
          !filePathStr.startsWith('node:') &&
          (filePathStr.includes('/') || filePathStr.includes('\\')) &&
          // Must have file extension
          filePathStr.match(/\.(ts|tsx|js|jsx|json|md|yml|yaml|sh|ps1)$/)
        ) {
          paths.push({
            file: filePath,
            line: index + 1,
            path: filePathStr,
            exists: false,
            resolvedPath: null,
          })
        }
      }
    }
  })

  return paths
}

async function resolvePath(filePath: string, fromFile: string): Promise<string | null> {
  const fromDir = path.dirname(fromFile)
  let targetPath: string

  if (filePath.startsWith('/')) {
    // Absolute path from repo root
    targetPath = path.resolve(process.cwd(), filePath.slice(1))
  } else {
    // Relative path
    targetPath = path.resolve(fromDir, filePath)
  }

  // Check if file exists
  if (existsSync(targetPath)) {
    return targetPath
  }

  // Try with different extensions
  const ext = path.extname(targetPath)
  if (!ext) {
    const extensions = ['.md', '.ts', '.tsx', '.js', '.jsx', '.json']
    for (const ext of extensions) {
      const withExt = `${targetPath}${ext}`
      if (existsSync(withExt)) {
        return withExt
      }
    }
  }

  return null
}

async function verifyPaths(): Promise<VerificationResult> {
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/4f287c09-8bd2-4437-8305-9f73d5c02317', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: 'verify-paths.ts:verifyPaths:entry',
      message: 'Starting path verification',
      data: { cwd: process.cwd() },
      timestamp: Date.now(),
      sessionId: 'debug-session',
      runId: 'pre-fix',
      hypothesisId: 'A',
    }),
  }).catch(() => {})
  // #endregion

  const markdownFiles = await fg('**/*.md', {
    ignore: [
      '**/node_modules/**',
      '**/*/node_modules/**',
      'node_modules/**',
      '.next/**',
      'dist/**',
      'docs/archive/**',
      '**/coverage/**',
    ],
    cwd: process.cwd(),
    absolute: false,
  })

  // Filter out node_modules manually (fast-glob ignore sometimes doesn't work)
  const filteredFiles = markdownFiles.filter((f) => {
    const normalized = f.replace(/\\/g, '/')
    return !normalized.includes('node_modules')
  })

  const allReferences: PathReference[] = []

  for (const file of filteredFiles) {
    const filePath = path.resolve(process.cwd(), file)
    const content = await fs.readFile(filePath, 'utf-8')
    const paths = extractPaths(content, filePath)
    allReferences.push(...paths)
  }

  // Resolve paths
  for (const ref of allReferences) {
    const resolved = await resolvePath(ref.path, ref.file)
    if (resolved) {
      ref.exists = true
      ref.resolvedPath = resolved
    }
  }

  const broken = allReferences.filter((ref) => !ref.exists)

  return {
    references: allReferences,
    broken,
    summary: {
      total: allReferences.length,
      found: allReferences.filter((r) => r.exists).length,
      broken: broken.length,
    },
  }
}

async function generateReport(result: VerificationResult): Promise<string> {
  const lines: string[] = []
  lines.push('# Documentation File Path Verification Report')
  lines.push('')
  lines.push(`**Generated**: ${new Date().toISOString()}`)
  lines.push('')
  lines.push('## Summary')
  lines.push('')
  lines.push(`- **Total Paths**: ${result.summary.total}`)
  lines.push(`- **Found**: ${result.summary.found}`)
  lines.push(`- **Broken**: ${result.summary.broken}`)
  lines.push('')

  if (result.broken.length > 0) {
    lines.push('## Broken Paths')
    lines.push('')
    for (const broken of result.broken) {
      lines.push(`### ${path.relative(process.cwd(), broken.file)}:${broken.line}`)
      lines.push('')
      lines.push(`- **Path**: \`${broken.path}\``)
      lines.push('')
    }
  }

  if (result.broken.length === 0) {
    lines.push('✅ **All paths verified successfully!**')
    lines.push('')
  }

  return lines.join('\n')
}

async function runVerification() {
  try {
    await getProjectRoot(import.meta.url)
    logger.header('Documentation File Path Verification')
    logger.info('Verifying file paths...')
    const result = await verifyPaths()

    logger.info(`\n📊 Results:`)
    logger.info(`  Total paths: ${result.summary.total}`)
    logger.info(`  Found: ${result.summary.found}`)
    logger.info(`  Broken: ${result.summary.broken}`)

    const report = await generateReport(result)
    const reportPath = path.join(process.cwd(), 'docs', 'PATH-VERIFICATION-REPORT.md')
    await fs.writeFile(reportPath, report, 'utf-8')
    logger.success(`\n📄 Report written to: ${reportPath}`)

    if (result.broken.length > 0) {
      logger.error('\n❌ Broken paths found. See report for details.')
      process.exit(1)
    } else {
      logger.success('\n✅ All paths verified successfully!')
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
