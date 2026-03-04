/**
 * Node version validation
 */

import { createLogger } from '@revealui/setup/utils'

const logger = createLogger({ prefix: 'Setup' })

const REQUIRED_NODE_VERSION = '24.13.0'

export function validateNodeVersion(): boolean {
  const currentVersion = process.version.slice(1) // Remove 'v' prefix
  const [currentMajor, currentMinor] = currentVersion.split('.').map(Number)
  const [requiredMajor, requiredMinor] = REQUIRED_NODE_VERSION.split('.').map(Number)

  if (
    currentMajor < requiredMajor ||
    (currentMajor === requiredMajor && currentMinor < requiredMinor)
  ) {
    logger.error(
      `Node.js ${REQUIRED_NODE_VERSION} or higher is required. You have ${currentVersion}.`,
    )
    logger.info('Please upgrade Node.js: https://nodejs.org/')
    return false
  }

  return true
}
