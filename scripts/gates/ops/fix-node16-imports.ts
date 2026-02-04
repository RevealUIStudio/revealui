#!/usr/bin/env tsx
/**
 * Fix Node16 module resolution by adding .js extensions to relative imports
 *
 * @dependencies
 * - scripts/lib/errors.ts - ErrorCode enum for exit codes
 * - scripts/utils/base.ts - Base utilities (createLogger)
 * - node:fs - File system operations (readdirSync, readFileSync, statSync, writeFileSync)
 * - node:path - Path manipulation utilities (extname, join)
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { ErrorCode } from '../../lib/errors.js'
import { createLogger } from '../../utils/base.ts'

const logger = createLogger()
const srcDir = process.argv[2] || 'packages/core/src'

// Recursively find all TypeScript files
function findTsFiles(dir: string, files: string[] = []): string[] {
  const entries = readdirSync(dir)
  for (const entry of entries) {
    const fullPath = join(dir, entry)
    const stat = statSync(fullPath)
    if (stat.isDirectory()) {
      findTsFiles(fullPath, files)
    } else if (extname(entry) === '.ts' || extname(entry) === '.tsx') {
      files.push(fullPath)
    }
  }
  return files
}

async function main() {
  try {
    logger.header('Fix Node16 Module Resolution')
    logger.info(`Scanning directory: ${srcDir}`)

    const files = findTsFiles(srcDir)
    logger.info(`Found ${files.length} TypeScript files to check`)

    let totalFixed = 0

    for (const file of files) {
      const content = readFileSync(file, 'utf8')
      let changed = false
      const lines = content.split('\n')

      const newLines = lines.map((line) => {
        // Match relative imports: from './something' or from '../something'
        // But exclude already fixed ones (.js, .ts, .tsx, .json) and node_modules
        const relativeImportRegex = /(from\s+['"])(\.\.?\/[^'"]+)(['"])/g

        let newLine = line

        newLine = newLine.replace(relativeImportRegex, (match, prefix, path, suffix) => {
          // Skip if already has extension
          if (
            path.endsWith('.js') ||
            path.endsWith('.ts') ||
            path.endsWith('.tsx') ||
            path.endsWith('.json') ||
            path.includes('node_modules')
          ) {
            return match
          }

          // Add .js extension
          changed = true
          return `${prefix}${path}.js${suffix}`
        })

        return newLine
      })

      if (changed) {
        writeFileSync(file, newLines.join('\n'), 'utf8')
        totalFixed++
        logger.info(`Fixed: ${file.replace(`${process.cwd()}/`, '')}`)
      }
    }

    logger.success(`Fixed ${totalFixed} files`)
  } catch (error) {
    logger.error(`Script failed: ${error instanceof Error ? error.message : String(error)}`)
    if (error instanceof Error && error.stack) {
      logger.error(`Stack trace: ${error.stack}`)
    }
    process.exit(ErrorCode.EXECUTION_ERROR)
  }
}

main()
