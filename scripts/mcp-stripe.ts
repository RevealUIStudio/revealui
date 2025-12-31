#!/usr/bin/env tsx

import { spawn } from 'child_process'
import { config } from 'dotenv'

// Load environment variables
config()

const stripeSecretKey = process.env.STRIPE_SECRET_KEY

if (!stripeSecretKey) {
  console.error('❌ STRIPE_SECRET_KEY environment variable is required')
  console.error('   Get your key from: https://dashboard.stripe.com/apikeys')
  process.exit(1)
}

console.log('🚀 Starting Stripe MCP Server...')
console.log('   Secret Key:', `${stripeSecretKey.substring(0, 12)}...`)

// Spawn the @stripe/mcp process
const child = spawn('npx', ['@stripe/mcp', '--tools=all', `--api-key=${stripeSecretKey}`], {
  stdio: 'inherit',
  env: {
    ...process.env,
    STRIPE_SECRET_KEY: stripeSecretKey
  }
})

child.on('error', (error) => {
  console.error('❌ Failed to start Stripe MCP server:', error.message)
  process.exit(1)
})

child.on('exit', (code) => {
  process.exit(code || 0)
})

// Handle termination signals
process.on('SIGINT', () => {
  console.log('\n🛑 Stopping Stripe MCP Server...')
  child.kill('SIGINT')
})

process.on('SIGTERM', () => {
  console.log('\n🛑 Stopping Stripe MCP Server...')
  child.kill('SIGTERM')
})
