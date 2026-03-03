#!/usr/bin/env node

/**
 * @revealui/cli - Main orchestrator
 */

import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createLogger } from '@revealui/setup/utils'
import { type CliOptions, createCli } from './cli.js'
import { validateNodeVersion } from './validators/node-version.js'

const logger = createLogger({ prefix: '@revealui/cli' })

import { createProject } from './commands/create.js'
import { promptDatabaseConfig } from './prompts/database.js'
import { promptDevEnvConfig } from './prompts/devenv.js'
import { promptPaymentConfig } from './prompts/payments.js'
import { promptProjectConfig } from './prompts/project.js'
import { promptStorageConfig } from './prompts/storage.js'

/** Templates that require a Pro or Enterprise license. */
const PRO_TEMPLATES = new Set<string>(['e-commerce', 'portfolio'])

/**
 * Lightweight Pro license check for the CLI.
 *
 * Reads REVEALUI_LICENSE_KEY env var or ~/.revealui/license.json.
 * Decodes the JWT payload without signature verification (server validates on use).
 * Returns true if the license tier is 'pro' or 'enterprise'.
 */
function checkProLicense(): boolean {
  let key: string | undefined = process.env.REVEALUI_LICENSE_KEY

  if (!key) {
    try {
      const licenseFile = join(homedir(), '.revealui', 'license.json')
      const parsed = JSON.parse(readFileSync(licenseFile, 'utf8')) as { key?: string }
      key = parsed.key
    } catch {
      // No license file — free tier
    }
  }

  if (!key) return false

  try {
    const parts = key.split('.')
    if (parts.length < 2) return false
    const payload = JSON.parse(Buffer.from(parts[1] ?? '', 'base64').toString('utf8')) as {
      tier?: string
    }
    const tier = payload.tier ?? 'free'
    return tier === 'pro' || tier === 'enterprise'
  } catch {
    return false
  }
}

export async function run(projectName: string | undefined, _options: CliOptions): Promise<void> {
  try {
    // Step 1: Validate Node version
    logger.info('[1/8] Validating Node.js version...')
    if (!validateNodeVersion()) {
      process.exit(1)
    }
    logger.success(`Node.js version: ${process.version}`)

    // Step 2: Collect project configuration
    logger.info('[2/8] Configure your project')
    const projectConfig = await promptProjectConfig(projectName)
    logger.success(`Project: ${projectConfig.projectName}`)
    logger.success(`Template: ${projectConfig.template}`)

    // Step 2b: License check for Pro templates
    if (PRO_TEMPLATES.has(projectConfig.template)) {
      if (!checkProLicense()) {
        logger.error(`The "${projectConfig.template}" template requires a RevealUI Pro license.`)
        logger.info('Get Pro at https://revealui.com/pricing')
        logger.info('Set your license key: export REVEALUI_LICENSE_KEY=<your-key>')
        process.exit(2)
      }
      logger.success('Pro license verified')
    }

    // Step 3: Database configuration
    logger.info('[3/8] Configure database')
    const databaseConfig = await promptDatabaseConfig()
    if (databaseConfig.provider !== 'skip') {
      logger.success(`Database: ${databaseConfig.provider}`)
    } else {
      logger.info('Database configuration skipped')
    }

    // Step 4: Storage configuration
    logger.info('[4/8] Configure storage')
    const storageConfig = await promptStorageConfig()
    if (storageConfig.provider !== 'skip') {
      logger.success(`Storage: ${storageConfig.provider}`)
    } else {
      logger.info('Storage configuration skipped')
    }

    // Step 5: Payment configuration
    logger.info('[5/8] Configure payments')
    const paymentConfig = await promptPaymentConfig()
    if (paymentConfig.enabled) {
      logger.success('Stripe configured')
    } else {
      logger.info('Payments disabled')
    }

    // Step 6: Development environment
    logger.info('[6/8] Configure development environment')
    const devEnvConfig = await promptDevEnvConfig()
    logger.success(
      `Dev Container: ${devEnvConfig.createDevContainer ? 'Yes' : 'No'}, Devbox: ${devEnvConfig.createDevbox ? 'Yes' : 'No'}`,
    )

    // Step 7: Create project
    logger.info('[7/8] Creating project...')

    await createProject({
      project: projectConfig,
      database: databaseConfig,
      storage: storageConfig,
      payment: paymentConfig,
      devenv: devEnvConfig,
      skipGit: _options.skipGit,
      skipInstall: _options.skipInstall,
    })

    logger.success('Project created successfully')

    // Step 8: Next steps
    logger.info('[8/8] Next steps')
    logger.divider()
    logger.info(`cd ${projectConfig.projectName}`)
    logger.info('pnpm install')
    logger.info('pnpm dev')
    logger.divider()

    logger.success(`🎉 Project ${projectConfig.projectName} created successfully!`)
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`Failed to create project: ${error.message}`)
    } else {
      logger.error('An unexpected error occurred')
    }
    process.exit(1)
  }
}

// If running as main module
if (import.meta.url === `file://${process.argv[1]}`) {
  const cli = createCli()
  cli.parse(process.argv)
}
