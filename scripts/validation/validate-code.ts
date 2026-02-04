#!/usr/bin/env tsx
/**
 * Code Validator CLI
 *
 * Validates code files against RevealUI standards
 *
 * Usage:
 *   pnpm validate:code <file>              # Validate single file
 *   pnpm validate:code --stdin             # Validate from stdin
 *   pnpm validate:code --auto-fix <file>   # Auto-fix violations
 */

import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Import from built dist or source
async function importValidator() {
  try {
    // Try dist first (after build)
    return await import('../../packages/dev/dist/code-validator/index.js')
  } catch {
    // Fall back to source
    return await import('../../packages/dev/src/code-validator/index.js')
  }
}

const validatorModule = await importValidator()
const { createValidator } = validatorModule

interface CLIOptions {
  filePath?: string
  stdin?: boolean
  autoFix?: boolean
  json?: boolean
}

async function parseArgs(): Promise<CLIOptions> {
  const args = process.argv.slice(2)
  const options: CLIOptions = {}

  for (const arg of args) {
    if (arg === '--stdin') {
      options.stdin = true
    } else if (arg === '--auto-fix') {
      options.autoFix = true
    } else if (arg === '--json') {
      options.json = true
    } else if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    } else if (!arg.startsWith('--')) {
      options.filePath = arg
    }
  }

  return options
}

function printHelp() {
  console.log(`
Code Validator CLI

Validates code files against RevealUI standards to prevent technical debt.

Usage:
  pnpm validate:code <file>              Validate single file
  pnpm validate:code --stdin             Validate from stdin
  pnpm validate:code --auto-fix <file>   Auto-fix violations
  pnpm validate:code --json <file>       Output JSON format

Options:
  --stdin      Read code from stdin
  --auto-fix   Apply automatic fixes
  --json       Output results as JSON
  -h, --help   Show this help message

Examples:
  # Validate a file
  pnpm validate:code src/foo.ts

  # Validate from stdin (useful for git hooks)
  cat src/foo.ts | pnpm validate:code --stdin

  # Auto-fix violations
  pnpm validate:code --auto-fix src/foo.ts

  # Get JSON output for programmatic use
  pnpm validate:code --json src/foo.ts
`)
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf-8')
}

async function main() {
  try {
    const options = await parseArgs()

    // Read code content
    let code: string
    let filePath: string | undefined

    if (options.stdin) {
      code = await readStdin()
    } else if (options.filePath) {
      filePath = resolve(process.cwd(), options.filePath)
      code = await readFile(filePath, 'utf-8')
    } else {
      console.error('Error: Must provide either a file path or --stdin')
      printHelp()
      process.exit(1)
    }

    // Load validator
    const standardsPath = resolve(process.cwd(), '.revealui/code-standards.json')
    const validator = await createValidator(standardsPath)

    // Auto-fix if requested
    if (options.autoFix) {
      const { code: fixedCode, fixesApplied } = validator.autoFix(code)
      if (fixesApplied > 0) {
        console.log(`Applied ${fixesApplied} automatic fixes`)
        if (options.filePath) {
          const fs = await import('node:fs/promises')
          await fs.writeFile(options.filePath, fixedCode, 'utf-8')
          console.log(`Updated ${options.filePath}`)
        } else {
          console.log('\n--- Fixed Code ---\n')
          console.log(fixedCode)
        }
      } else {
        console.log('No auto-fixes available')
      }
    }

    // Validate
    const result = validator.validate(code, { filePath })

    // Output
    if (options.json) {
      console.log(JSON.stringify(result, null, 2))
    } else {
      console.log(validator.formatResult(result))
    }

    // Exit with appropriate code
    process.exit(result.valid ? 0 : 1)
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}

main()
