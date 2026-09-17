import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { type GetOpts, SecretNotFoundError, type SecretProvider } from './types.js';
import { assertSecretName } from './validate.js';

const execFileAsync = promisify(execFile);

export interface RevvaultProviderOptions {
  bin?: string;
  exec?: typeof execFileAsync;
}

export class RevvaultProvider implements SecretProvider {
  readonly id = 'revvault';
  private readonly bin: string;
  private readonly exec: typeof execFileAsync;

  constructor(options: RevvaultProviderOptions = {}) {
    this.bin = options.bin ?? 'revvault';
    this.exec = options.exec ?? execFileAsync;
  }

  async get(name: string, _opts?: GetOpts): Promise<string> {
    assertSecretName(name);
    try {
      const { stdout } = await this.exec(this.bin, ['get', '--full', name], {
        encoding: 'utf8',
        timeout: 15_000,
      });
      const value = stdout.trim();
      if (!value) {
        throw new SecretNotFoundError(name, this.id);
      }
      return value;
    } catch (err) {
      if (err instanceof SecretNotFoundError) throw err;
      throw new SecretNotFoundError(name, this.id);
    }
  }
}

export async function commandExists(
  bin: string,
  exec: typeof execFileAsync = execFileAsync,
): Promise<boolean> {
  try {
    await exec(bin, ['--version'], { encoding: 'utf8', timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}
