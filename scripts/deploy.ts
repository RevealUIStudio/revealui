#!/usr/bin/env tsx

import { spawn } from 'child_process'
import { config } from 'dotenv'

// Load environment variables
config()

console.log('🚀 Starting RevealUI Deployment...')
console.log('==================================\n')

// Check for required environment variables for deployment
const vercelToken = process.env.VERCEL_TOKEN || process.env.VERCEL_API_TOKEN

if (!vercelToken) {
  console.error('❌ VERCEL_TOKEN or VERCEL_API_TOKEN environment variable is required')
  console.error('   Get your token from: https://vercel.com/account/tokens')
  console.error('   Add it to your .env file as VERCEL_TOKEN=your_token_here\n')
  process.exit(1)
}

console.log('✅ Environment validation passed')
console.log('   Vercel Token:', `${vercelToken.substring(0, 8)}...`)
console.log('')

// Build the project first
console.log('🔨 Building project...')
const buildProcess = spawn('pnpm', ['build'], {
  stdio: 'inherit',
  env: process.env
})

buildProcess.on('close', (code) => {
  if (code !== 0) {
    console.error(`❌ Build failed with exit code ${code}`)
    process.exit(1)
  }

  console.log('✅ Build completed successfully\n')

  // Now deploy to Vercel
  console.log('📦 Deploying to Vercel...')
  const deployProcess = spawn('vercel', ['--prod', '--yes'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      VERCEL_TOKEN: vercelToken
    }
  })

  deployProcess.on('close', (deployCode) => {
    if (deployCode === 0) {
      console.log('\n🎉 Deployment completed successfully!')
      console.log('   Your app is now live on Vercel')
    } else {
      console.error(`\n❌ Deployment failed with exit code ${deployCode}`)
      process.exit(1)
    }
  })

  deployProcess.on('error', (error) => {
    console.error('❌ Failed to start Vercel deployment:', error.message)
    process.exit(1)
  })
})

buildProcess.on('error', (error) => {
  console.error('❌ Failed to start build process:', error.message)
  process.exit(1)
})
