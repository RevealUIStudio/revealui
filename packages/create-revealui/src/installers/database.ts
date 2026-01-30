/**
 * Database initialization
 */

import { execa } from 'execa'
import ora from 'ora'
import { createLogger } from '@revealui/setup/utils'

const logger = createLogger({ prefix: 'Database' })

export async function initializeDatabase(projectPath: string): Promise<void> {
  const spinner = ora('Initializing database...').start()

  try {
    // Run db:init script
    await execa('pnpm', ['db:init'], {
      cwd: projectPath,
      stdio: 'pipe',
    })
    spinner.text = 'Running database migrations...'

    // Run db:migrate script
    await execa('pnpm', ['db:migrate'], {
      cwd: projectPath,
      stdio: 'pipe',
    })

    spinner.succeed('Database initialized successfully')
  } catch (error) {
    spinner.fail('Failed to initialize database')
    logger.warn('You may need to run "pnpm db:init && pnpm db:migrate" manually')
    logger.warn('Make sure your database connection string is correct in .env.development.local')
    // Don't throw - database setup is optional at creation time
  }
}
