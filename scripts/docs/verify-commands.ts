#!/usr/bin/env tsx

/**
 * Documentation Command Verification
 *
 * Verifies that commands referenced in documentation exist in package.json scripts.
 *
 * Usage:
 *   pnpm docs:verify:commands
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import fg from 'fast-glob'
import { createLogger, getProjectRoot } from '../shared/utils.js'

const logger = createLogger()

interface CommandReference {
  file: string
  line: number
  command: string
  exists: boolean
  scriptName: string | null
}

interface VerificationResult {
  references: CommandReference[]
  missing: CommandReference[]
  summary: {
    total: number
    found: number
    missing: number
  }
}

// Extract commands from code blocks
const _CODE_BLOCK_REGEX = /```(?:bash|sh|powershell|shell)?\n([\s\S]*?)```/g
const _COMMAND_REGEX = /^(pnpm|npm|yarn|node|tsx|bash|sh)\s+([^\s#\n]+)/gm

async function loadPackageScripts(): Promise<Set<string>> {
  const packageFiles = await fg('**/package.json', {
    ignore: ['node_modules/**', '.next/**', 'dist/**'],
    cwd: process.cwd(),
  })

  const allScripts = new Set<string>()

  for (const file of packageFiles) {
    const filePath = path.resolve(process.cwd(), file)
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const pkg = JSON.parse(content)
      if (pkg.scripts) {
        for (const scriptName of Object.keys(pkg.scripts)) {
          allScripts.add(scriptName)
          // Also add with pnpm prefix
          allScripts.add(`pnpm ${scriptName}`)
          allScripts.add(`pnpm run ${scriptName}`)
        }
      }
    } catch (error) {
      logger.warning(
        `Failed to parse ${file}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  return allScripts
}

function extractCommands(content: string, filePath: string): CommandReference[] {
  const commands: CommandReference[] = []
  const lines = content.split('\n')

  // Find code blocks
  let inCodeBlock = false
  let _codeBlockStart = 0
  let codeBlockLanguage = ''

  lines.forEach((line, index) => {
    // Check for code block start
    const codeBlockStartMatch = line.match(/^```(\w+)?/)
    if (codeBlockStartMatch) {
      inCodeBlock = true
      _codeBlockStart = index
      codeBlockLanguage = codeBlockStartMatch[1] || ''
      return
    }

    // Check for code block end
    if (line.trim() === '```') {
      inCodeBlock = false
      return
    }

    // Extract commands from code blocks (bash, sh, shell, powershell)
    // Skip if code block is marked as example or has comment indicating it's not a real command
    if (
      inCodeBlock &&
      (codeBlockLanguage === 'bash' ||
        codeBlockLanguage === 'sh' ||
        codeBlockLanguage === 'shell' ||
        codeBlockLanguage === 'powershell' ||
        codeBlockLanguage === '')
    ) {
      // Skip if line is a comment or example marker
      if (line.trim().startsWith('#') || line.includes('example') || line.includes('Example')) {
        return
      }

      // Match command patterns - but skip flags
      const commandMatch = line.match(/^(pnpm|npm|yarn|node|tsx|bash|sh)\s+([^\s#\n]+)/)
      if (commandMatch) {
        const [, tool, script] = commandMatch

        // Skip flags (--filter, --parallel, etc.)
        if (script.startsWith('--') || script.startsWith('-')) {
          return
        }

        // Skip common non-script commands
        const skipCommands = [
          'install',
          'add',
          'remove',
          'update',
          'list',
          'why',
          'run',
          'tsx',
          'licenses',
        ]
        if (skipCommands.includes(script)) {
          return
        }

        // Skip pnpm subcommands (licenses, dlx, etc.)
        if (tool === 'pnpm' && (script.startsWith('licenses') || script.startsWith('dlx'))) {
          return
        }

        // Skip node/tsx with script paths (these are direct executions, not package.json scripts)
        if ((tool === 'node' || tool === 'tsx') && script.includes('/')) {
          return
        }

        // Skip pnpm tsx (it's a tool invocation, not a script)
        if (tool === 'pnpm' && script === 'tsx') {
          return
        }

        let fullCommand = `${tool} ${script}`
        let scriptName = script

        // Normalize pnpm commands
        if (tool === 'pnpm') {
          if (script.startsWith('run ')) {
            scriptName = script.replace('run ', '')
            fullCommand = `pnpm ${scriptName}`
          } else if (script.startsWith('dlx ')) {
            // Skip dlx commands (external tools)
            return
          } else {
            fullCommand = `pnpm ${script}`
          }
        }

        commands.push({
          file: filePath,
          line: index + 1,
          command: fullCommand,
          exists: false,
          scriptName,
        })
      }
    }
  })

  return commands
}

async function verifyCommands(): Promise<VerificationResult> {
  const scripts = await loadPackageScripts()
  const markdownFiles = await fg('**/*.md', {
    ignore: [
      '**/node_modules/**',
      '**/*/node_modules/**',
      'node_modules/**',
      '.next/**',
      'dist/**',
      'docs/archive/**',
      '**/coverage/**',
    ],
    cwd: process.cwd(),
    absolute: false,
  })

  // Filter out node_modules manually (fast-glob ignore sometimes doesn't work)
  const filteredFiles = markdownFiles.filter((f) => {
    const normalized = f.replace(/\\/g, '/')
    return !normalized.includes('node_modules')
  })

  const allReferences: CommandReference[] = []

  for (const file of filteredFiles) {
    const filePath = path.resolve(process.cwd(), file)
    const content = await fs.readFile(filePath, 'utf-8')
    const commands = extractCommands(content, filePath)
    allReferences.push(...commands)
  }

  // Check if commands exist
  for (const ref of allReferences) {
    // Check various formats
    const normalizedCommand = ref.command.replace(/^pnpm run /, 'pnpm ').replace(/^pnpm /, 'pnpm ')

    ref.exists =
      scripts.has(ref.command) ||
      scripts.has(ref.scriptName || '') ||
      scripts.has(normalizedCommand) ||
      scripts.has(ref.command.replace(/^pnpm /, ''))
  }

  const missing = allReferences.filter((ref) => !ref.exists)

  return {
    references: allReferences,
    missing,
    summary: {
      total: allReferences.length,
      found: allReferences.filter((r) => r.exists).length,
      missing: missing.length,
    },
  }
}

async function generateReport(result: VerificationResult): Promise<string> {
  const lines: string[] = []
  lines.push('# Documentation Command Verification Report')
  lines.push('')
  lines.push(`**Generated**: ${new Date().toISOString()}`)
  lines.push('')
  lines.push('## Summary')
  lines.push('')
  lines.push(`- **Total Commands**: ${result.summary.total}`)
  lines.push(`- **Found**: ${result.summary.found}`)
  lines.push(`- **Missing**: ${result.summary.missing}`)
  lines.push('')

  if (result.missing.length > 0) {
    lines.push('## Missing Commands')
    lines.push('')
    lines.push('These commands are referenced in documentation but not found in package.json:')
    lines.push('')
    for (const missing of result.missing) {
      lines.push(`### ${path.relative(process.cwd(), missing.file)}:${missing.line}`)
      lines.push('')
      lines.push(`- **Command**: \`${missing.command}\``)
      lines.push(`- **Script Name**: ${missing.scriptName || 'N/A'}`)
      lines.push('')
    }
  }

  if (result.missing.length === 0) {
    lines.push('✅ **All commands verified successfully!**')
    lines.push('')
  }

  return lines.join('\n')
}

async function runVerification() {
  try {
    await getProjectRoot(import.meta.url)
    logger.header('Documentation Command Verification')
    logger.info('Loading package scripts...')
    const result = await verifyCommands()

    logger.info(`\n📊 Results:`)
    logger.info(`  Total commands: ${result.summary.total}`)
    logger.info(`  Found: ${result.summary.found}`)
    logger.info(`  Missing: ${result.summary.missing}`)

    const report = await generateReport(result)
    const reportPath = path.join(process.cwd(), 'docs', 'COMMAND-VERIFICATION-REPORT.md')
    await fs.writeFile(reportPath, report, 'utf-8')
    logger.success(`\n📄 Report written to: ${reportPath}`)

    if (result.missing.length > 0) {
      logger.error('\n❌ Missing commands found. See report for details.')
      process.exit(1)
    } else {
      logger.success('\n✅ All commands verified successfully!')
      process.exit(0)
    }
  } catch (error) {
    logger.error(`Verification failed: ${error instanceof Error ? error.message : String(error)}`)
    if (error instanceof Error && error.stack) {
      logger.error(`Stack trace: ${error.stack}`)
    }
    process.exit(1)
  }
}

/**
 * Main function
 */
async function main() {
  try {
    await runVerification()
  } catch (error) {
    logger.error(`Script failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}

main()
