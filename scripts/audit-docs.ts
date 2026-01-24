#!/usr/bin/env node

import fs from 'node:fs'
import fg from 'fast-glob'
import path from 'path'

// False claim patterns to detect
const FALSE_CLAIM_PATTERNS = [
  {
    pattern: /comprehensive tests/i,
    category: 'statusInflation',
    description: 'Claims comprehensive testing when tests cannot run',
  },
  {
    pattern: /console statements.*\d+.*target achieved/i,
    category: 'metricMisrepresentation',
    description: 'False achievement claims for console statements',
  },
  {
    pattern: /phase.*completed/i,
    category: 'completionOverstatement',
    description: 'Phase completion claims',
  },
  {
    pattern: /cleanup.*complete/i,
    category: 'completionOverstatement',
    description: 'Cleanup completion claims',
  },
  {
    pattern: /assessment.*complete/i,
    category: 'completionOverstatement',
    description: 'Assessment completion claims',
  },
  {
    pattern: /\b202[6-9]\b/,
    category: 'outdatedContent',
    description: 'Future dates in current documentation',
  },
]

async function scanForFalseClaims(): Promise<void> {
  console.log('🔍 Scanning documentation for false claims...\n')

  const files = await fg('docs/**/*.md')
  const results = {
    totalFiles: files.length,
    falseClaims: [] as any[],
    categories: {
      statusInflation: [] as any[],
      metricMisrepresentation: [] as any[],
      completionOverstatement: [] as any[],
      outdatedContent: [] as any[],
    },
    summary: {
      totalClaims: 0,
      byCategory: {} as Record<string, number>,
      byFile: {} as Record<string, number>,
    },
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
          verification: 'Requires verification',
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
    .sort(([, a], [, b]) => b - a)
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
}

function getContext(text: string, index: number, length: number): string {
  const start = Math.max(0, index - length)
  const end = Math.min(text.length, index + length)
  return text.slice(start, end).replace(/\n/g, ' ').trim()
}

// Run the audit
scanForFalseClaims().catch(console.error)
