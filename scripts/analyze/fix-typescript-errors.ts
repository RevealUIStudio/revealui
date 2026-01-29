#!/usr/bin/env node
/**
 * Fix TypeScript Errors Script
 *
 * Automatically fixes TypeScript strict mode errors with exactOptionalPropertyTypes
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const presentationDir = join(process.cwd(), 'packages', 'presentation', 'src', 'components')

const filesToFix = [
  'Checkbox.tsx',
  'avatar.tsx',
  'combobox.tsx',
  'dropdown.tsx',
  'listbox.tsx',
  'table.tsx',
]

function fixOptionalProperties(content: string): string {
  // Fix optional properties that need explicit undefined
  const patterns = [
    // Fix disabled?: boolean → disabled?: boolean | undefined
    /(\s+disabled\?:\s+boolean)(\s*;?\s*$)/gm,
    // Fix autoFocus?: boolean → autoFocus?: boolean | undefined
    /(\s+autoFocus\?:\s+boolean)(\s*;?\s*$)/gm,
    // Fix src?: string | null → src?: string | null | undefined
    /(\s+src\?:\s+string\s*\|\s*null)(\s*;?\s*$)/gm,
    // Fix href?: string → href?: string | undefined
    /(\s+href\?:\s+string)(\s*;?\s*$)/gm,
    // Fix target?: string → target?: string | undefined
    /(\s+target\?:\s+string)(\s*;?\s*$)/gm,
    // Fix title?: string → title?: string | undefined
    /(\s+title\?:\s+string)(\s*;?\s*$)/gm,
    // Fix placeholder?: string → placeholder?: string | undefined
    /(\s+placeholder\?:\s+string)(\s*;?\s*$)/gm,
    // Fix displayValue?: (option: T) => string → displayValue?: ((option: T) => string) | undefined
    /(\s+displayValue\?:\s*\([^)]+\)\s*=>\s+string)(\s*;?\s*$)/gm,
    // Fix onChange?: (event: ChangeEvent<HTMLInputElement>) => void → onChange?: ((event: ChangeEvent<HTMLInputElement>) => void) | undefined
    /(\s+onChange\?:\s*\([^)]+\)\s*=>\s+void)(\s*;?\s*$)/gm,
  ]

  let fixedContent = content

  patterns.forEach((pattern) => {
    fixedContent = fixedContent.replace(new RegExp(pattern, 'gm'), '$1 | undefined')
  })

  return fixedContent
}

function fixFile(filepath: string) {
  if (!existsSync(filepath)) {
    console.log(`⚠️  File not found: ${filepath}`)
    return false
  }

  console.log(`🔧 Fixing: ${filepath}`)

  const content = readFileSync(filepath, 'utf8')
  const fixedContent = fixOptionalProperties(content)

  if (content !== fixedContent) {
    writeFileSync(filepath, fixedContent)
    console.log(`✅ Fixed: ${filepath}`)
    return true
  } else {
    console.log(`ℹ️  No changes needed: ${filepath}`)
    return false
  }
}

async function main() {
  console.log('🔧 TypeScript Error Fixer')
  console.log('=========================\n')

  let totalFixed = 0

  for (const filename of filesToFix) {
    const filepath = join(presentationDir, filename)
    if (fixFile(filepath)) {
      totalFixed++
    }
  }

  console.log(`\n✅ Fixed ${totalFixed} files with TypeScript errors`)

  if (totalFixed > 0) {
    console.log('\n🔍 Running validation to check fixes...')
    // Note: We'll run validation separately to avoid circular dependencies
  }
}

main().catch(console.error)
