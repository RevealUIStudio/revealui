/**
 * Shared utilities for cross-platform script execution
 */
import { spawn } from 'node:child_process'
import { access, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export interface ScriptResult {
  success: boolean
  message: string
  exitCode: number
}

export function createLogger() {
  const forceColor = process.env.FORCE_COLOR !== '0'
  const colors = {
    reset: forceColor ? '\x1b[0m' : '',
    red: forceColor ? '\x1b[31m' : '',
    green: forceColor ? '\x1b[32m' : '',
    yellow: forceColor ? '\x1b[33m' : '',
    blue: forceColor ? '\x1b[34m' : '',
    cyan: forceColor ? '\x1b[36m' : '',
  }

  return {
    success: (msg: string) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
    error: (msg: string) => console.error(`${colors.red}❌ ${msg}${colors.reset}`),
    warning: (msg: string) => console.warn(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
    info: (msg: string) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
    header: (msg: string) => {
      console.log(`\n${colors.cyan}${'='.repeat(msg.length + 4)}`)
      console.log(`| ${msg} |`)
      console.log(`${'='.repeat(msg.length + 4)}${colors.reset}\n`)
    },
  }
}

export async function getProjectRoot(importMetaUrl: string): Promise<string> {
  const __filename = fileURLToPath(importMetaUrl)
  let currentDir = dirname(__filename)
  for (let i = 0; i < 5; i++) {
    try {
      await access(resolve(currentDir, 'package.json'))
      return currentDir
    } catch {
      currentDir = resolve(currentDir, '..')
    }
  }
  return process.cwd()
}

export async function execCommand(
  command: string,
  args: string[],
  options = {},
): Promise<ScriptResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      ...options,
    })
    child.on('close', (code) => resolve({ success: code === 0, message: '', exitCode: code || 0 }))
  })
}

/**
 * Standardized error handler for AST parsing errors
 */
export function handleASTParseError(
  filePath: string,
  error: unknown,
  logger: ReturnType<typeof createLogger>,
) {
  const message = error instanceof Error ? error.message : String(error)
  logger.warning(`⚠️  AST Parse Error in ${filePath}: ${message}`)
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await readFile(filePath)
    return true
  } catch {
    return false
  }
}

export async function prompt(question: string): Promise<string> {
  const { createInterface } = await import('node:readline')
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  return new Promise((resolve) => {
    rl.question(`${question} (y/N): `, (answer) => {
      rl.close()
      resolve(answer)
    })
  })
}
// export interface ScriptResult {
//   success: boolean
//   message: string
//   exitCode: number
// }

// export function createLogger() {
//   const forceColor = process.env.FORCE_COLOR !== '0'
//   const colors = {
//     reset: forceColor ? '\x1b[0m' : '',
//     red: forceColor ? '\x1b[31m' : '',
//     green: forceColor ? '\x1b[32m' : '',
//     yellow: forceColor ? '\x1b[33m' : '',
//     blue: forceColor ? '\x1b[34m' : '',
//     cyan: forceColor ? '\x1b[36m' : '',
//   }

//   return {
//     success: (msg: string) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
//     error: (msg: string) => console.error(`${colors.red}❌ ${msg}${colors.reset}`),
//     warning: (msg: string) => console.warn(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
//     info: (msg: string) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
//     header: (msg: string) => {
//       console.log(`\n${colors.cyan}${'='.repeat(msg.length + 4)}`)
//       console.log(`| ${msg} |`)
//       console.log(`${'='.repeat(msg.length + 4)}${colors.reset}\n`)
//     },
//   }
// }

// export async function getProjectRoot(importMetaUrl: string): Promise<string> {
//   const __filename = fileURLToPath(importMetaUrl)
//   let currentDir = dirname(__filename)
//   for (let i = 0; i < 5; i++) {
//     try {
//       await access(resolve(currentDir, 'package.json'))
//       return currentDir
//     } catch {
//       currentDir = resolve(currentDir, '..')
//     }
//   }
//   return process.cwd()
// }

// export async function execCommand(
//   command: string,
//   args: string[],
//   options = {},
// ): Promise<ScriptResult> {
//   return new Promise((resolve) => {
//     const child = spawn(command, args, {
//       stdio: 'inherit',
//       shell: process.platform === 'win32',
//       ...options,
//     })
//     child.on('close', (code) => resolve({ success: code === 0, message: '', exitCode: code || 0 }))
//   })
// }

// /**
//  * Standardized error handler for AST parsing errors
//  */
// export function handleASTParseError(
//   filePath: string,
//   error: unknown,
//   logger: ReturnType<typeof createLogger>,
// ) {
//   const message = error instanceof Error ? error.message : String(error)
//   logger.warning(`⚠️  AST Parse Error in ${filePath}: ${message}`)
// }
