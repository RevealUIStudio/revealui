#!/usr/bin/env tsx

/**
 * Documentation Version Verification
 *
 * Verifies that version numbers in documentation match actual package.json files.
 *
 * Usage:
 *   pnpm docs:verify:versions
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import fg from 'fast-glob'
import { createLogger, getProjectRoot } from '../shared/utils.js'

const logger = createLogger()

interface VersionReference {
  file: string
  line: number
  package: string
  documentedVersion: string
  actualVersion: string | null
  match: boolean
}

interface VerificationResult {
  references: VersionReference[]
  mismatches: VersionReference[]
  summary: {
    total: number
    matched: number
    mismatched: number
    notFound: number
  }
}

// Common version patterns in documentation
const _VERSION_PATTERNS = [
  /React\s+(\d+\.\d+\.\d+)/gi,
  /Next\.js\s+(\d+\.\d+)/gi,
  /TypeScript\s+(\d+\.\d+\.\d+)/gi,
  /Node\.js\s+(\d+\.\d+\.\d+)/gi,
  /pnpm\s+(\d+\.\d+\.\d+)/gi,
  /"react":\s*"([^"]+)"/gi,
  /"next":\s*"([^"]+)"/gi,
  /"typescript":\s*"([^"]+)"/gi,
  /"@types\/node":\s*"([^"]+)"/gi,
]

async function findPackageJsonFiles(): Promise<string[]> {
  const files = await fg('**/package.json', {
    ignore: ['node_modules/**', '.next/**', 'dist/**'],
    cwd: process.cwd(),
  })
  return files.map((f) => path.resolve(process.cwd(), f))
}

async function loadPackageVersions(): Promise<Map<string, string>> {
  const packageFiles = await findPackageJsonFiles()
  const versions = new Map<string, string>()

  // Priority order: apps/cms first (has React/Next.js), then root, then others
  const priorityFiles = packageFiles.sort((a, b) => {
    const aIsCms = a.includes('apps/cms')
    const bIsCms = b.includes('apps/cms')
    if (aIsCms && !bIsCms) return -1
    if (!aIsCms && bIsCms) return 1
    const aIsRoot = a.endsWith('/package.json') && !a.includes('/')
    const bIsRoot = b.endsWith('/package.json') && !b.includes('/')
    if (aIsRoot && !bIsRoot) return -1
    if (!aIsRoot && bIsRoot) return 1
    return 0
  })

  for (const file of priorityFiles) {
    try {
      const content = await fs.readFile(file, 'utf-8')
      const pkg = JSON.parse(content)

      // Extract versions from dependencies and devDependencies
      const allDeps = {
        ...(pkg.dependencies || {}),
        ...(pkg.devDependencies || {}),
      }

      for (const [name, version] of Object.entries(allDeps)) {
        // Only set if not already set (priority order)
        const key = name.toLowerCase()
        if (!versions.has(key)) {
          const cleanVersion = String(version).replace(/^[\^~>=<]/, '')
          versions.set(key, cleanVersion)
        }
      }

      // Priority for specific packages (apps/cms has React/Next.js)
      if (pkg.dependencies?.react && !versions.has('react')) {
        versions.set('react', pkg.dependencies.react.replace(/^[\^~>=<]/, ''))
      }
      if (pkg.dependencies?.next && !versions.has('next')) {
        versions.set('next', pkg.dependencies.next.replace(/^[\^~>=<]/, ''))
      }
      if (pkg.devDependencies?.typescript && !versions.has('typescript')) {
        versions.set('typescript', pkg.devDependencies.typescript.replace(/^[\^~>=<]/, ''))
      }
    } catch (error) {
      logger.warning(
        `Failed to parse ${file}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  return versions
}

function extractVersionReferences(content: string, filePath: string): VersionReference[] {
  const references: VersionReference[] = []
  const lines = content.split('\n')

  // Track if we're in a code block (skip versions in code examples)
  let inCodeBlock = false

  lines.forEach((line, index) => {
    // Check for code block start/end
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock
      return
    }

    // Skip versions in code blocks (they're examples, not documentation)
    if (inCodeBlock) return
    // Check for React version (but not library names like @testing-library/react)
    const reactMatch = line.match(/(?:^|\s)React\s+(\d+)/i)
    if (reactMatch && !line.includes('@') && !line.includes('library')) {
      references.push({
        file: filePath,
        line: index + 1,
        package: 'react',
        documentedVersion: reactMatch[1],
        actualVersion: null,
        match: false,
      })
    }

    // Check for Next.js version
    const nextMatch = line.match(/Next\.js\s+(\d+)/i)
    if (nextMatch) {
      references.push({
        file: filePath,
        line: index + 1,
        package: 'next',
        documentedVersion: nextMatch[1],
        actualVersion: null,
        match: false,
      })
    }

    // Check for TypeScript version
    const tsMatch = line.match(/TypeScript\s+(\d+\.\d+)/i)
    if (tsMatch) {
      references.push({
        file: filePath,
        line: index + 1,
        package: 'typescript',
        documentedVersion: tsMatch[1],
        actualVersion: null,
        match: false,
      })
    }

    // Check for Node.js version
    const nodeMatch = line.match(/Node\.js\s+(\d+\.\d+\.\d+)/i)
    if (nodeMatch) {
      references.push({
        file: filePath,
        line: index + 1,
        package: 'node',
        documentedVersion: nodeMatch[1],
        actualVersion: null,
        match: false,
      })
    }

    // Check for pnpm version
    const pnpmMatch = line.match(/pnpm\s+(\d+\.\d+\.\d+)/i)
    if (pnpmMatch) {
      references.push({
        file: filePath,
        line: index + 1,
        package: 'pnpm',
        documentedVersion: pnpmMatch[1],
        actualVersion: null,
        match: false,
      })
    }
  })

  return references
}

async function verifyVersions(): Promise<VerificationResult> {
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/4f287c09-8bd2-4437-8305-9f73d5c02317', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: 'verify-versions.ts:verifyVersions:entry',
      message: 'Starting version verification',
      data: { cwd: process.cwd() },
      timestamp: Date.now(),
      sessionId: 'debug-session',
      runId: 'pre-fix',
      hypothesisId: 'B',
    }),
  }).catch(() => {})
  // #endregion

  const versions = await loadPackageVersions()
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

  const allReferences: VersionReference[] = []

  for (const file of filteredFiles) {
    const filePath = path.resolve(process.cwd(), file)
    const content = await fs.readFile(filePath, 'utf-8')
    const references = extractVersionReferences(content, filePath)
    allReferences.push(...references)
  }

  // Match references with actual versions
  for (const ref of allReferences) {
    let actualVersion: string | null = null

    // Special handling for Node.js (check engines field)
    if (ref.package === 'node') {
      try {
        const rootPkg = JSON.parse(
          await fs.readFile(path.join(process.cwd(), 'package.json'), 'utf-8'),
        )
        if (rootPkg.engines?.node) {
          actualVersion = rootPkg.engines.node.replace(/[>=<^~]/g, '')
        }
      } catch {
        // Ignore
      }
    } else if (ref.package === 'pnpm') {
      // Check packageManager field for pnpm
      try {
        const rootPkg = JSON.parse(
          await fs.readFile(path.join(process.cwd(), 'package.json'), 'utf-8'),
        )
        if (rootPkg.packageManager?.startsWith('pnpm@')) {
          actualVersion = rootPkg.packageManager.replace('pnpm@', '')
        }
      } catch {
        // Ignore
      }
    } else {
      actualVersion = versions.get(ref.package.toLowerCase()) || null
    }

    if (actualVersion) {
      ref.actualVersion = actualVersion
      // Normalize versions for comparison
      const docVersion = ref.documentedVersion.replace(/[>=<^~]/g, '')
      const actualVersionClean = actualVersion.replace(/[>=<^~]/g, '')

      // Compare versions more intelligently
      // If documented is just major version (e.g., "19"), check if actual starts with it
      // If documented is full version, do more precise comparison
      if (docVersion.split('.').length === 1) {
        // Just major version - check if actual starts with it
        ref.match = actualVersionClean.startsWith(`${docVersion}.`)
      } else {
        // Full version - compare major.minor (allow patch differences)
        const docParts = docVersion.split('.')
        const actualParts = actualVersionClean.split('.')
        ref.match =
          docParts[0] === actualParts[0] && (docParts.length < 2 || docParts[1] === actualParts[1])
      }
    }
  }

  const mismatches = allReferences.filter((ref) => {
    if (!ref.actualVersion) return true
    return !ref.match
  })

  return {
    references: allReferences,
    mismatches,
    summary: {
      total: allReferences.length,
      matched: allReferences.filter((r) => r.match).length,
      mismatched: mismatches.length,
      notFound: allReferences.filter((r) => !r.actualVersion).length,
    },
  }
}

async function generateReport(result: VerificationResult): Promise<string> {
  const lines: string[] = []
  lines.push('# Documentation Version Verification Report')
  lines.push('')
  lines.push(`**Generated**: ${new Date().toISOString()}`)
  lines.push('')
  lines.push('## Summary')
  lines.push('')
  lines.push(`- **Total References**: ${result.summary.total}`)
  lines.push(`- **Matched**: ${result.summary.matched}`)
  lines.push(`- **Mismatched**: ${result.summary.mismatched}`)
  lines.push(`- **Not Found**: ${result.summary.notFound}`)
  lines.push('')

  if (result.mismatches.length > 0) {
    lines.push('## Version Mismatches')
    lines.push('')
    for (const mismatch of result.mismatches) {
      lines.push(`### ${path.relative(process.cwd(), mismatch.file)}:${mismatch.line}`)
      lines.push('')
      lines.push(`- **Package**: ${mismatch.package}`)
      lines.push(`- **Documented**: ${mismatch.documentedVersion}`)
      if (mismatch.actualVersion) {
        lines.push(`- **Actual**: ${mismatch.actualVersion}`)
      } else {
        lines.push(`- **Actual**: Not found in package.json`)
      }
      lines.push('')
    }
  }

  if (result.mismatches.length === 0) {
    lines.push('✅ **All version references verified successfully!**')
    lines.push('')
  }

  return lines.join('\n')
}

async function runVerification() {
  try {
    await getProjectRoot(import.meta.url)
    logger.header('Documentation Version Verification')
    logger.info('Loading package versions...')
    const result = await verifyVersions()

    logger.info(`\n📊 Results:`)
    logger.info(`  Total references: ${result.summary.total}`)
    logger.info(`  Matched: ${result.summary.matched}`)
    logger.info(`  Mismatched: ${result.summary.mismatched}`)
    logger.info(`  Not found: ${result.summary.notFound}`)

    const report = await generateReport(result)
    const reportPath = path.join(process.cwd(), 'docs', 'VERSION-VERIFICATION-REPORT.md')
    await fs.writeFile(reportPath, report, 'utf-8')
    logger.success(`\n📄 Report written to: ${reportPath}`)

    if (result.mismatches.length > 0) {
      logger.error('\n❌ Version mismatches found. See report for details.')
      process.exit(1)
    } else {
      logger.success('\n✅ All versions verified successfully!')
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
