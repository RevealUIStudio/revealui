/**
 * @revealui/config - Optional Configuration Modules
 */

import type { EnvConfig } from '../schema.js';

export interface SupabaseConfig {
  url?: string;
  publishableKey?: string;
  secretKey?: string;
  databaseUri?: string;
}

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
  supabase: SupabaseConfig;
  sentry: SentryConfig;
  devTools: DevToolsConfig;
}

export function getSupabaseConfig(env: EnvConfig): SupabaseConfig {
  return {
    url: env.NEXT_PUBLIC_SUPABASE_URL || undefined,
    publishableKey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || undefined,
    secretKey: env.SUPABASE_SECRET_KEY || undefined,
    databaseUri: env.SUPABASE_DATABASE_URI || undefined,
  };
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
    supabase: getSupabaseConfig(env),
    sentry: getSentryConfig(env),
    devTools: getDevToolsConfig(env),
  };
}
