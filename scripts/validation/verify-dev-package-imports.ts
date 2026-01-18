#!/usr/bin/env tsx
/**
 * Verification script for dev package imports
 *
 * Ensures all config files use correct `dev/...` import paths
 * and don't use relative paths or incorrect package names
 */

import { readFileSync } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '../..')

interface Issue {
  file: string
  line: number
  message: string
  severity: 'error' | 'warning'
}

const issues: Issue[] = []

// Files to check
const configPatterns = [
  '**/*tailwind*.config.*',
  '**/*postcss*.config.*',
  '**/*vite*.config.*',
  '**/*eslint*.config.*',
]

// Patterns to check for
const badPatterns = [
  {
    pattern: /from\s+['"]\.\.\/\.\.\/packages\/dev\/src/,
    message: 'Uses relative path to packages/dev/src instead of dev/...',
    severity: 'error' as const,
  },
  {
    pattern: /from\s+['"]\.\.\/dev\/src/,
    message: 'Uses relative path to dev/src instead of dev/...',
    severity: 'error' as const,
  },
  {
    pattern: /from\s+['"]@revealui\/dev\//,
    message: 'Uses @revealui/dev instead of dev (only in historical docs is OK)',
    severity: 'error' as const,
  },
]

const goodPatterns = [
  /from\s+['"]dev\//,
  /from\s+['"]dev\/tailwind/,
  /from\s+['"]dev\/postcss/,
  /from\s+['"]dev\/vite/,
  /from\s+['"]dev\/eslint/,
]

async function findConfigFiles(dir: string): Promise<string[]> {
  const files: string[] = []
  const entries = await readdir(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    // Skip node_modules and other ignored directories
    if (
      entry.name === 'node_modules' ||
      entry.name === 'dist' ||
      entry.name === '.next' ||
      entry.name === '.turbo' ||
      entry.name.startsWith('.')
    ) {
      continue
    }

    // Skip generated files (timestamp files, etc.)
    if (entry.name.includes('.timestamp-') || entry.name.includes('.temp.')) {
      continue
    }

    if (entry.isDirectory()) {
      const subFiles = await findConfigFiles(fullPath)
      files.push(...subFiles)
    } else if (
      entry.isFile() &&
      (entry.name.includes('tailwind') ||
        entry.name.includes('postcss') ||
        entry.name.includes('vite') ||
        entry.name.includes('eslint')) &&
      (entry.name.endsWith('.ts') ||
        entry.name.endsWith('.js') ||
        entry.name.endsWith('.mjs'))
    ) {
      files.push(fullPath)
    }
  }

  return files
}

function checkFile(filePath: string): void {
  const content = readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  const relativePath = path.relative(projectRoot, filePath)

  // Skip markdown files (historical docs are OK)
  if (filePath.endsWith('.md')) {
    return
  }

  let hasGoodImport = false

  lines.forEach((line, index) => {
    // Check for bad patterns
    for (const badPattern of badPatterns) {
      if (badPattern.pattern.test(line)) {
        issues.push({
          file: relativePath,
          line: index + 1,
          message: badPattern.message,
          severity: badPattern.severity,
        })
      }
    }

    // Check for good patterns (config files should have at least one)
    for (const goodPattern of goodPatterns) {
      if (goodPattern.test(line)) {
        hasGoodImport = true
      }
    }
  })

  // Warn if config file doesn't use dev/... imports (might be legitimate for some configs)
  // Skip warnings for:
  // - Dev package itself
  // - Test files
  // - Generated/temporary files
  // - Files that aren't the main config files (e.g., vitest.config.ts doesn't need dev imports)
  if (
    !hasGoodImport &&
    (filePath.includes('tailwind.config') ||
      filePath.includes('postcss.config') ||
      filePath.includes('vite.config') ||
      filePath.includes('eslint.config')) &&
    !relativePath.startsWith('packages/dev/') &&
    !relativePath.includes('__tests__') &&
    !relativePath.includes('.timestamp-') &&
    !relativePath.includes('.temp.') &&
    // Only check specific app/package configs that should use dev imports
    (relativePath.startsWith('apps/web/') ||
      relativePath.startsWith('apps/cms/') ||
      relativePath.startsWith('packages/services/'))
  ) {
    issues.push({
      file: relativePath,
      line: 1,
      message:
        'Config file does not appear to use dev/... imports (may be legitimate)',
      severity: 'warning',
    })
  }
}

async function main(): Promise<void> {
  console.log('🔍 Verifying dev package imports...\n')

  const appsDir = path.join(projectRoot, 'apps')
  const packagesDir = path.join(projectRoot, 'packages')

  const files: string[] = []
  if (await stat(appsDir).then(() => true).catch(() => false)) {
    const appFiles = await findConfigFiles(appsDir)
    files.push(...appFiles)
  }
  if (await stat(packagesDir).then(() => true).catch(() => false)) {
    const packageFiles = await findConfigFiles(packagesDir)
    files.push(...packageFiles)
  }

  console.log(`Found ${files.length} config files to check\n`)

  for (const file of files) {
    checkFile(file)
  }

  // Report results
  const errors = issues.filter((i) => i.severity === 'error')
  const warnings = issues.filter((i) => i.severity === 'warning')

  if (errors.length === 0 && warnings.length === 0) {
    console.log('✅ All imports are correct!\n')
    process.exit(0)
  }

  if (errors.length > 0) {
    console.error(`❌ Found ${errors.length} error(s):\n`)
    errors.forEach((issue) => {
      console.error(`  ${issue.file}:${issue.line}`)
      console.error(`    ${issue.message}\n`)
    })
  }

  if (warnings.length > 0) {
    console.warn(`⚠️  Found ${warnings.length} warning(s):\n`)
    warnings.forEach((issue) => {
      console.warn(`  ${issue.file}:${issue.line}`)
      console.warn(`    ${issue.message}\n`)
    })
  }

  process.exit(errors.length > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error('Error running verification:', error)
  process.exit(1)
})
