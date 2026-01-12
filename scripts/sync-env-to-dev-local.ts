#!/usr/bin/env tsx
/**
 * Sync Environment Variables Script
 *
 * Syncs required environment variables from root .env to .env.development.local
 * This ensures both the config package and Next.js can access the values.
 *
 * Usage:
 *   pnpm dlx tsx scripts/sync-env-to-dev-local.ts
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createLogger, getProjectRoot } from './shared/utils.js'

const logger = createLogger()

const REQUIRED_VARS = [
  'REVEALUI_SECRET',
  'REVEALUI_PUBLIC_SERVER_URL',
  'NEXT_PUBLIC_SERVER_URL',
  'BLOB_READ_WRITE_TOKEN',
  'STRIPE_WEBHOOK_SECRET',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'STRIPE_SECRET_KEY',
  'POSTGRES_URL',
] as const

async function syncEnvVars() {
  try {
    const projectRoot = await getProjectRoot(import.meta.url)
    const rootEnv = resolve(projectRoot, '.env')
    const devLocalEnv = resolve(projectRoot, '.env.development.local')

    logger.header('Sync Environment Variables')

    // Check if root .env exists
    if (!existsSync(rootEnv)) {
      logger.error(`Root .env file not found: ${rootEnv}`)
      process.exit(1)
    }

    // Read root .env
    const rootEnvContent = readFileSync(rootEnv, 'utf-8')
    const rootEnvVars = new Map<string, string>()

    // Parse root .env
    for (const line of rootEnvContent.split('\n')) {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const match = trimmed.match(/^([^=]+)=(.*)$/)
        if (match) {
          const key = match[1].trim()
          const value = match[2].trim()
          rootEnvVars.set(key, value)
        }
      }
    }

    // Check which required vars exist in root .env
    const missingVars: string[] = []
    const foundVars: string[] = []

    for (const varName of REQUIRED_VARS) {
      if (rootEnvVars.has(varName)) {
        foundVars.push(varName)
      } else {
        missingVars.push(varName)
      }
    }

    logger.info(`Found ${foundVars.length}/${REQUIRED_VARS.length} required variables in root .env`)

    if (missingVars.length > 0) {
      logger.warning(`Missing variables in root .env: ${missingVars.join(', ')}`)
    }

    // Read or create .env.development.local
    let devLocalContent = ''
    if (existsSync(devLocalEnv)) {
      devLocalContent = readFileSync(devLocalEnv, 'utf-8')
    }

    // Parse .env.development.local
    const lines = devLocalContent.split('\n')
    const updatedLines: string[] = []
    const updatedVars = new Set<string>()

    // Process existing lines
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) {
        updatedLines.push(line)
        continue
      }

      const match = trimmed.match(/^([^=]+)=(.*)$/)
      if (match) {
        const key = match[1].trim()
        const _value = match[2].trim()

        // Check if this is a required variable
        if (REQUIRED_VARS.includes(key as (typeof REQUIRED_VARS)[number])) {
          // Update with value from root .env if available
          if (rootEnvVars.has(key)) {
            updatedLines.push(`${key}=${rootEnvVars.get(key)}`)
            updatedVars.add(key)
            logger.info(`Updated ${key}`)
          } else {
            // Keep existing value if root .env doesn't have it
            updatedLines.push(line)
          }
        } else {
          // Keep non-required vars as-is
          updatedLines.push(line)
        }
      } else {
        updatedLines.push(line)
      }
    }

    // Add missing required vars from root .env
    for (const varName of REQUIRED_VARS) {
      if (!updatedVars.has(varName) && rootEnvVars.has(varName)) {
        updatedLines.push(`${varName}=${rootEnvVars.get(varName)}`)
        logger.info(`Added ${varName}`)
      }
    }

    // Write updated .env.development.local
    writeFileSync(devLocalEnv, updatedLines.join('\n'), 'utf-8')

    logger.success(`✅ Synced ${updatedVars.size} environment variables to .env.development.local`)
    logger.info(`\n📝 File updated: ${devLocalEnv}`)
    logger.info('💡 Restart your server to apply changes\n')
  } catch (error) {
    logger.error(`Sync failed: ${error instanceof Error ? error.message : String(error)}`)
    if (error instanceof Error && error.stack) {
      logger.error(`Stack trace: ${error.stack}`)
    }
    process.exit(1)
  }
}

syncEnvVars()
