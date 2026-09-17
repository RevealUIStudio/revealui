import { type GetOpts, SecretNotFoundError, type SecretProvider } from './types.js';
import { assertSecretName } from './validate.js';

export class ChainProvider implements SecretProvider {
  readonly id = 'chain';

  constructor(private readonly providers: SecretProvider[]) {}

  async get(name: string, opts?: GetOpts): Promise<string> {
    assertSecretName(name);
    const tried: string[] = [];
    for (const provider of this.providers) {
      tried.push(provider.id);
      try {
        return await provider.get(name, opts);
      } catch (err) {
        if (err instanceof SecretNotFoundError) continue;
        throw err;
      }
    }
    throw new SecretNotFoundError(name, `${this.id}:${tried.join(',')}`);
  }
}
