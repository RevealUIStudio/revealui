#!/usr/bin/env node
/**
 * Fix Test Errors Script
 *
 * Automatically fixes test failures in the dev package
 *
 * @dependencies
 * - node:fs - File system operations for reading/writing files
 * - node:path - Path manipulation utilities
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

function fixTestImports(content: string): string {
  let fixedContent = content

  // Fix missing @revealui/core import by adding proper imports
  if (content.includes('@revealui/core') && !content.includes('deepMerge')) {
    // Add missing import for deepMerge
    fixedContent = fixedContent.replace(
      /(import\s+.*from\s+['"]@revealui\/core['"];?\s*)/,
      "$1\nimport { deepMerge } from '@revealui/core';",
    )
  }

  return fixedContent
}

function fixFile(filepath: string) {
  if (!existsSync(filepath)) {
    console.log(`⚠️  File not found: ${filepath}`)
    return false
  }

  console.log(`🔧 Fixing tests in: ${filepath}`)

  const content = readFileSync(filepath, 'utf8')
  const fixedContent = fixTestImports(content)

  if (content !== fixedContent) {
    writeFileSync(filepath, fixedContent)
    console.log(`✅ Fixed tests in: ${filepath}`)
    return true
  } else {
    console.log(`ℹ️  No test fixes needed: ${filepath}`)
    return false
  }
}

async function main() {
  console.log('🔧 Test Error Fixer')
  console.log('===================\n')

  const filesToFix = ['packages/dev/src/__tests__/integration/configs.integration.test.ts']

  let totalFixed = 0

  for (const filename of filesToFix) {
    const filepath = join(process.cwd(), filename)
    if (fixFile(filepath)) {
      totalFixed++
    }
  }

  console.log(`\n✅ Fixed tests in ${totalFixed} files`)

  if (totalFixed > 0) {
    console.log('\n🔍 Run test validation to check fixes')
    console.log('Note: Some tests may still fail due to missing dependencies in dev package')
  }
}

main().catch(console.error)
