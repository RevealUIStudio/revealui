#!/usr/bin/env tsx

/**
 * Validate Automation Scripts
 * Cross-platform replacement for validate-automation.sh
 * Checks that all automation scripts are properly configured
 */

import {join} from 'node:path'
import {
import { ErrorCode } from '../lib/errors.js'
  commandExists,
  createLogger,
  execCommand,
  fileExists,
  getProjectRoot,
} from '../../../lib/index.js'

const logger = createLogger()

let errors = 0

function recordError(message: string) {
  logger.error(message)
  errors++
}

function recordSuccess(message: string) {
  logger.success(message)
}

function recordWarning(message: string) {
  logger.warning(message)
}

async function checkDockerCompose(projectRoot: string) {
  logger.header('1. Checking infrastructure/docker-compose/services/test.yml')
  const composeFile = join(projectRoot, 'infrastructure/docker-compose/services/test.yml')

  if (!(await fileExists(composeFile))) {
    recordError('infrastructure/docker-compose/services/test.yml not found')
    return
  }

  recordSuccess('infrastructure/docker-compose/services/test.yml exists')

  // Validate YAML syntax
  const hasDockerCompose = await commandExists('docker-compose')
  const hasDockerComposeV2 = (await commandExists('docker'))
    ? (await execCommand('docker', ['compose', 'version'], { silent: true })).success
    : false

  if (hasDockerCompose || hasDockerComposeV2) {
    const composeCmd = hasDockerComposeV2 ? 'docker compose' : 'docker-compose'
    const [cmd, ...args] = composeCmd.split(' ')
    const result = await execCommand(cmd, [...args, '-f', 'infrastructure/docker-compose/services/test.yml', 'config'], {
      cwd: projectRoot,
      silent: true,
    })

    if (result.success) {
      recordSuccess('infrastructure/docker-compose/services/test.yml syntax is valid')
    } else {
      recordError('infrastructure/docker-compose/services/test.yml has syntax errors')
    }
  }
}

async function checkSetupScript(projectRoot: string) {
  logger.header('2. Checking test-database script')
  const setupScript = join(projectRoot, 'scripts/dev-tools/test-database.ts')

  if (!(await fileExists(setupScript))) {
    // Check legacy location
    const legacyScript = join(projectRoot, 'scripts/legacy/setup-test-db.sh')
    if (await fileExists(legacyScript)) {
      recordWarning('setup-test-db.sh found in legacy/, consider using TypeScript version')
    } else {
      recordError('setup-test-db script not found')
    }
    return
  }

  recordSuccess('setup-test-db.ts exists')
}

async function checkValidationScript(projectRoot: string) {
  logger.header('3. Checking run-automated-validation script')
  const validationScript = join(projectRoot, 'scripts/validation/run-automated-validation.ts')

  if (!(await fileExists(validationScript))) {
    // Check legacy location
    const legacyScript = join(projectRoot, 'scripts/legacy/run-automated-validation.sh')
    if (await fileExists(legacyScript)) {
      recordWarning(
        'run-automated-validation.sh found in legacy/, consider using TypeScript version',
      )
    } else {
      recordError('run-automated-validation script not found')
    }
    return
  }

  recordSuccess('run-automated-validation.ts exists')
}

async function checkIntegrationTest(projectRoot: string) {
  logger.header('4. Checking integration test file')
  const testFile = join(
    projectRoot,
    'packages/memory/__tests__/integration/automated-validation.test.ts',
  )

  if (!(await fileExists(testFile))) {
    recordError('automated-validation.test.ts not found')
    return
  }

  recordSuccess('automated-validation.test.ts exists')
}

async function checkCIConfig(projectRoot: string) {
  logger.header('5. Checking CI/CD configuration')
  const ciFile = join(projectRoot, '.github/workflows/ci.yml')

  if (await fileExists(ciFile)) {
    const { readFile } = await import('node:fs/promises')
    const content = await readFile(ciFile, 'utf-8')
    if (content.includes('validate-crdt:')) {
      recordSuccess('validate-crdt job found in CI/CD')
    } else {
      recordWarning('validate-crdt job not found in CI/CD (may be in unsaved file)')
    }
  } else {
    recordWarning('CI/CD config file not found (may be in different location)')
  }
}

async function checkPackageScripts(projectRoot: string) {
  logger.header('6. Checking npm scripts')
  const packageJson = join(projectRoot, 'package.json')

  if (await fileExists(packageJson)) {
    const { readFile } = await import('node:fs/promises')
    const content = await readFile(packageJson, 'utf-8')
    const packageData = JSON.parse(content)

    if (packageData.scripts?.['test:validation']) {
      recordSuccess('test:validation script found')
    } else {
      recordError('test:validation script not found')
    }

    if (packageData.scripts?.['test:integration']) {
      recordSuccess('test:integration script found')
    } else {
      recordError('test:integration script not found')
    }
  } else {
    recordError('package.json not found')
  }
}

async function main() {
  logger.header('Validating Automation Scripts')

  const projectRoot = await getProjectRoot(import.meta.url)

  await checkDockerCompose(projectRoot)
  await checkSetupScript(projectRoot)
  await checkValidationScript(projectRoot)
  await checkIntegrationTest(projectRoot)
  await checkCIConfig(projectRoot)
  await checkPackageScripts(projectRoot)

  // Summary
  logger.header('Validation Summary')
  if (errors === 0) {
    logger.success('All automation scripts validated!')
    process.exit(0)
  } else {
    logger.error(`Found ${errors} error(s)`)
    process.exit(ErrorCode.EXECUTION_ERROR)
  }
}

/**
 * Main function wrapper with error handling
 */
async function mainWrapper() {
  try {
    await main()
  } catch (error) {
    logger.error(`Validation failed: ${error instanceof Error ? error.message : String(error)}`)
    if (error instanceof Error && error.stack) {
      logger.error(`Stack trace: ${error.stack}`)
    }
    process.exit(ErrorCode.EXECUTION_ERROR)
  }
}

mainWrapper()
