#!/usr/bin/env tsx

/**
 * Documentation Consolidation Verification
 *
 * Verifies that consolidated guides preserve all content from source files.
 *
 * Usage:
 *   pnpm docs:verify:consolidation
 */

import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createLogger, getProjectRoot } from '../shared/utils.js'

const logger = createLogger()

interface ConsolidationMapping {
  consolidated: string
  sources: string[]
}

interface VerificationResult {
  mappings: ConsolidationMapping[]
  missingContent: Array<{
    consolidated: string
    source: string
    missing: string[]
  }>
  summary: {
    total: number
    verified: number
    withMissing: number
  }
}

// Known consolidations
const CONSOLIDATIONS: ConsolidationMapping[] = [
  {
    consolidated: 'docs/DRIZZLE-GUIDE.md',
    sources: [
      'docs/archive/technical-analysis/DRIZZLE-RESEARCH-SUMMARY.md',
      'docs/archive/technical-analysis/DRIZZLE-COMPATIBILITY-ANALYSIS.md',
      'docs/archive/technical-analysis/DRIZZLE-IMPLEMENTATION-FIXES.md',
    ],
  },
  {
    consolidated: 'docs/VALIDATION-GUIDE.md',
    sources: [
      'docs/archive/technical-analysis/AUTOMATED-VALIDATION-GUIDE.md',
      'docs/archive/technical-analysis/MANUAL-VALIDATION-GUIDE.md',
      'docs/archive/technical-analysis/AUTOMATION-QUICK-START.md',
    ],
  },
]

function extractKeyContent(content: string): Set<string> {
  const keyContent = new Set<string>()

  // Extract headings
  const headings = content.match(/^#+\s+(.+)$/gm)
  if (headings) {
    headings.forEach((h) => {
      const heading = h.replace(/^#+\s+/, '').trim()
      keyContent.add(`heading:${heading}`)
    })
  }

  // Extract code blocks
  const codeBlocks = content.match(/```[\s\S]*?```/g)
  if (codeBlocks) {
    codeBlocks.forEach((block, index) => {
      const hash = block.substring(0, 100).replace(/\s/g, '')
      keyContent.add(`code:${index}:${hash}`)
    })
  }

  // Extract important sections (lines with specific keywords)
  const importantLines = content.split('\n').filter((line) => {
    const lower = line.toLowerCase()
    return (
      lower.includes('important:') ||
      lower.includes('warning:') ||
      lower.includes('note:') ||
      lower.includes('critical:') ||
      lower.includes('status:')
    )
  })
  importantLines.forEach((line) => {
    keyContent.add(`important:${line.trim().substring(0, 100)}`)
  })

  return keyContent
}

async function verifyConsolidation(mapping: ConsolidationMapping): Promise<string[]> {
  const missing: string[] = []

  if (!existsSync(mapping.consolidated)) {
    missing.push(`Consolidated file not found: ${mapping.consolidated}`)
    return missing
  }

  const consolidatedContent = await fs.readFile(mapping.consolidated, 'utf-8')
  const consolidatedKeys = extractKeyContent(consolidatedContent)

  for (const source of mapping.sources) {
    if (!existsSync(source)) {
      continue // Source file may not exist
    }

    const sourceContent = await fs.readFile(source, 'utf-8')
    const sourceKeys = extractKeyContent(sourceContent)

    // Check if key content from source exists in consolidated
    for (const key of sourceKeys) {
      if (!consolidatedKeys.has(key)) {
        // Check if similar content exists (fuzzy match)
        const keyType = key.split(':')[0]
        const keyValue = key.split(':').slice(1).join(':')

        if (keyType === 'heading') {
          // Check if heading exists with different formatting
          const headingExists = consolidatedContent.toLowerCase().includes(keyValue.toLowerCase())
          if (!headingExists) {
            missing.push(`Missing heading from ${path.basename(source)}: ${keyValue}`)
          }
        } else if (keyType === 'important') {
          // Check if important content exists
          const contentExists = consolidatedContent
            .toLowerCase()
            .includes(keyValue.toLowerCase().substring(0, 50))
          if (!contentExists) {
            missing.push(`Missing important content from ${path.basename(source)}`)
          }
        }
      }
    }
  }

  return missing
}

async function verifyConsolidations(): Promise<VerificationResult> {
  const mappings: ConsolidationMapping[] = []

  // Check which consolidations exist
  for (const mapping of CONSOLIDATIONS) {
    if (existsSync(mapping.consolidated)) {
      mappings.push(mapping)
    }
  }

  const missingContent: Array<{
    consolidated: string
    source: string
    missing: string[]
  }> = []

  for (const mapping of mappings) {
    const missing = await verifyConsolidation(mapping)
    if (missing.length > 0) {
      missingContent.push({
        consolidated: mapping.consolidated,
        source: mapping.sources.join(', '),
        missing,
      })
    }
  }

  return {
    mappings,
    missingContent,
    summary: {
      total: mappings.length,
      verified: mappings.length - missingContent.length,
      withMissing: missingContent.length,
    },
  }
}

async function generateReport(result: VerificationResult): Promise<string> {
  const lines: string[] = []
  lines.push('# Documentation Consolidation Verification Report')
  lines.push('')
  lines.push(`**Generated**: ${new Date().toISOString()}`)
  lines.push('')
  lines.push('## Summary')
  lines.push('')
  lines.push(`- **Total Consolidations**: ${result.summary.total}`)
  lines.push(`- **Verified**: ${result.summary.verified}`)
  lines.push(`- **With Missing Content**: ${result.summary.withMissing}`)
  lines.push('')

  if (result.missingContent.length > 0) {
    lines.push('## Missing Content')
    lines.push('')
    for (const item of result.missingContent) {
      lines.push(`### ${item.consolidated}`)
      lines.push('')
      lines.push(`**Source Files**: ${item.source}`)
      lines.push('')
      lines.push('**Missing Content**:')
      lines.push('')
      for (const missing of item.missing) {
        lines.push(`- ${missing}`)
      }
      lines.push('')
    }
  }

  if (result.missingContent.length === 0) {
    lines.push('✅ **All consolidations verified successfully!**')
    lines.push('')
  }

  return lines.join('\n')
}

async function runVerification() {
  try {
    await getProjectRoot(import.meta.url)
    logger.header('Documentation Consolidation Verification')
    logger.info('Verifying consolidations...')
    const result = await verifyConsolidations()

    logger.info(`\n📊 Results:`)
    logger.info(`  Total consolidations: ${result.summary.total}`)
    logger.info(`  Verified: ${result.summary.verified}`)
    logger.info(`  With missing content: ${result.summary.withMissing}`)

    const report = await generateReport(result)
    const reportPath = path.join(process.cwd(), 'docs', 'CONSOLIDATION-VERIFICATION-REPORT.md')
    await fs.writeFile(reportPath, report, 'utf-8')
    logger.success(`\n📄 Report written to: ${reportPath}`)

    if (result.missingContent.length > 0) {
      logger.error('\n❌ Missing content found. See report for details.')
      process.exit(1)
    } else {
      logger.success('\n✅ All consolidations verified successfully!')
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
