import { lstatSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  MANAGER_DIR,
  MANAGER_FILE,
  type ManagerConfig,
  ManagerSchema,
  RelativeManagerPathSchema,
} from './schema.js';

export function managerPath(projectRoot: string): string {
  return join(projectRoot, MANAGER_DIR, MANAGER_FILE);
}

/** Missing configuration uses schema defaults; malformed configuration never does. */
export function loadManager(projectRoot: string): ManagerConfig {
  let text: string;
  try {
    text = readFileSync(managerPath(projectRoot), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return ManagerSchema.parse({});
    throw error;
  }
  return ManagerSchema.parse(JSON.parse(text) as unknown);
}

export function contentRootRelative(config: ManagerConfig): string {
  return `${MANAGER_DIR}/${RelativeManagerPathSchema.parse(config.contentRoot)}`;
}

export function contentRootPath(projectRoot: string, config = loadManager(projectRoot)): string {
  return join(projectRoot, contentRootRelative(config));
}

/** Reject symlinks in every destination component, including dangling links. */
export function assertManagedDestination(projectRoot: string, relativePath: string): void {
  RelativeManagerPathSchema.parse(relativePath);
  let current = resolve(projectRoot);
  for (const part of relativePath.split('/')) {
    current = join(current, part);
    try {
      if (lstatSync(current).isSymbolicLink()) {
        throw new Error(`Managed destination must be a regular path: ${relativePath}`);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
}
