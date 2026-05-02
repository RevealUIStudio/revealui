/**
 * @revealui/config - Optional Configuration Modules
 */

import type { EnvConfig } from '../schema.js';

export interface SentryConfig {
  dsn?: string;
  authToken?: string;
  org?: string;
  project?: string;
}

export interface DevToolsConfig {
  neonApiKey?: string;
  skipOnInit?: boolean;
}

export interface OptionalConfig {
  sentry: SentryConfig;
  devTools: DevToolsConfig;
}

export function getSentryConfig(env: EnvConfig): SentryConfig {
  return {
    dsn: env.NEXT_PUBLIC_SENTRY_DSN || undefined,
    authToken: env.SENTRY_AUTH_TOKEN || undefined,
    org: env.SENTRY_ORG || undefined,
    project: env.SENTRY_PROJECT || undefined,
  };
}

export function getDevToolsConfig(env: EnvConfig): DevToolsConfig {
  return {
    neonApiKey: env.NEON_API_KEY || undefined,
    skipOnInit: env.SKIP_ONINIT === 'true',
  };
}

export function getOptionalConfig(env: EnvConfig): OptionalConfig {
  return {
    sentry: getSentryConfig(env),
    devTools: getDevToolsConfig(env),
  };
}
