import fs from 'node:fs';
import path from 'node:path';
import { findWorkspaceRoot } from './workspace.js';

export interface DevConfig {
  defaultProfile?: string;
}

export function getDevConfigPath(startDir = process.cwd()): string | null {
  const workspaceRoot = findWorkspaceRoot(startDir);
  if (!workspaceRoot) {
    return null;
  }

  return path.join(workspaceRoot, '.revealui', 'dev.json');
}

export function readDevConfig(startDir = process.cwd()): DevConfig {
  const configPath = getDevConfigPath(startDir);
  if (!(configPath && fs.existsSync(configPath))) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8')) as DevConfig;
  } catch {
    return {};
  }
}

export function writeDevConfig(config: DevConfig, startDir = process.cwd()): string {
  const configPath = getDevConfigPath(startDir);
  if (!configPath) {
    throw new Error('RevealUI workspace root not found');
  }

  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(`${configPath}`, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  return configPath;
}
