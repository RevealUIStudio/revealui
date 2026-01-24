#!/usr/bin/env tsx

/**
 * Unified Documentation Validation Pipeline
 *
 * Runs all documentation validation checks and generates a comprehensive report.
 *
 * Usage:
 *   pnpm docs:validate:all
 */

import { createLogger, execCommand, getProjectRoot } from '../shared/utils.js'

const logger = createLogger()

interface ValidationResult {
  name: string
  success: boolean
  message: string
}

async function runValidation(name: string, command: string[]): Promise<ValidationResult> {
  const projectRoot = await getProjectRoot(import.meta.url)
  const result = await execCommand('pnpm', command, {
    cwd: projectRoot,
    silent: true,
  })

  return {
    name,
    success: result.success,
    message: result.message,
  }
}

async function validateAll(): Promise<void> {
  const _projectRoot = await getProjectRoot(import.meta.url)

  logger.header('Unified Documentation Validation')

  const validations: Array<{ name: string; command: string[] }> = [
    { name: 'Links', command: ['docs:verify:links'] },
    { name: 'Versions', command: ['docs:verify:versions'] },
    { name: 'Commands', command: ['docs:verify:commands'] },
    { name: 'Paths', command: ['docs:verify:paths'] },
    { name: 'Code Examples', command: ['docs:verify:code-examples'] },
    { name: 'Consolidation', command: ['docs:verify:consolidation'] },
    { name: 'JSDoc', command: ['docs:validate:jsdoc'] },
  ]

  const results: ValidationResult[] = []

  logger.info('Running validation checks...\n')

  for (const validation of validations) {
    logger.info(`Checking ${validation.name}...`)
    const result = await runValidation(validation.name, validation.command)
    results.push(result)

    if (result.success) {
      logger.success(`  ✅ ${validation.name} passed`)
    } else {
      logger.error(`  ❌ ${validation.name} failed`)
    }
  }

  // Generate report
  logger.info('\n\nValidation Summary:\n')

  const passed = results.filter((r) => r.success).length
  const failed = results.filter((r) => !r.success).length

  for (const result of results) {
    const status = result.success ? '✅' : '❌'
    logger.info(`${status} ${result.name}`)
  }

  logger.info(`\n\nResults: ${passed} passed, ${failed} failed`)

  if (failed > 0) {
    logger.error('\nSome validations failed. Please review the output above.')
    process.exit(1)
  } else {
    logger.success('\n✅ All validations passed!')
  }
}

async function main() {
  try {
    await validateAll()
  } catch (error) {
    logger.error(`Script failed: ${error instanceof Error ? error.message : String(error)}`)
    if (error instanceof Error && error.stack) {
      logger.error(`Stack trace: ${error.stack}`)
    }
    process.exit(1)
  }
}

main()
