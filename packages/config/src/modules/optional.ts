/**
 * @revealui/config - Optional Configuration Modules
 */

import { type EnvConfig, studioDomainEnvSchema, studioFulfillmentEnvSchema } from '../schema.js';

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

export interface StudioFulfillmentConfig {
  origin: string;
  /** Server-only owner credential; never serialize optional config to a browser. */
  ownerSession: string;
}

/** Supported optional configuration validates the credential and exact destination together. */
export function getStudioFulfillmentConfig(
  env: Record<string, unknown>,
): StudioFulfillmentConfig | null {
  const value = studioFulfillmentEnvSchema.parse(env);
  if (!(value.STUDIO_SITE_URL && value.STUDIO_OWNER_SESSION)) return null;
  return {
    origin: new URL(value.STUDIO_SITE_URL).origin,
    ownerSession: value.STUDIO_OWNER_SESSION,
  };
}

export interface StudioDomainConfig {
  token: string;
  projectId: string;
  teamId?: string;
}
export function getStudioDomainConfig(env: Record<string, unknown>): StudioDomainConfig | null {
  const value = studioDomainEnvSchema.parse(env);
  if (!(value.STUDIO_VERCEL_PROJECT_ID && value.STUDIO_VERCEL_TOKEN)) return null;
  return {
    token: value.STUDIO_VERCEL_TOKEN,
    projectId: value.STUDIO_VERCEL_PROJECT_ID,
    ...(value.STUDIO_VERCEL_TEAM_ID ? { teamId: value.STUDIO_VERCEL_TEAM_ID } : {}),
  };
}

export interface OptionalConfig {
  sentry: SentryConfig;
  devTools: DevToolsConfig;
  studioFulfillment: StudioFulfillmentConfig | null;
  studioDomain: StudioDomainConfig | null;
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
    studioFulfillment: getStudioFulfillmentConfig(env),
    studioDomain: getStudioDomainConfig(env),
  };
}
