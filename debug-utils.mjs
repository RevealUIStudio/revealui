// Debug the utils import
console.log('Testing utils import...')

try {
  const { createLogger } = await import('./scripts/shared/utils.ts')
  console.log('Import successful')

  const logger = createLogger()
  console.log('Logger created')

  logger.info('Test message from logger')
  console.log('Logger test successful')
} catch (error) {
  console.error('Error importing utils:', error)
  process.exit(1)
}