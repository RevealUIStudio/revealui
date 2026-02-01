/**
 * Environment setup orchestration
 */

import { copyFile, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { generateSecret, updateEnvValue, parseEnvContent } from './generators.js'
import { validateEnv, REQUIRED_ENV_VARS, type EnvVariable } from '../validators/env.js'
import { createLogger } from '../utils/logger.js'
import inquirer from 'inquirer'

export interface SetupEnvironmentOptions {
  projectRoot: string
  templatePath?: string
  outputPath?: string
  force?: boolean
  generateOnly?: boolean
  interactive?: boolean
  customVariables?: EnvVariable[]
  logger?: ReturnType<typeof createLogger>
}

export interface SetupEnvironmentResult {
  success: boolean
  envPath: string
  missing: string[]
  invalid: string[]
}

/**
 * Sets up environment variables for a project.
 *
 * @param options - Setup configuration options
 * @returns Setup result with validation info
 *
 * @example
 * ```typescript
 * const result = await setupEnvironment({
 *   projectRoot: '/path/to/project',
 *   interactive: true
 * })
 * ```
 */
export async function setupEnvironment(
  options: SetupEnvironmentOptions,
): Promise<SetupEnvironmentResult> {
  const {
    projectRoot,
    templatePath = join(projectRoot, '.env.template'),
    outputPath = join(projectRoot, '.env.development.local'),
    force = false,
    generateOnly = false,
    interactive = true,
    customVariables,
    logger = createLogger({ prefix: 'Setup' }),
  } = options

  const requiredVars = customVariables || REQUIRED_ENV_VARS

  logger.header('Environment Setup')

  // Check if template exists
  try {
    await readFile(templatePath, 'utf-8')
  } catch {
    logger.error(`.env.template not found at: ${templatePath}`)
    logger.info('Please ensure .env.template exists in the project root.')
    return {
      success: false,
      envPath: outputPath,
      missing: requiredVars.map((v) => v.name),
      invalid: [],
    }
  }

  // Check if output file already exists
  let outputExists = false
  try {
    await readFile(outputPath, 'utf-8')
    outputExists = true
  } catch {
    // File doesn't exist, which is fine
  }

  if (outputExists && !force) {
    if (interactive) {
      logger.warn('.env.development.local already exists')
      const { overwrite } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'overwrite',
          message: 'Overwrite existing file?',
          default: false,
        },
      ])
      if (!overwrite) {
        logger.info('Setup cancelled. Use force: true to overwrite.')
        return {
          success: false,
          envPath: outputPath,
          missing: [],
          invalid: [],
        }
      }
    } else {
      // Non-interactive mode without force, don't overwrite
      logger.info('Output file exists. Set force: true to overwrite.')
      return {
        success: false,
        envPath: outputPath,
        missing: [],
        invalid: [],
      }
    }
  }

  // Copy template
  logger.info('Copying .env.template to .env.development.local...')
  await copyFile(templatePath, outputPath)
  logger.success('Template copied')

  if (generateOnly) {
    // Just generate secrets and update the file
    await generateSecrets(outputPath, logger)
    logger.success('Secrets generated')
    return {
      success: true,
      envPath: outputPath,
      missing: [],
      invalid: [],
    }
  }

  // Parse the template to get current values
  let envContent = await readFile(outputPath, 'utf-8')
  const currentEnv = parseEnvContent(envContent)

  // Check for missing required values
  const validation = validateEnv(requiredVars, currentEnv)

  if (interactive && (validation.missing.length > 0 || validation.invalid.length > 0)) {
    logger.info('Some required values need to be configured:')
    logger.divider()

    for (const varName of validation.missing) {
      const variable = requiredVars.find((v) => v.name === varName)
      if (!variable) continue

      logger.info(`${varName}: ${variable.description}`)

      if (varName === 'REVEALUI_SECRET') {
        // Auto-generate secret
        const secret = generateSecret(32)
        envContent = updateEnvValue(envContent, varName, secret)
        logger.success(`Generated ${varName}`)
      } else {
        // Prompt for value
        const { value } = await inquirer.prompt([
          {
            type: 'input',
            name: 'value',
            message: `Enter value for ${varName}:`,
            validate: (input: string) => {
              if (!input.trim()) {
                return 'Value cannot be empty (press Ctrl+C to skip)'
              }
              if (variable.validator && !variable.validator(input.trim())) {
                return `Invalid format for ${varName}`
              }
              return true
            },
          },
        ])

        if (value.trim()) {
          envContent = updateEnvValue(envContent, varName, value.trim())
          logger.success(`Set ${varName}`)
        }
      }
    }

    // Save updated content
    await writeFile(outputPath, envContent)
    logger.success('Environment file updated')
  } else if (!interactive && validation.missing.length > 0) {
    // Non-interactive mode with missing values - just generate secrets
    for (const varName of validation.missing) {
      if (varName === 'REVEALUI_SECRET') {
        const secret = generateSecret(32)
        envContent = updateEnvValue(envContent, varName, secret)
        logger.success(`Generated ${varName}`)
      }
    }
    await writeFile(outputPath, envContent)
  }

  // Final validation
  const finalContent = await readFile(outputPath, 'utf-8')
  const finalEnv = parseEnvContent(finalContent)
  const finalValidation = validateEnv(requiredVars, finalEnv)

  logger.divider()

  if (finalValidation.valid) {
    logger.success('Environment setup complete!')
    return {
      success: true,
      envPath: outputPath,
      missing: [],
      invalid: [],
    }
  }

  logger.warn('Setup incomplete - some variables still need to be configured:')
  for (const varName of finalValidation.missing) {
    logger.warn(`  - ${varName}`)
  }
  logger.info('Edit .env.development.local to add missing values.')

  return {
    success: false,
    envPath: outputPath,
    missing: finalValidation.missing,
    invalid: finalValidation.invalid,
  }
}

/**
 * Generates secrets and updates the env file.
 */
async function generateSecrets(
  envPath: string,
  logger: ReturnType<typeof createLogger>,
): Promise<void> {
  let content = await readFile(envPath, 'utf-8')

  // Generate REVEALUI_SECRET
  const secret = generateSecret(32)
  content = updateEnvValue(content, 'REVEALUI_SECRET', secret)

  await writeFile(envPath, content)
  logger.success('Generated REVEALUI_SECRET')
}
