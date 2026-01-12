#!/usr/bin/env tsx

/**
 * Documentation Code Example Verification
 *
 * Validates TypeScript code examples in documentation.
 *
 * Usage:
 *   pnpm docs:verify:code-examples
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import fg from 'fast-glob'
import { createLogger, getProjectRoot } from '../shared/utils.js'

const logger = createLogger()

interface CodeExample {
  file: string
  line: number
  language: string
  code: string
  errors: string[]
}

interface VerificationResult {
  examples: CodeExample[]
  withErrors: CodeExample[]
  summary: {
    total: number
    typescript: number
    withErrors: number
  }
}

// Extract code blocks from markdown
const CODE_BLOCK_REGEX = /```(\w+)?\n([\s\S]*?)```/g

function extractCodeExamples(content: string, filePath: string): CodeExample[] {
  const examples: CodeExample[] = []
  const _lines = content.split('\n')
  let currentLine = 0

  let match: RegExpExecArray | null
  while ((match = CODE_BLOCK_REGEX.exec(content)) !== null) {
    const language = match[1] || ''
    const code = match[2]

    // Find line number
    const beforeMatch = content.substring(0, match.index)
    currentLine = beforeMatch.split('\n').length

    if (language === 'typescript' || language === 'ts' || language === 'tsx') {
      examples.push({
        file: filePath,
        line: currentLine,
        language,
        code,
        errors: [],
      })
    }
  }

  return examples
}

function validateTypeScriptCode(code: string): string[] {
  const errors: string[] = []

  // Basic syntax checks
  try {
    // Check for common issues
    if (code.includes('require(') && code.includes('import')) {
      errors.push('Mixing CommonJS (require) and ESM (import)')
    }

    if (code.includes('module.exports')) {
      errors.push('Using CommonJS (module.exports) instead of ESM (export)')
    }

    // Check for double quotes in strings (should use single quotes per project rules)
    const _stringRegex = /(["'])(?:(?=(\\?))\2.)*?\1/g
    const doubleQuotes = code.match(/"[^"]*"/g)
    if (doubleQuotes && doubleQuotes.length > 0) {
      // Allow double quotes in JSX attributes
      const jsxAttributeQuotes = code.match(/<[^>]+="[^"]*"/g)
      const nonJsxQuotes = doubleQuotes.filter(
        (q) => !jsxAttributeQuotes?.some((jq) => jq.includes(q)),
      )
      if (nonJsxQuotes.length > 0) {
        errors.push(`Using double quotes for strings (should use single quotes per project rules)`)
      }
    }

    // Check for semicolons (should be omitted per project rules)
    const linesWithSemicolons = code.split('\n').filter((line) => {
      const trimmed = line.trim()
      return (
        trimmed.endsWith(';') &&
        !trimmed.startsWith('//') &&
        !trimmed.includes('for(') &&
        !trimmed.includes('while(')
      )
    })
    if (linesWithSemicolons.length > 0) {
      errors.push(`Unnecessary semicolons found (should be omitted per project rules)`)
    }
  } catch (error) {
    errors.push(`Validation error: ${error}`)
  }

  return errors
}

async function verifyCodeExamples(): Promise<VerificationResult> {
  const markdownFiles = await fg('**/*.md', {
    ignore: ['node_modules/**', '.next/**', 'dist/**', 'docs/archive/**', '**/coverage/**'],
    cwd: process.cwd(),
  })

  const allExamples: CodeExample[] = []

  for (const file of markdownFiles) {
    const filePath = path.resolve(process.cwd(), file)
    const content = await fs.readFile(filePath, 'utf-8')
    const examples = extractCodeExamples(content, filePath)
    allExamples.push(...examples)
  }

  // Validate each example
  for (const example of allExamples) {
    example.errors = validateTypeScriptCode(example.code)
  }

  const withErrors = allExamples.filter((ex) => ex.errors.length > 0)

  return {
    examples: allExamples,
    withErrors,
    summary: {
      total: allExamples.length,
      typescript: allExamples.filter((ex) => ex.language === 'typescript' || ex.language === 'ts')
        .length,
      withErrors: withErrors.length,
    },
  }
}

async function generateReport(result: VerificationResult): Promise<string> {
  const lines: string[] = []
  lines.push('# Documentation Code Example Verification Report')
  lines.push('')
  lines.push(`**Generated**: ${new Date().toISOString()}`)
  lines.push('')
  lines.push('## Summary')
  lines.push('')
  lines.push(`- **Total Examples**: ${result.summary.total}`)
  lines.push(`- **TypeScript Examples**: ${result.summary.typescript}`)
  lines.push(`- **With Errors**: ${result.summary.withErrors}`)
  lines.push('')

  if (result.withErrors.length > 0) {
    lines.push('## Examples with Errors')
    lines.push('')
    for (const example of result.withErrors) {
      lines.push(`### ${path.relative(process.cwd(), example.file)}:${example.line}`)
      lines.push('')
      for (const error of example.errors) {
        lines.push(`- ${error}`)
      }
      lines.push('')
      lines.push('```typescript')
      lines.push(example.code.split('\n').slice(0, 10).join('\n'))
      if (example.code.split('\n').length > 10) {
        lines.push('// ... (truncated)')
      }
      lines.push('```')
      lines.push('')
    }
  }

  if (result.withErrors.length === 0) {
    lines.push('✅ **All code examples verified successfully!**')
    lines.push('')
  }

  return lines.join('\n')
}

async function runVerification() {
  try {
    await getProjectRoot(import.meta.url)
    logger.header('Documentation Code Example Verification')
    logger.info('Verifying code examples...')
    const result = await verifyCodeExamples()

    logger.info(`\n📊 Results:`)
    logger.info(`  Total examples: ${result.summary.total}`)
    logger.info(`  TypeScript examples: ${result.summary.typescript}`)
    logger.info(`  With errors: ${result.summary.withErrors}`)

    const report = await generateReport(result)
    const reportPath = path.join(process.cwd(), 'docs', 'CODE-EXAMPLE-VERIFICATION-REPORT.md')
    await fs.writeFile(reportPath, report, 'utf-8')
    logger.success(`\n📄 Report written to: ${reportPath}`)

    if (result.withErrors.length > 0) {
      logger.error('\n❌ Code example errors found. See report for details.')
      process.exit(1)
    } else {
      logger.success('\n✅ All code examples verified successfully!')
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
