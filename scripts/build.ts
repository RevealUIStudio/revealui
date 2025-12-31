#!/usr/bin/env tsx

import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'

interface BuildOptions {
  clean?: boolean
  watch?: boolean
  verbose?: boolean
}

function parseArgs(): BuildOptions {
  const args = process.argv.slice(2)
  return {
    clean: args.includes('--clean'),
    watch: args.includes('--watch'),
    verbose: args.includes('--verbose')
  }
}

async function runCommand(command: string, args: string[], options: { cwd?: string; description: string; verbose?: boolean }): Promise<number> {
  return new Promise((resolve) => {
    console.log(`🔧 ${options.description}...`)

    const child = spawn(command, args, {
      stdio: options.verbose ? 'inherit' : ['ignore', 'pipe', 'pipe'],
      cwd: options.cwd || process.cwd(),
      env: process.env
    })

    if (!options.verbose) {
      let stdout = ''
      let stderr = ''

      child.stdout?.on('data', (data) => {
        stdout += data.toString()
      })

      child.stderr?.on('data', (data) => {
        stderr += data.toString()
      })

      child.on('close', (code) => {
        if (code === 0) {
          console.log(`✅ ${options.description} completed`)
        } else {
          console.log(`❌ ${options.description} failed`)
          if (stderr) console.error(stderr)
        }
        resolve(code || 0)
      })
    } else {
      child.on('close', (code) => {
        resolve(code || 0)
      })
    }

    child.on('error', (error) => {
      console.error(`❌ Failed to run ${options.description}:`, error.message)
      resolve(1)
    })
  })
}

async function main() {
  const options = parseArgs()

  console.log('🚀 RevealUI Build System')
  console.log('========================\n')

  if (options.clean) {
    console.log('🧹 Cleaning previous builds...\n')

    // Clean turbo cache
    await runCommand('pnpm', ['turbo', 'clean'], { description: 'Clean turbo cache' })

    // Clean Next.js cache
    const nextCache = join(process.cwd(), 'apps/web/.next')
    if (existsSync(nextCache)) {
      await runCommand('rm', ['-rf', nextCache], { description: 'Clean Next.js cache' })
    }

    console.log('')
  }

  // Type check first
  console.log('🔍 Running type checks...\n')
  const typeCheckCode = await runCommand('pnpm', ['typecheck'], { description: 'TypeScript type checking' })

  if (typeCheckCode !== 0) {
    console.error('\n❌ Type checking failed. Fix type errors before building.')
    process.exit(1)
  }

  // Lint check
  console.log('\n🔍 Running lint checks...\n')
  const lintCode = await runCommand('pnpm', ['lint'], { description: 'ESLint checks' })

  if (lintCode !== 0) {
    console.error('\n❌ Linting failed. Fix lint errors before building.')
    process.exit(1)
  }

  // Main build
  console.log('\n🔨 Building all packages...\n')
  const buildArgs = ['turbo', 'build']
  if (options.watch) {
    buildArgs.push('--watch')
  }

  const buildCode = await runCommand('pnpm', buildArgs, {
    description: options.watch ? 'Build (watch mode)' : 'Build all packages'
  })

  if (buildCode !== 0) {
    console.error('\n❌ Build failed.')
    process.exit(1)
  }

  if (!options.watch) {
    console.log('\n🎉 All builds completed successfully!')
    console.log('   Your packages are ready for deployment.')
  }
}

// Handle script execution
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Build script failed:', error)
    process.exit(1)
  })
}
