#!/usr/bin/env tsx
/**
 * Generate Supabase Types (Official CLI)
 *
 * Uses the official Supabase CLI for reliable type generation.
 * This is the recommended approach from Supabase documentation.
 *
 * Prerequisites:
 * - SUPABASE_ACCESS_TOKEN environment variable
 * - Supabase CLI installed (pnpm dlx supabase)
 *
 * Usage:
 *   pnpm regenerate:supabase-types
 */

import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

async function main() {
  console.log('🔄 Generating Supabase types using official CLI...\n')

  // Check for required environment variables
  const projectId = process.env.SUPABASE_PROJECT_ID
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN

  if (!projectId) {
    console.error('❌ SUPABASE_PROJECT_ID environment variable is required')
    console.error('💡 Add SUPABASE_PROJECT_ID to your .env file')
    process.exit(1)
  }

  if (!accessToken) {
    console.warn('⚠️  SUPABASE_ACCESS_TOKEN not found')
    console.log('💡 This is normal - types will still generate for public schema')
    console.log('💡 For full access, add SUPABASE_ACCESS_TOKEN to .env\n')
  }

  try {
    const outputPath = 'packages/services/src/supabase/types.ts'
    const copyPath = 'packages/core/src/generated/types/supabase.ts'

    // Generate types using official Supabase CLI
    console.log('📡 Calling Supabase CLI...')
    const command = `pnpm dlx supabase gen types typescript --project-id ${projectId} --schema public`

    console.log(`Running: ${command}`)
    const typesOutput = execSync(command, {
      encoding: 'utf-8',
      env: { ...process.env, SUPABASE_ACCESS_TOKEN: accessToken }
    })

    // Write the generated types
    writeFileSync(outputPath, typesOutput)
    console.log(`✅ Generated types saved to: ${outputPath}`)

    // Copy to core package
    writeFileSync(copyPath, typesOutput)
    console.log(`✅ Copied types to: ${copyPath}`)

    console.log('\n🎉 Supabase types generated successfully!')
    console.log('📊 Generated files:')
    console.log(`   - ${outputPath}`)
    console.log(`   - ${copyPath}`)

    // Show a summary of what was generated
    const lines = typesOutput.split('\n')
    const tableCount = (typesOutput.match(/Tables:\s*{/g) || []).length
    const viewCount = (typesOutput.match(/Views:\s*{/g) || []).length
    const functionCount = (typesOutput.match(/Functions:\s*{/g) || []).length

    console.log('\n📈 Generation Summary:')
    console.log(`   - Tables: ${tableCount}`)
    console.log(`   - Views: ${viewCount}`)
    console.log(`   - Functions: ${functionCount}`)
    console.log(`   - Total lines: ${lines.length}`)

  } catch (error) {
    console.error('\n❌ Failed to generate Supabase types:')
    console.error(error instanceof Error ? error.message : String(error))

    // Provide helpful troubleshooting
    console.log('\n🔧 Troubleshooting:')
    console.log('1. Check your SUPABASE_PROJECT_ID in .env')
    console.log('2. Verify SUPABASE_ACCESS_TOKEN (optional but recommended)')
    console.log('3. Ensure your Supabase project is accessible')
    console.log('4. Try: supabase login (if using CLI auth)')

    console.log('\n📖 Official docs:')
    console.log('https://supabase.com/docs/guides/api/rest/generating-types')

    process.exit(1)
  }
}

main().catch(console.error)