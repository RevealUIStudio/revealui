#!/usr/bin/env tsx

/**
 * Environment Setup Script
 *
 * Sets up environment variables for the project by:
 * 1. Copying .env.template to .env.development.local (if not exists)
 * 2. Prompting for missing required values
 * 3. Generating secure secrets
 *
 * Usage:
 *   pnpm setup:env
 *   pnpm setup:env --force     # Overwrite existing .env.development.local
 *   pnpm setup:env --generate  # Only generate secrets without prompts
 */

import { randomBytes } from 'node:crypto'
import { copyFile, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  confirm,
  createLogger,
  devEnvFileExists,
  envFileExists,
  fileExists,
  getProjectRoot,
  parseEnvFile,
  prompt,
  REQUIRED_ENV_VARS,
  validateEnv,
} from '../../lib/index.js'

const logger = createLogger({ prefix: 'Setup' })

interface SetupOptions {
  force: boolean
  generateOnly: boolean
}

function parseArgs(): SetupOptions {
  const args = process.argv.slice(2)
  return {
    force: args.includes('--force') || args.includes('-f'),
    generateOnly: args.includes('--generate') || args.includes('-g'),
  }
}

/**
 * Generates a secure random secret.
 */
function generateSecret(length = 32): string {
  return randomBytes(length).toString('hex')
}

/**
 * Generates a secure password.
 */
function generatePassword(length = 16): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
  let password = ''
  const randomValues = randomBytes(length)
  for (let i = 0; i < length; i++) {
    password += chars[randomValues[i] % chars.length]
  }
  return password
}

/**
 * Main setup function.
 */
async function setupEnvironment() {
  const options = parseArgs()
  const projectRoot = await getProjectRoot(import.meta.url)

  logger.header('Environment Setup')

  const templatePath = join(projectRoot, '.env.template')
  const devLocalPath = join(projectRoot, '.env.development.local')
  const envPath = join(projectRoot, '.env')

  // Check if template exists
  if (!(await fileExists(templatePath))) {
    logger.error('.env.template not found!')
    logger.info('Please ensure .env.template exists in the project root.')
    process.exit(1)
  }

  // Check if .env.development.local already exists
  const devLocalExists = await devEnvFileExists(import.meta.url)

  if (devLocalExists && !options.force) {
    logger.warn('.env.development.local already exists')
    const overwrite = await confirm('Overwrite existing file?')
    if (!overwrite) {
      logger.info('Setup cancelled. Use --force to overwrite.')
      return
    }
  }

  // Copy template
  logger.info('Copying .env.template to .env.development.local...')
  await copyFile(templatePath, devLocalPath)
  logger.success('Template copied')

  if (options.generateOnly) {
    // Just generate secrets and update the file
    await generateSecrets(devLocalPath)
    logger.success('Secrets generated')
    return
  }

  // Parse the template to get current values
  let envContent = await readFile(devLocalPath, 'utf-8')
  const currentEnv = await parseEnvFile(devLocalPath)

  // Check for missing required values
  const validation = validateEnv(REQUIRED_ENV_VARS, currentEnv)

  if (validation.missing.length > 0 || validation.invalid.length > 0) {
    logger.info('Some required values need to be configured:')
    logger.divider()

    for (const varName of validation.missing) {
      const variable = REQUIRED_ENV_VARS.find((v) => v.name === varName)
      if (!variable) continue

      logger.info(`${varName}: ${variable.description}`)

      if (varName === 'REVEALUI_SECRET') {
        // Auto-generate secret
        const secret = generateSecret(32)
        envContent = updateEnvValue(envContent, varName, secret)
        logger.success(`Generated ${varName}`)
      } else if (varName === 'POSTGRES_URL') {
        // Prompt for database URL
        const value = await prompt('Enter your PostgreSQL connection string: ')
        if (value.trim()) {
          envContent = updateEnvValue(envContent, varName, value.trim())
          logger.success(`Set ${varName}`)
        } else {
          logger.warn(`Skipped ${varName} - you will need to set this manually`)
        }
      } else {
        // Prompt for other values
        const value = await prompt(`Enter value for ${varName}: `)
        if (value.trim()) {
          envContent = updateEnvValue(envContent, varName, value.trim())
          logger.success(`Set ${varName}`)
        } else {
          logger.warn(`Skipped ${varName} - you will need to set this manually`)
        }
      }
    }

    // Save updated content
    await writeFile(devLocalPath, envContent)
    logger.success('Environment file updated')
  }

  // Also create .env symlink or copy if it doesn't exist
  if (!(await envFileExists(import.meta.url))) {
    logger.info('Creating .env file...')
    await copyFile(devLocalPath, envPath)
    logger.success('.env file created')
  }

  // Final validation
  const finalEnv = await parseEnvFile(devLocalPath)
  const finalValidation = validateEnv(REQUIRED_ENV_VARS, finalEnv)

  logger.divider()

  if (finalValidation.valid) {
    logger.success('Environment setup complete!')
    logger.info('You can now start the development server with: pnpm dev')
  } else {
    logger.warn('Setup incomplete - some variables still need to be configured:')
    for (const varName of finalValidation.missing) {
      logger.warn(`  - ${varName}`)
    }
    logger.info('Edit .env.development.local to add missing values.')
  }
}

/**
 * Generates secrets and updates the env file.
 */
async function generateSecrets(envPath: string) {
  let content = await readFile(envPath, 'utf-8')

  // Generate REVEALUI_SECRET
  const secret = generateSecret(32)
  content = updateEnvValue(content, 'REVEALUI_SECRET', secret)

  await writeFile(envPath, content)
}

/**
 * Updates a value in the env file content.
 */
function updateEnvValue(content: string, key: string, value: string): string {
  const regex = new RegExp(`^${key}=.*$`, 'm')

  if (regex.test(content)) {
    // Replace existing value
    return content.replace(regex, `${key}=${value}`)
  } else {
    // Add new line at the end
    return content.trimEnd() + `\n${key}=${value}\n`
  }
}

// Run setup
setupEnvironment().catch((error) => {
  logger.error(`Setup failed: ${error.message}`)
  process.exit(1)
})
