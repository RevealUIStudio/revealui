/**
 * Dependency installation
 */

import { createLogger } from '@revealui/setup/utils';
import { execa } from 'execa';
import ora from 'ora';

const logger = createLogger({ prefix: 'Install' });

export async function installDependencies(projectPath: string): Promise<void> {
  const spinner = ora('Installing dependencies with pnpm...').start();

  try {
    await execa('pnpm', ['install'], {
      cwd: projectPath,
      stdio: 'pipe',
    });
    spinner.succeed('Dependencies installed successfully');
  } catch (error) {
    spinner.fail('Failed to install dependencies');
    logger.error('Please run "pnpm install" manually');
    throw error;
  }
}

export async function isPnpmInstalled(): Promise<boolean> {
  try {
    await execa('pnpm', ['--version']);
    return true;
  } catch {
    return false;
  }
}

export async function checkPnpmVersion(): Promise<{ version: string; valid: boolean }> {
  try {
    const { stdout } = await execa('pnpm', ['--version']);
    const version = stdout.trim();
    const [major, minor] = version.split('.').map(Number);

    // Require pnpm 10.28.2 or higher
    const valid = major > 10 || (major === 10 && minor >= 28);

    return { version, valid };
  } catch {
    return { version: 'unknown', valid: false };
  }
}
