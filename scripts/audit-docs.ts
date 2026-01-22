#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import fg from 'fast-glob'

// False claim patterns to detect
const FALSE_CLAIM_PATTERNS: Array<{
  pattern: RegExp
  category: string
  description: string
}> = [
  // Status inflation
  { pattern: /comprehensive tests/i, category: 'statusInflation', description: 'Claims comprehensive testing when tests cannot run' },
  { pattern: /enterprise-grade security/i, category: 'statusInflation', description: 'Claims enterprise-grade security when unverified' },
  { pattern: /production ready/i, category: 'statusInflation', description: 'Claims production readiness with known blockers' },

  // Metric misrepresentation
  { pattern: /console statements.*\d+.*target achieved/i, category: 'metricMisrepresentation', description: 'False achievement claims for console statements' },
  { pattern: /tests.*cannot run/i, category: 'metricMisrepresentation', description: 'Conflicting test status claims' },

  // Completion overstatement
  { pattern: /phase.*completed/i, category: 'completionOverstatement', description: 'Phase completion claims' },
  { pattern: /cleanup.*complete/i, category: 'completionOverstatement', description: 'Cleanup completion claims' },
  { pattern: /assessment.*complete/i, category: 'completionOverstatement', description: 'Assessment completion claims' },

  // Outdated content
  { pattern: /\b202[6-9]\b/, category: 'outdatedContent', description: 'Future dates in current documentation' }
]

interface AuditResult {
  totalFiles: number
  falseClaims: Array<{
    file: string
    category: string
    description: string
    pattern: string
    matches: RegExpMatchArray
    context: string
    verification: string
  }>
  categories: Record<string, Array<any>>
  summary: {
    totalClaims: number
    byCategory: Record<string, number>
    byFile: Record<string, number>
  }
}

async function scanForFalseClaims(): Promise<AuditResult> {
  console.log('🔍 Scanning documentation for false claims...\n')

  const files = await fg('docs/**/*.md')
  const results: AuditResult = {
    totalFiles: files.length,
    falseClaims: [],
    categories: {
      statusInflation: [],
      metricMisrepresentation: [],
      completionOverstatement: [],
      outdatedContent: []
    },
    summary: {
      totalClaims: 0,
      byCategory: {},
      byFile: {}
    }
  }

  console.log(`📊 Analyzing ${files.length} documentation files...\n`)

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8')
    const relativePath = path.relative(process.cwd(), file)

    let fileClaims = 0

    FALSE_CLAIM_PATTERNS.forEach(({ pattern, category, description }) => {
      const matches = content.match(pattern)
      if (matches) {
        const claim = {
          file: relativePath,
          category,
          description,
          pattern: pattern.source,
          matches,
          context: getContext(content, matches.index!, 100),
          verification: 'Requires verification' // Will be updated in verify-claims.ts
        }

        results.falseClaims.push(claim)
        results.categories[category as keyof typeof results.categories].push(claim)
        fileClaims++

        // Update summary
        results.summary.totalClaims++
        results.summary.byCategory[category] = (results.summary.byCategory[category] || 0) + 1
        results.summary.byFile[relativePath] = (results.summary.byFile[relativePath] || 0) + 1

        console.log(`❌ ${category}: ${relativePath}`)
        console.log(`   ${description}`)
        console.log(`   Context: "${claim.context}"`)
        console.log()
      }
    })

    if (fileClaims > 0) {
      console.log(`📁 ${relativePath}: ${fileClaims} potential false claims\n`)
    }
  }

  // Generate summary report
  console.log('📊 SCAN COMPLETE\n')
  console.log('='.repeat(50))
  console.log('SUMMARY REPORT')
  console.log('='.repeat(50))

  console.log(`\n📈 Total Files Analyzed: ${results.totalFiles}`)
  console.log(`🚨 Potential False Claims: ${results.summary.totalClaims}`)

  console.log('\n📊 Claims by Category:')
  Object.entries(results.summary.byCategory).forEach(([category, count]) => {
    console.log(`   ${category}: ${count}`)
  })

  console.log('\n📁 Most Problematic Files:')
  Object.entries(results.summary.byFile)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .forEach(([file, count]) => {
      console.log(`   ${file}: ${count} claims`)
    })

  console.log('\n💡 Next Steps:')
  console.log('1. Review the detailed findings above')
  console.log('2. Run verification script: node scripts/verify-claims.ts')
  console.log('3. Create consolidation plan: node scripts/consolidate-docs.ts')

  // Save detailed results
  fs.writeFileSync('docs/audit-results.json', JSON.stringify(results, null, 2))
  console.log('\n💾 Detailed results saved to: docs/audit-results.json')

  return results
}

function getContext(text: string, index: number, length: number): string {
  const start = Math.max(0, index - length)
  const end = Math.min(text.length, index + length)
  return text.slice(start, end).replace(/\n/g, ' ').trim()
}

// Run the audit
scanForFalseClaims().catch(console.error)