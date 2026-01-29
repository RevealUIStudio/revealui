#!/usr/bin/env tsx
import { existsSync } from 'node:fs'
import { readdir, unlink } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'

const COLORS = { reset: '\x1b[0m', red: '\x1b[31m', green: '\x1b[32m', blue: '\x1b[34m' }

const EXPLICIT_CLEANUP_LIST = [
  // Non-functional Placeholders & Redundant
  'scripts/measure-performance.js',
  'scripts/automation/auto-start-dev.ts',
  'scripts/test/performance-regression.ts',

  // Obsolete Documentation Micro-scripts (using actual current paths)
  'scripts/docs/detect-duplicates.ts',
  'scripts/docs/detect-stale-docs.ts',
  'scripts/docs/docs-lifecycle.ts',
  'scripts/docs/jsdoc-coverage.ts',
  'scripts/docs/maintenance-check.ts',
  'scripts/docs/manage-assessments.ts',
  'scripts/docs/merge-docs.ts',
  'scripts/docs/review-archive.ts',
  'scripts/docs/validate-all.ts',
  'scripts/docs/validate-documentation-accuracy.ts',
  'scripts/docs/validate-jsdoc.ts',
  'scripts/docs/verify-docs.ts',
  'scripts/docs/run-lifecycle.ts',
  'scripts/docs/validate-references-core.ts',
  'scripts/docs/validate-references.ts',
  'scripts/docs/api-doc-extractor.ts',
  'scripts/docs/api-doc-template.ts',
  'scripts/docs/build-docs-site.ts',
  'scripts/docs/consolidate-root-docs.ts',

  // Failed Migration Artifacts
  'scripts/validation/package-extraction-guardrails.sh',
]

async function safeDelete(filePath: string) {
  try {
    if (existsSync(filePath)) {
      await unlink(filePath)
      console.log(`${COLORS.green}✅ Deleted: ${filePath}${COLORS.reset}`)
      return true
    }
  } catch (e) {
    console.error(`${COLORS.red}❌ Error deleting ${filePath}: ${e}${COLORS.reset}`)
  }
  return false
}

async function cleanupDuplicates(dir: string) {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory() && entry.name !== 'node_modules') {
      await cleanupDuplicates(fullPath)
    } else if (extname(entry.name) === '.sh') {
      const base = join(dir, basename(entry.name, '.sh'))
      if (existsSync(`${base}.ts`) || existsSync(`${base}.mjs`)) {
        await safeDelete(fullPath)
      }
    }
  }
}

async function main() {
  console.log(`${COLORS.blue}🧹 Executing Deep Cleanup...${COLORS.reset}`)
  let count = 0
  for (const file of EXPLICIT_CLEANUP_LIST) {
    if (await safeDelete(file)) count++
  }
  await cleanupDuplicates(join(process.cwd(), 'scripts'))
  console.log(`\n${COLORS.green}Done! Total files removed: ${count}${COLORS.reset}`)
}

main()
