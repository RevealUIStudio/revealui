#!/usr/bin/env tsx
/**
 * Script to copy generated types to the centralized generated package.
 * This ensures generated types are accessible across the monorepo.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createLogger } from '../shared/utils.js'

const logger = createLogger()

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '../..')

// Paths
const cmsTypesSource = join(rootDir, 'apps/cms/src/types/revealui.ts')
const cmsTypesDest = join(rootDir, 'packages/generated/src/types/cms.ts')
const supabaseTypesSource = join(rootDir, 'packages/services/src/core/supabase/types.ts')
const supabaseTypesDest = join(rootDir, 'packages/generated/src/types/supabase.ts')

function copyFile(source: string, dest: string, description: string) {
  try {
    // Ensure destination directory exists
    mkdirSync(dirname(dest), { recursive: true })

    // Read source file
    const content = readFileSync(source, 'utf-8')

    // Add header comment if not present
    const header = `/* tslint:disable */
/* eslint-disable */
/**
 * This file was automatically generated and copied from ${source.replace(rootDir, '.')}
 * DO NOT MODIFY IT BY HAND. Instead, regenerate the source file and re-run this script.
 *
 * Last updated: ${new Date().toISOString()}
 */

`

    // Write to destination
    writeFileSync(dest, header + content, 'utf-8')
    logger.success(`Copied ${description} to ${dest.replace(rootDir, '.')}`)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      logger.warning(`Source file not found: ${source.replace(rootDir, '.')}`)
      logger.warning(`Skipping ${description} copy`)
    } else {
      logger.error(`Error copying ${description}: ${error instanceof Error ? error.message : String(error)}`)
      if (error instanceof Error && error.stack) {
        logger.error(`Stack trace: ${error.stack}`)
      }
      process.exit(1)
    }
  }
}

// Copy CMS types
if (process.argv.includes('--cms') || process.argv.length === 2) {
  copyFile(cmsTypesSource, cmsTypesDest, 'CMS types')
}

// Copy Supabase types
if (process.argv.includes('--supabase') || process.argv.length === 2) {
  copyFile(supabaseTypesSource, supabaseTypesDest, 'Supabase types')
}

logger.success('Type copying complete!')
