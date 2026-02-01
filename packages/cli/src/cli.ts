/**
 * CLI definition using Commander.js
 */

import { createLogger } from '@revealui/setup/utils'
import { Command } from 'commander'

const logger = createLogger({ prefix: 'CLI' })

export interface CliOptions {
  template?: string
  skipGit?: boolean
  skipInstall?: boolean
}

export function createCli(): Command {
  const program = new Command()

  program
    .name('create-revealui')
    .description('Create a new RevealUI project')
    .version('0.1.0')
    .argument('[project-name]', 'Name of the project')
    .option('-t, --template <name>', 'Template to use (basic-blog, e-commerce, portfolio)')
    .option('--skip-git', 'Skip git initialization', false)
    .option('--skip-install', 'Skip dependency installation', false)
    .action(async (projectName: string | undefined, options: CliOptions) => {
      logger.header('🚀 Create RevealUI Project')

      // Import main orchestrator dynamically to avoid circular deps
      const { run } = await import('./index.js')
      await run(projectName, options)
    })

  return program
}
