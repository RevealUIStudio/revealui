/**
 * Development environment configuration prompts
 */

import { confirm, isCancel } from '@clack/prompts';

export interface DevEnvConfig {
  createDevContainer: boolean;
  createDevbox: boolean;
}

export async function promptDevEnvConfig(): Promise<DevEnvConfig> {
  const createDevContainer = await confirm({
    message: 'Create Dev Container configuration for VS Code / GitHub Codespaces?',
    initialValue: true,
  });

  if (isCancel(createDevContainer)) {
    process.exit(0);
  }

  const createDevbox = await confirm({
    message: 'Create Devbox configuration for Nix-powered development?',
    initialValue: true,
  });

  if (isCancel(createDevbox)) {
    process.exit(0);
  }

  return { createDevContainer, createDevbox };
}
