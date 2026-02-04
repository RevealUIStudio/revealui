#!/usr/bin/env tsx

/**
 * MCP Setup Verification
 *
 * Verifies all MCP server configurations and dependencies are properly set up.
 *
 * @dependencies
 * - node:fs - File system operations
 * - node:child_process - Command execution
 * - scripts/lib/errors.ts - Error handling
 * - scripts/lib/index.ts - Logger utilities
 */

import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { ErrorCode } from '../lib/errors.js'
import { createLogger } from '../lib/index.js'

const logger = createLogger({ prefix: 'MCPVerify' })

interface MCPServer {
  name: string
  adapter: string
  envVars: string[]
  package?: string
  command: string
}

const MCP_SERVERS: MCPServer[] = [
  {
    name: 'Neon Database',
    adapter: 'packages/mcp/src/servers/neon.ts',
    envVars: ['NEON_API_KEY'],
    package: '@neondatabase/mcp-server-neon',
    command: 'pnpm mcp:neon',
  },
  {
    name: 'Stripe',
    adapter: 'packages/mcp/src/servers/stripe.ts',
    envVars: ['STRIPE_SECRET_KEY'],
    package: '@stripe/mcp',
    command: 'pnpm mcp:stripe',
  },
  {
    name: 'Vercel',
    adapter: 'packages/mcp/src/servers/vercel.ts',
    envVars: ['VERCEL_TOKEN'],
    command: 'pnpm mcp:vercel',
  },
  {
    name: 'Supabase',
    adapter: 'packages/mcp/src/servers/supabase.ts',
    envVars: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
    command: 'pnpm mcp:supabase',
  },
  {
    name: 'Playwright',
    adapter: 'packages/mcp/src/servers/playwright.ts',
    envVars: [],
    command: 'pnpm mcp:playwright',
  },
  {
    name: 'Next.js DevTools',
    adapter: 'packages/mcp/src/servers/next-devtools.ts',
    envVars: [],
    command: 'pnpm mcp:next-devtools',
  },
]

interface VerificationResult {
  server: string
  adapterExists: boolean
  envVarsSet: string[]
  envVarsMissing: string[]
  packageInstalled: boolean | null
  scriptExists: boolean
  status: 'pass' | 'warning' | 'fail'
  issues: string[]
}

async function verifyMCPServer(server: MCPServer): Promise<VerificationResult> {
  const result: VerificationResult = {
    server: server.name,
    adapterExists: false,
    envVarsSet: [],
    envVarsMissing: [],
    packageInstalled: null,
    scriptExists: false,
    status: 'pass',
    issues: [],
  }

  // Check adapter file exists
  result.adapterExists = existsSync(server.adapter)
  if (!result.adapterExists) {
    result.issues.push(`Adapter file not found: ${server.adapter}`)
    result.status = 'fail'
  }

  // Check environment variables
  for (const envVar of server.envVars) {
    if (process.env[envVar]) {
      result.envVarsSet.push(envVar)
    } else {
      result.envVarsMissing.push(envVar)
      if (result.status === 'pass') result.status = 'warning'
    }
  }

  // Check package installation (if required)
  if (server.package) {
    try {
      const output = execSync(`pnpm list ${server.package} --depth=0`, {
        encoding: 'utf-8',
        stdio: 'pipe',
      })
      result.packageInstalled = output.includes(server.package)
      if (!result.packageInstalled) {
        result.issues.push(`Package not installed: ${server.package}`)
        result.status = 'fail'
      }
    } catch {
      result.packageInstalled = false
      result.issues.push(`Package not installed: ${server.package}`)
      result.status = 'fail'
    }
  }

  // Check package.json script exists
  try {
    const packageJson = JSON.parse(execSync('cat package.json', { encoding: 'utf-8' }))
    const scriptName = server.command.replace('pnpm ', '')
    result.scriptExists = Boolean(packageJson.scripts?.[scriptName])
    if (!result.scriptExists) {
      result.issues.push(`Script not found in package.json: ${scriptName}`)
      result.status = 'fail'
    }
  } catch (_error) {
    result.issues.push('Failed to read package.json')
    result.status = 'fail'
  }

  return result
}

async function verifyAllMCPServers(): Promise<void> {
  logger.header('MCP Server Setup Verification')
  console.log()

  const results: VerificationResult[] = []

  for (const server of MCP_SERVERS) {
    logger.info(`Checking ${server.name}...`)
    const result = await verifyMCPServer(server)
    results.push(result)
  }

  console.log()
  logger.header('Verification Results')
  console.log()

  let allPass = true
  let hasWarnings = false

  for (const result of results) {
    const icon = result.status === 'pass' ? '✅' : result.status === 'warning' ? '⚠️' : '❌'
    console.log(`${icon} ${result.server}`)

    if (result.status === 'fail') allPass = false
    if (result.status === 'warning') hasWarnings = true

    if (!result.adapterExists) {
      console.log('   ❌ Adapter file missing')
    } else {
      console.log('   ✅ Adapter file exists')
    }

    if (result.packageInstalled !== null) {
      if (result.packageInstalled) {
        console.log('   ✅ Package installed')
      } else {
        console.log('   ❌ Package not installed')
      }
    }

    if (result.scriptExists) {
      console.log('   ✅ Package script exists')
    } else {
      console.log('   ❌ Package script missing')
    }

    if (result.envVarsSet.length > 0) {
      console.log(`   ✅ Env vars set: ${result.envVarsSet.join(', ')}`)
    }

    if (result.envVarsMissing.length > 0) {
      console.log(`   ⚠️  Env vars missing: ${result.envVarsMissing.join(', ')}`)
    }

    if (result.issues.length > 0) {
      console.log('   Issues:')
      for (const issue of result.issues) {
        console.log(`     - ${issue}`)
      }
    }

    console.log()
  }

  // Summary
  console.log('─'.repeat(60))
  const passed = results.filter((r) => r.status === 'pass').length
  const warned = results.filter((r) => r.status === 'warning').length
  const failed = results.filter((r) => r.status === 'fail').length

  console.log(`Summary: ${passed} passed, ${warned} warnings, ${failed} failed`)
  console.log()

  if (!allPass) {
    logger.warn('Some MCP servers have configuration issues')
    logger.info('Fix the issues above and run this script again')
    process.exit(ErrorCode.VALIDATION_ERROR)
  }

  if (hasWarnings) {
    logger.warn('Some MCP servers have missing environment variables')
    logger.info('Set the required environment variables in .env file')
    logger.success('MCP servers are functional but may need configuration')
  } else {
    logger.success('All MCP servers are properly configured!')
  }
}

async function main() {
  try {
    await verifyAllMCPServers()
  } catch (error) {
    logger.error(`Verification failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(ErrorCode.EXECUTION_ERROR)
  }
}

main()
