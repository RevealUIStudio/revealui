#!/usr/bin/env tsx

import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { config } from 'dotenv'

config()

console.log('🚀 Setting up MCP Servers for RevealUI')
console.log('=====================================\n')

// Check for .env file
const envPath = join(process.cwd(), '.env')
const envLocalPath = join(process.cwd(), '.env.local')

let envFile = envPath
if (existsSync(envLocalPath)) {
  envFile = envLocalPath
}

console.log('📝 Checking environment configuration...\n')

// Check for Vercel token
const vercelToken = process.env.VERCEL_API_KEY
if (!vercelToken) {
  console.log('❌ VERCEL_API_KEY not found')
  console.log('   Get your token from: https://vercel.com/account/tokens')
  console.log('   Add it to your .env file:')
  console.log('   VERCEL_API_KEY=your_token_here\n')
} else {
  console.log('✅ VERCEL_API_KEY found')
}

// Check for Stripe key
const stripeKey = process.env.STRIPE_SECRET_KEY
if (!stripeKey) {
  console.log('❌ STRIPE_SECRET_KEY not found')
  console.log('   Get your key from: https://dashboard.stripe.com/apikeys')
  console.log('   Add it to your .env file:')
  console.log('   STRIPE_SECRET_KEY=sk_test_your_key_here\n')
} else {
  console.log('✅ STRIPE_SECRET_KEY found')
}

console.log('\n🔧 MCP Server Configuration')
console.log('===========================\n')

console.log('Available MCP servers:')
console.log('• Vercel MCP - vercel-mcp (free community package)')
console.log('  Provides tools for deployments, domains, env vars, etc.')
console.log('• Stripe MCP - @stripe/mcp')
console.log('  Official Stripe MCP server with 20+ payment & billing tools\n')

console.log('To start MCP servers:')
console.log('• Individual: pnpm mcp:vercel or pnpm mcp:stripe')
console.log('• All together: pnpm mcp:all\n')

console.log('📚 Next steps:')
console.log('1. Configure your AI client (Claude, Cursor, etc.) to connect to MCP servers')
console.log('2. Point your client to the running MCP servers')
console.log('3. Start using AI-powered Vercel and Stripe management!\n')

if (!vercelToken || !stripeKey) {
  console.log('⚠️  Please set up your API keys in .env before running MCP servers\n')
  process.exit(1)
} else {
  console.log('🎉 Ready to launch! Run "pnpm mcp:all" to start all MCP servers\n')
}