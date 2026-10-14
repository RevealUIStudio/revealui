import fs from 'node:fs';
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
    text = readManagedFile(projectRoot, `${MANAGER_DIR}/${MANAGER_FILE}`).toString('utf8');
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
      if (fs.lstatSync(current).isSymbolicLink()) {
        throw new Error(`Managed destination must be a regular path: ${relativePath}`);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
}

/** Read one stable regular file, rejecting symlink components and concurrent replacement. */
export function readManagedFile(projectRoot: string, relativePath: string): Buffer {
  RelativeManagerPathSchema.parse(relativePath);
  const components: { path: string; stat: fs.Stats }[] = [];
  const filePath = join(resolve(projectRoot), relativePath);
  // Open before checking metadata. O_NOFOLLOW rejects a leaf symlink;
  // descriptor identity and component checks detect parent replacement.
  const fd = fs.openSync(
    filePath,
    fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK,
  );
  try {
    let current = resolve(projectRoot);
    for (const part of relativePath.split('/')) {
      current = join(current, part);
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink()) {
        throw new Error(`Managed destination must be a regular path: ${relativePath}`);
      }
      components.push({ path: current, stat });
    }
    const before = fs.fstatSync(fd);
    const leaf = components.at(-1)?.stat;
    if (!(leaf && before.isFile()) || before.dev !== leaf.dev || before.ino !== leaf.ino) {
      throw new Error(`Managed file changed while opening: ${relativePath}`);
    }
    const bytes = fs.readFileSync(fd);
    const after = fs.fstatSync(fd);
    if (
      before.size !== after.size ||
      before.mtimeMs !== after.mtimeMs ||
      before.ctimeMs !== after.ctimeMs
    ) {
      throw new Error(`Managed file changed while reading: ${relativePath}`);
    }
    for (const component of components) {
      const stat = fs.lstatSync(component.path);
      if (
        stat.isSymbolicLink() ||
        stat.dev !== component.stat.dev ||
        stat.ino !== component.stat.ino
      ) {
        throw new Error(`Managed path changed while reading: ${relativePath}`);
      }
    }
    return bytes;
  } finally {
    fs.closeSync(fd);
  }
}
