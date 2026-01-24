/**
 * @revealui/config - Optional Configuration Modules
 */

import type { EnvConfig } from '../schema'

export interface SupabaseConfig {
  url?: string
  anonKey?: string
  serviceRoleKey?: string
  databaseUri?: string
}

export interface SentryConfig {
  dsn?: string
  authToken?: string
  org?: string
  project?: string
}

export interface DevToolsConfig {
  neonApiKey?: string
  skipOnInit?: boolean
}

export interface OptionalConfig {
  supabase: SupabaseConfig
  sentry: SentryConfig
  devTools: DevToolsConfig
}

export function getSupabaseConfig(env: EnvConfig): SupabaseConfig {
  return {
    url: env.NEXT_PUBLIC_SUPABASE_URL || '',
    anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY || '',
    databaseUri: env.SUPABASE_DATABASE_URI || '',
  }
}

export function getSentryConfig(env: EnvConfig): SentryConfig {
  return {
    dsn: env.NEXT_PUBLIC_SENTRY_DSN || '',
    authToken: env.SENTRY_AUTH_TOKEN || '',
    org: env.SENTRY_ORG || '',
    project: env.SENTRY_PROJECT || '',
  }
}

export function getDevToolsConfig(env: EnvConfig): DevToolsConfig {
  return {
    neonApiKey: env.NEON_API_KEY || '',
    skipOnInit: env.SKIP_ONINIT === 'true',
  }
}

export function getOptionalConfig(env: EnvConfig): OptionalConfig {
  return {
    supabase: getSupabaseConfig(env),
    sentry: getSentryConfig(env),
    devTools: getDevToolsConfig(env),
  }
}
