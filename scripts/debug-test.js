// Simple test script to debug the hanging issue
console.log('Starting test script...')

try {
  console.log('Testing import...')
  const { createLogger } = require('./scripts/shared/utils.ts')
  console.log('Import successful')

  console.log('Creating logger...')
  const logger = createLogger()
  console.log('Logger created')

  logger.info('Test message')
  console.log('Test completed successfully')
} catch (error) {
  console.error('Error:', error)
  process.exit(1)
}