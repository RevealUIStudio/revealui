/**
 * Environment Validation Utilities
 *
 * Validates environment variables and provides helpful error messages.
 */

import { access, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createLogger, type Logger } from '../logger.js'
import { getProjectRoot } from '../paths.js'
import { ErrorCode } from '../../lib/errors.js'

export interface EnvVariable {
  name: string
  required: boolean
  description: string
  validator?: (value: string) => boolean
  sensitive?: boolean
  defaultValue?: string
}

export interface EnvValidationResult {
  valid: boolean
  missing: string[]
  invalid: string[]
  warnings: string[]
}

/**
 * Core required environment variables for RevealUI
 */
export const REQUIRED_ENV_VARS: EnvVariable[] = [
  {
    name: 'REVEALUI_SECRET',
    required: true,
    description: 'Secret key for JWT tokens (32+ characters)',
    validator: (v) => v.length >= 32,
    sensitive: true,
  },
  {
    name: 'POSTGRES_URL',
    required: true,
    description: 'PostgreSQL connection string',
    validator: (v) => v.startsWith('postgresql://') || v.startsWith('postgres://'),
    sensitive: true,
  },
]

/**
 * Optional environment variables
 */
export const OPTIONAL_ENV_VARS: EnvVariable[] = [
  {
    name: 'REVEALUI_PUBLIC_SERVER_URL',
    required: false,
    description: 'Public server URL',
    defaultValue: 'http://localhost:4000',
  },
  {
    name: 'NEXT_PUBLIC_SERVER_URL',
    required: false,
    description: 'Next.js public server URL',
    defaultValue: 'http://localhost:4000',
  },
  {
    name: 'BLOB_READ_WRITE_TOKEN',
    required: false,
    description: 'Vercel Blob Storage token',
    sensitive: true,
  },
  {
    name: 'STRIPE_SECRET_KEY',
    required: false,
    description: 'Stripe secret key',
    validator: (v) => v.startsWith('sk_'),
    sensitive: true,
  },
  {
    name: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
    required: false,
    description: 'Stripe publishable key',
    validator: (v) => v.startsWith('pk_'),
  },
  {
    name: 'DATABASE_URL',
    required: false,
    description: 'Alternative database connection string',
    validator: (v) => v.startsWith('postgresql://') || v.startsWith('postgres://'),
    sensitive: true,
  },
]

/**
 * Validates environment variables against the specification.
 *
 * @example
 * ```typescript
 * const result = await validateEnv()
 * if (!result.valid) {
 *   console.error('Missing:', result.missing)
 *   process.exit(ErrorCode.EXECUTION_ERROR)
 * }
 * ```
 */
export function validateEnv(
  variables: EnvVariable[] = [...REQUIRED_ENV_VARS, ...OPTIONAL_ENV_VARS],
  env: Record<string, string | undefined> = process.env,
): EnvValidationResult {
  const missing: string[] = []
  const invalid: string[] = []
  const warnings: string[] = []

  for (const variable of variables) {
    const value = env[variable.name]

    if (!value) {
      if (variable.required) {
        missing.push(variable.name)
      } else if (!variable.defaultValue) {
        warnings.push(`${variable.name} is not set (optional)`)
      }
      continue
    }

    if (variable.validator && !variable.validator(value)) {
      invalid.push(variable.name)
    }
  }

  // Check for DATABASE_URL fallback
  if (missing.includes('POSTGRES_URL') && env.DATABASE_URL) {
    const idx = missing.indexOf('POSTGRES_URL')
    missing.splice(idx, 1)
    warnings.push('Using DATABASE_URL as fallback for POSTGRES_URL')
  }

  return {
    valid: missing.length === 0 && invalid.length === 0,
    missing,
    invalid,
    warnings,
  }
}

/**
 * Validates environment and logs results.
 *
 * @param options.exitOnError - Whether to exit the process on validation failure (default: false)
 * @returns Whether validation passed
 */
export async function validateEnvWithLogging(options: {
  logger?: Logger
  exitOnError?: boolean
  importMetaUrl?: string
} = {}): Promise<boolean> {
  const logger = options.logger || createLogger()
  const result = validateEnv()

  if (result.valid) {
    logger.success('Environment validation passed')
    for (const warning of result.warnings) {
      logger.warn(warning)
    }
    return true
  }

  logger.error('Environment validation failed')

  if (result.missing.length > 0) {
    logger.error(`Missing required variables: ${result.missing.join(', ')}`)
    for (const name of result.missing) {
      const variable = [...REQUIRED_ENV_VARS, ...OPTIONAL_ENV_VARS].find((v) => v.name === name)
      if (variable) {
        logger.info(`  ${name}: ${variable.description}`)
      }
    }
  }

  if (result.invalid.length > 0) {
    logger.error(`Invalid variables: ${result.invalid.join(', ')}`)
    for (const name of result.invalid) {
      const variable = [...REQUIRED_ENV_VARS, ...OPTIONAL_ENV_VARS].find((v) => v.name === name)
      if (variable) {
        logger.info(`  ${name}: ${variable.description}`)
      }
    }
  }

  for (const warning of result.warnings) {
    logger.warn(warning)
  }

  if (options.exitOnError) {
    process.exit(ErrorCode.EXECUTION_ERROR)
  }

  return false
}

/**
 * Checks if a .env file exists at the project root.
 */
export async function envFileExists(importMetaUrl: string): Promise<boolean> {
  try {
    const root = await getProjectRoot(importMetaUrl)
    await access(join(root, '.env'))
    return true
  } catch {
    return false
  }
}

/**
 * Checks if .env.development.local exists.
 */
export async function devEnvFileExists(importMetaUrl: string): Promise<boolean> {
  try {
    const root = await getProjectRoot(importMetaUrl)
    await access(join(root, '.env.development.local'))
    return true
  } catch {
    return false
  }
}

/**
 * Reads and parses an env file.
 */
export async function parseEnvFile(filePath: string): Promise<Record<string, string>> {
  const content = await readFile(filePath, 'utf-8')
  const env: Record<string, string> = {}

  for (const line of content.split('\n')) {
    const trimmed = line.trim()

    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }

    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) {
      continue
    }

    const key = trimmed.substring(0, eqIndex).trim()
    let value = trimmed.substring(eqIndex + 1).trim()

    // Remove quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }

    env[key] = value
  }

  return env
}

/**
 * Detects running environment.
 */
export function detectEnvironment(): 'development' | 'test' | 'production' | 'ci' {
  if (process.env.CI) {
    return 'ci'
  }
  if (process.env.NODE_ENV === 'test') {
    return 'test'
  }
  if (process.env.NODE_ENV === 'production') {
    return 'production'
  }
  return 'development'
}

/**
 * Checks if running in CI environment.
 */
export function isCI(): boolean {
  return Boolean(
    process.env.CI ||
      process.env.GITHUB_ACTIONS ||
      process.env.GITLAB_CI ||
      process.env.CIRCLECI ||
      process.env.TRAVIS ||
      process.env.JENKINS_URL,
  )
}
