#!/usr/bin/env tsx
/**
 * Batch fix version mismatches across all packages to match pnpm catalog
 */
import { readFileSync, writeFileSync } from 'node:fs'
import glob from 'fast-glob'

// Define target versions from pnpm catalog (pnpm-workspace.yaml)
const targetVersions: Record<string, string> = {
  '@types/node': '^25.2.0',
  bcryptjs: '^3.0.3',
  globals: '^15.11.0',
  jsdom: '^27.4.0',
  pg: '^8.18.0',
  tsx: '^4.21.0',
  vitest: '^4.0.18',
  zod: '^4.3.5',
}

console.log('📦 Fixing version mismatches across monorepo...\n')
console.log('Target versions from catalog:')
for (const [pkg, version] of Object.entries(targetVersions)) {
  console.log(`  ${pkg}: ${version}`)
}
console.log('')

// Find all package.json files
const packageFiles = await glob(['package.json', 'apps/*/package.json', 'packages/*/package.json'])

let totalFixed = 0

for (const file of packageFiles) {
  const content = readFileSync(file, 'utf-8')
  const pkg = JSON.parse(content)
  let modified = false

  // Fix versions in dependencies and devDependencies
  for (const depType of ['dependencies', 'devDependencies']) {
    if (!pkg[depType]) continue

    for (const [name, targetVersion] of Object.entries(targetVersions)) {
      if (pkg[depType][name] && pkg[depType][name] !== targetVersion) {
        console.log(`  ${file}:`)
        console.log(`    ${depType}.${name}: ${pkg[depType][name]} → ${targetVersion}`)
        pkg[depType][name] = targetVersion
        modified = true
        totalFixed++
      }
    }
  }

  // Write back if modified
  if (modified) {
    writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`)
  }
}

console.log(`\n✅ Fixed ${totalFixed} version mismatches across ${packageFiles.length} packages`)
console.log('\nNext steps:')
console.log('  1. Run: pnpm install')
console.log('  2. Run: pnpm deps:check (should show 0 mismatches)')
