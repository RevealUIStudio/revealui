#!/usr/bin/env tsx
/**
 * Regenerate Supabase Types - Manual Script
 *
 * This script provides a convenient way to regenerate Supabase types manually.
 * Useful for CI/CD pipelines or when you want to ensure types are up to date
 * without relying on git hooks.
 *
 * Usage:
 *   pnpm regenerate:supabase-types
 *   pnpm regenerate:supabase-types --force
 */

import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const FORCE = process.argv.includes('--force')

async function main() {
  console.log('🔄 Regenerating Supabase types...\n')

  // Check if SUPABASE_ACCESS_TOKEN is available
  const envPath = join(process.cwd(), '.env')
  let hasToken = false

  if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, 'utf-8')
    hasToken = envContent.includes('SUPABASE_ACCESS_TOKEN=')
  }

  if (!hasToken && !FORCE) {
    console.warn('⚠️  SUPABASE_ACCESS_TOKEN not found in .env file')
    console.log('💡 This is normal - types will be regenerated when available')
    console.log('💡 Use --force to continue anyway\n')
  }

  try {
    // Run the existing generate script
    execSync('pnpm generate:supabase-types', {
      stdio: 'inherit',
      cwd: process.cwd(),
    })

    console.log('\n✅ Supabase types regenerated successfully!')
    console.log('📁 Updated files:')
    console.log('  - packages/services/src/supabase/types.ts')
    console.log('  - packages/core/src/generated/types/supabase.ts')
  } catch (error) {
    console.error('\n❌ Failed to regenerate Supabase types:')
    console.error(error instanceof Error ? error.message : String(error))

    if (!FORCE) {
      console.log('\n💡 Tips:')
      console.log('  - Check your SUPABASE_ACCESS_TOKEN in .env')
      console.log('  - Ensure your Supabase project is accessible')
      console.log('  - Use --force to skip token validation')
    }

    process.exit(1)
  }
}

main().catch(console.error)
