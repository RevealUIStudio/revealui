#!/usr/bin/env tsx

import { spawn } from 'node:child_process'
import { config } from 'dotenv'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// Load environment variables
config()

const vercelApiKey = process.env.VERCEL_API_KEY ?? process.env.VERCEL_TOKEN

if (!vercelApiKey) {
  console.error('❌ VERCEL_API_KEY environment variable is required')
  console.error('   Get your token from: https://vercel.com/account/tokens')
  process.exit(1)
}

console.log('🚀 Starting Vercel MCP Server...')
console.log(`   API Key: ${vercelApiKey.substring(0, 8)}...`)

// Resolve the vercel-mcp module path dynamically for serverless compatibility
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Construct the vercel-mcp path relative to the script location
const vercelMcpPath = join(__dirname, '../node_modules/vercel-mcp/build/index.js')

// Spawn the vercel-mcp process with API key as command line argument
const child = spawn('node', [vercelMcpPath, `VERCEL_API_KEY=${vercelApiKey}`], {
  stdio: 'inherit',
  env: process.env,
})

child.on('error', (error) => {
  console.error('❌ Failed to start Vercel MCP server:', error.message)
  process.exit(1)
})

child.on('exit', (code) => {
  process.exit(code ?? 0)
})

// Handle termination signals
process.on('SIGINT', () => {
  console.log('\n🛑 Stopping Vercel MCP Server...')
  child.kill('SIGINT')
})

process.on('SIGTERM', () => {
  console.log('\n🛑 Stopping Vercel MCP Server...')
  child.kill('SIGTERM')
})
