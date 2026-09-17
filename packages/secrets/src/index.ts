/**
 * @revealui/secrets — uniform secret retrieval across env, files, and revvault.
 *
 * @packageDocumentation
 */

export { SecretCache } from './cache.js';
export { ChainProvider } from './chain-provider.js';
export { EnvProvider } from './env-provider.js';
export { FileProvider } from './file-provider.js';
export { clearSecretCache, detectProviders, resolveSecret } from './resolve.js';
export { commandExists, RevvaultProvider } from './revvault-provider.js';
export {
  type AuditHook,
  DEFAULT_SECRETS_CONFIG,
  type GetOpts,
  SecretNotFoundError,
  type SecretProvider,
  type SecretsConfig,
} from './types.js';
