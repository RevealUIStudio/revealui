/**
 * Database seeding
 */

import { execa } from 'execa'
import ora from 'ora'
import { createLogger } from '@revealui/setup/utils'

const logger = createLogger({ prefix: 'Seed' })

export async function seedDatabase(projectPath: string): Promise<void> {
  const spinner = ora('Seeding database...').start()

  try {
    // Check if db:seed script exists
    const { stdout } = await execa('pnpm', ['run', '--if-present', 'db:seed'], {
      cwd: projectPath,
      stdio: 'pipe',
    })

    if (stdout.includes('Unknown command')) {
      spinner.info('No seed script available')
      return
    }

    spinner.succeed('Database seeded successfully')
  } catch (error) {
    spinner.warn('Failed to seed database (optional)')
    logger.info('You can seed the database later with "pnpm db:seed"')
    // Don't throw - seeding is optional
  }
}
