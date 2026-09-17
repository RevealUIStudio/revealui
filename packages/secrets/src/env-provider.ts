import { type GetOpts, SecretNotFoundError, type SecretProvider } from './types.js';
import { assertSecretName } from './validate.js';

export class EnvProvider implements SecretProvider {
  readonly id = 'env';

  async get(name: string, opts?: GetOpts): Promise<string> {
    assertSecretName(name);
    const source = opts?.source ?? process.env;
    const value = source[name];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
    throw new SecretNotFoundError(name, this.id);
  }
}
