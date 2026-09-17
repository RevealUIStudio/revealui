import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { type GetOpts, SecretNotFoundError, type SecretProvider } from './types.js';
import { assertSecretName } from './validate.js';

export interface FileProviderOptions {
  /** Directory of secret files. Default: Kubernetes-style RevealUI mount. */
  directory?: string;
  /**
   * When set, the file path is read from this env var (daemon
   * REVEALUI_LICENSE_KEY_FILE pattern) instead of directory/name.
   */
  pathEnvVar?: string;
}

const DEFAULT_DIR = '/var/run/secrets/revealui';

export class FileProvider implements SecretProvider {
  readonly id = 'file';
  private readonly directory: string;
  private readonly pathEnvVar?: string;

  constructor(options: FileProviderOptions = {}) {
    this.directory = options.directory ?? DEFAULT_DIR;
    this.pathEnvVar = options.pathEnvVar;
  }

  async get(name: string, opts?: GetOpts): Promise<string> {
    assertSecretName(name);
    const source = opts?.source ?? process.env;
    const filePath = this.pathEnvVar ? source[this.pathEnvVar] : join(this.directory, name);
    if (!filePath) {
      throw new SecretNotFoundError(name, this.id);
    }
    try {
      const contents = (await readFile(filePath, 'utf8')).trim();
      if (!contents) {
        throw new SecretNotFoundError(name, this.id);
      }
      return contents;
    } catch (err) {
      if (err instanceof SecretNotFoundError) throw err;
      throw new SecretNotFoundError(name, this.id);
    }
  }
}
