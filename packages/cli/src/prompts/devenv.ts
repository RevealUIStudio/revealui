/**
 * Development environment configuration prompts
 */

import inquirer from 'inquirer';

export interface DevEnvConfig {
  createDevContainer: boolean;
  createDevbox: boolean;
}

export async function promptDevEnvConfig(): Promise<DevEnvConfig> {
  const answers = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'createDevContainer',
      message: 'Create Dev Container configuration for VS Code / GitHub Codespaces?',
      default: true,
    },
    {
      type: 'confirm',
      name: 'createDevbox',
      message: 'Create Devbox configuration for Nix-powered development?',
      default: true,
    },
  ]);

  return answers;
}
