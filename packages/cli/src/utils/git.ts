/**
 * Git utilities for project initialization
 */

import { createLogger } from '@revealui/setup/utils'
import { execa } from 'execa'

const logger = createLogger({ prefix: 'Git' })

export async function initializeGitRepo(projectPath: string): Promise<void> {
  try {
    await execa('git', ['init'], { cwd: projectPath })
    logger.success('Initialized git repository')
  } catch (error) {
    logger.warn('Failed to initialize git repository')
    throw error
  }
}

export async function createInitialCommit(projectPath: string): Promise<void> {
  try {
    await execa('git', ['add', '.'], { cwd: projectPath })
    await execa('git', ['commit', '-m', 'Initial commit from @revealui/cli'], { cwd: projectPath })
    logger.success('Created initial commit')
  } catch (error) {
    logger.warn('Failed to create initial commit')
    throw error
  }
}

export async function isGitInstalled(): Promise<boolean> {
  try {
    await execa('git', ['--version'])
    return true
  } catch {
    return false
  }
}
