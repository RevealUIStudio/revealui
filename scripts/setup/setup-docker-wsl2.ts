#!/usr/bin/env tsx
/**
 * Setup Docker Engine on WSL2 (without Docker Desktop)
 * Cross-platform replacement for setup-docker-wsl2.sh
 * Note: This script is WSL2/Linux-specific and requires sudo privileges
 */

import { commandExists, confirm, createLogger, execCommand } from '../shared/utils.js'

const logger = createLogger()

async function checkDockerInstalled(): Promise<boolean> {
  const isInstalled = await commandExists('docker')
  if (isInstalled) {
    logger.info('Docker is already installed:')
    const versionResult = await execCommand('docker', ['--version'], { silent: true })
    if (versionResult.success) {
      logger.info(versionResult.message)
    }

    const shouldContinue = await confirm('Continue anyway?', false)
    return shouldContinue
  }
  return true
}

async function updateSystem() {
  logger.header('Step 1: Updating system')
  logger.warning('This requires sudo privileges')

  const result = await execCommand('sudo', ['apt', 'update'], {})
  if (!result.success) {
    logger.error('Failed to update system')
    process.exit(1)
  }

  const upgradeResult = await execCommand('sudo', ['apt', 'upgrade', '-y'], {})
  if (!upgradeResult.success) {
    logger.warning('System upgrade had issues, but continuing...')
  }
}

async function installPrerequisites() {
  logger.header('Step 2: Installing prerequisites')

  const result = await execCommand(
    'sudo',
    ['apt', 'install', '-y', 'ca-certificates', 'curl', 'gnupg', 'lsb-release'],
    {},
  )

  if (!result.success) {
    logger.error('Failed to install prerequisites')
    process.exit(1)
  }
}

async function addDockerGPGKey() {
  logger.header('Step 3: Adding Docker GPG key')

  // Create keyrings directory
  await execCommand('sudo', ['mkdir', '-p', '/etc/apt/keyrings'], { silent: true })

  // Download and add GPG key
  const gpgResult = await execCommand(
    'bash',
    [
      '-c',
      'curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg',
    ],
    {},
  )

  if (!gpgResult.success) {
    logger.error('Failed to add Docker GPG key')
    process.exit(1)
  }
}

async function addDockerRepository() {
  logger.header('Step 4: Adding Docker repository')

  // Get architecture and codename
  const archResult = await execCommand('dpkg', ['--print-architecture'], { silent: true })
  const arch = archResult.message.trim()

  const codenameResult = await execCommand('lsb_release', ['-cs'], { silent: true })
  const codename = codenameResult.message.trim()

  const repoLine = `deb [arch=${arch} signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${codename} stable`

  const result = await execCommand(
    'bash',
    ['-c', `echo "${repoLine}" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null`],
    { silent: true },
  )

  if (!result.success) {
    logger.error('Failed to add Docker repository')
    process.exit(1)
  }
}

async function installDocker() {
  logger.header('Step 5: Installing Docker Engine')

  // Update apt after adding repository
  await execCommand('sudo', ['apt', 'update'], { silent: true })

  const result = await execCommand(
    'sudo',
    [
      'apt',
      'install',
      '-y',
      'docker-ce',
      'docker-ce-cli',
      'containerd.io',
      'docker-buildx-plugin',
      'docker-compose-plugin',
    ],
    {},
  )

  if (!result.success) {
    logger.error('Failed to install Docker Engine')
    process.exit(1)
  }
}

async function startDocker() {
  logger.header('Step 6: Starting Docker service')

  const result = await execCommand('sudo', ['service', 'docker', 'start'], {})

  if (!result.success) {
    logger.error('Failed to start Docker service')
    process.exit(1)
  }
}

async function addUserToDockerGroup() {
  logger.header('Step 7: Adding user to docker group')

  const username = process.env.USER || process.env.USERNAME || 'user'
  const result = await execCommand('sudo', ['usermod', '-aG', 'docker', username], {})

  if (!result.success) {
    logger.error('Failed to add user to docker group')
    process.exit(1)
  }
}

async function fixDockerConfig() {
  logger.header('Step 8: Fixing Docker credential configuration')

  const { mkdir, writeFile } = await import('node:fs/promises')
  const { homedir } = await import('node:os')
  const { join } = await import('node:path')

  const dockerDir = join(homedir(), '.docker')
  await mkdir(dockerDir, { recursive: true })

  const configPath = join(dockerDir, 'config.json')
  const config = JSON.stringify({ auths: {} }, null, 2)

  await writeFile(configPath, config, 'utf-8')
  logger.success('Docker config created')
}

async function _main() {
  // Check platform
  if (process.platform !== 'linux') {
    logger.error('This script is designed for WSL2/Linux only')
    logger.info(
      'For other platforms, please install Docker Desktop or use platform-specific installation methods',
    )
    process.exit(1)
  }

  logger.header('Setting up Docker Engine on WSL2')

  const shouldContinue = await checkDockerInstalled()
  if (!shouldContinue) {
    logger.info('Setup cancelled')
    process.exit(0)
  }

  await updateSystem()
  await installPrerequisites()
  await addDockerGPGKey()
  await addDockerRepository()
  await installDocker()
  await startDocker()
  await addUserToDockerGroup()
  await fixDockerConfig()

  logger.header('Docker Engine installed!')
  logger.warning('IMPORTANT: You need to log out and log back in (or restart WSL)')
  logger.info('   for group changes to take effect.')
  logger.info('')
  logger.info('To restart WSL, run in Windows PowerShell:')
  logger.info('  wsl --shutdown')
  logger.info('')
  logger.info('Then verify with:')
  logger.info('  docker --version')
  logger.info('  docker compose version')
  logger.info('  docker ps')
  logger.info('')
}

/**
 * Main function
 */
async function main() {
  try {
    await runSetup()
  } catch (error) {
    logger.error(`Setup failed: ${error instanceof Error ? error.message : String(error)}`)
    if (error instanceof Error && error.stack) {
      logger.error(`Stack trace: ${error.stack}`)
    }
    process.exit(1)
  }
}

main()
