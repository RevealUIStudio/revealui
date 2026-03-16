import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import type { StudioConfig } from '../types';

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

const DEFAULT_CONFIG: StudioConfig = {
  intent: null,
  setupComplete: false,
  completedSteps: [],
};

let cachedConfig: StudioConfig | null = null;

export async function getConfig(): Promise<StudioConfig> {
  if (!isTauri()) {
    return cachedConfig ?? { ...DEFAULT_CONFIG };
  }
  const config = await tauriInvoke<StudioConfig>('get_config');
  cachedConfig = config;
  return config;
}

export async function setConfig(config: StudioConfig): Promise<void> {
  cachedConfig = config;
  if (!isTauri()) return;
  await tauriInvoke<void>('set_config', { config });
}

export async function resetConfig(): Promise<void> {
  cachedConfig = null;
  if (!isTauri()) return;
  await tauriInvoke<void>('reset_config');
}

export async function completeStep(stepId: string): Promise<StudioConfig> {
  const config = await getConfig();
  if (!config.completedSteps.includes(stepId)) {
    config.completedSteps.push(stepId);
  }
  await setConfig(config);
  return config;
}

export function isStepComplete(config: StudioConfig, stepId: string): boolean {
  return config.completedSteps.includes(stepId);
}
