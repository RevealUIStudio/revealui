/**
 * Sentry `environment` for a deploy.
 *
 * `NODE_ENV=production` is set on staging as well as production, so it is not
 * a safe Sentry label. Prefer `SENTRY_ENVIRONMENT` (then `REVEALUI_DEPLOY_ENV`,
 * then `NEXT_PUBLIC_SENTRY_ENVIRONMENT`). When those are unset, derive the
 * label from public hosts. A `*.staging.revealui.com` host is never reported
 * as production. Vercel preview stays `preview`.
 */

import { isStagingRevealHost, normalizeRequestHost } from './session-cookie-domain.js';

export type SentryEnvironmentName = 'production' | 'staging' | 'preview' | 'development' | 'test';

/** Non-secret label. Set `SENTRY_ENVIRONMENT=staging` on staging Vercel and Fly. */
export const SENTRY_ENVIRONMENT_VAR = 'SENTRY_ENVIRONMENT';

export interface SentryEnvironmentSource {
  SENTRY_ENVIRONMENT?: string | undefined;
  REVEALUI_DEPLOY_ENV?: string | undefined;
  NEXT_PUBLIC_SENTRY_ENVIRONMENT?: string | undefined;
  NODE_ENV?: string | undefined;
  VERCEL_ENV?: string | undefined;
  REVEALUI_API_URL?: string | undefined;
  NEXT_PUBLIC_API_URL?: string | undefined;
  API_URL?: string | undefined;
  REVEALUI_PUBLIC_SERVER_URL?: string | undefined;
  NEXT_PUBLIC_SERVER_URL?: string | undefined;
  VERCEL_PROJECT_PRODUCTION_URL?: string | undefined;
  VERCEL_URL?: string | undefined;
  SESSION_COOKIE_DOMAIN?: string | undefined;
  PASSKEY_RP_ID?: string | undefined;
  PASSKEY_ORIGIN?: string | undefined;
  CORS_ORIGIN?: string | undefined;
}

const HOST_KEYS = [
  'REVEALUI_API_URL',
  'NEXT_PUBLIC_API_URL',
  'API_URL',
  'REVEALUI_PUBLIC_SERVER_URL',
  'NEXT_PUBLIC_SERVER_URL',
  'VERCEL_PROJECT_PRODUCTION_URL',
  'VERCEL_URL',
  'SESSION_COOKIE_DOMAIN',
  'PASSKEY_RP_ID',
  'PASSKEY_ORIGIN',
  'CORS_ORIGIN',
] as const satisfies readonly (keyof SentryEnvironmentSource)[];

const PRODUCTION_HOSTS = new Set<string>([
  'revealui.com',
  'www.revealui.com',
  'api.revealui.com',
  'admin.revealui.com',
  'docs.revealui.com',
]);

function lockedEnvironment(raw: string | undefined): SentryEnvironmentName | null {
  if (raw == null) return null;
  const value = raw.trim().toLowerCase();
  switch (value) {
    case 'production':
    case 'staging':
    case 'preview':
    case 'development':
    case 'test':
      return value;
    default:
      return null;
  }
}

function firstLocked(...values: Array<string | undefined>): SentryEnvironmentName | null {
  for (const value of values) {
    const locked = lockedEnvironment(value);
    if (locked) return locked;
  }
  return null;
}

function splitComma(raw: string): string[] {
  const parts: string[] = [];
  let start = 0;
  for (let index = 0; index <= raw.length; index += 1) {
    if (index === raw.length || raw.charCodeAt(index) === 44) {
      const part = raw.slice(start, index).trim();
      if (part.length > 0) parts.push(part);
      start = index + 1;
    }
  }
  return parts;
}

function collectHosts(env: SentryEnvironmentSource): string[] {
  const hosts: string[] = [];
  for (const key of HOST_KEYS) {
    const raw = env[key];
    if (typeof raw !== 'string' || raw.trim().length === 0) continue;
    for (const part of splitComma(raw)) {
      const host = normalizeRequestHost(part);
      if (host) hosts.push(host);
    }
  }
  return hosts;
}

/**
 * Resolve the Sentry environment label.
 * Staging hosts report `staging`, or `preview` when that explicit label is set.
 * They do not report `production`.
 */
export function resolveSentryEnvironment(env: SentryEnvironmentSource): SentryEnvironmentName {
  const hosts = collectHosts(env);
  let stagingHost = false;
  let productionHost = false;
  for (const host of hosts) {
    if (isStagingRevealHost(host)) stagingHost = true;
    if (PRODUCTION_HOSTS.has(host)) productionHost = true;
  }

  const explicit = firstLocked(
    env.SENTRY_ENVIRONMENT,
    env.REVEALUI_DEPLOY_ENV,
    env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
  );

  if (stagingHost) {
    if (
      explicit === 'staging' ||
      explicit === 'preview' ||
      explicit === 'development' ||
      explicit === 'test'
    ) {
      return explicit;
    }
    return 'staging';
  }

  if (explicit) return explicit;
  if (productionHost) return 'production';

  const vercel = lockedEnvironment(env.VERCEL_ENV);
  if (
    vercel === 'preview' ||
    vercel === 'development' ||
    vercel === 'test' ||
    vercel === 'staging'
  ) {
    return vercel;
  }

  const nodeEnv = lockedEnvironment(env.NODE_ENV);
  if (
    nodeEnv === 'development' ||
    nodeEnv === 'test' ||
    nodeEnv === 'staging' ||
    nodeEnv === 'preview'
  ) {
    return nodeEnv;
  }

  if (nodeEnv === 'production' || vercel === 'production') return 'production';
  return 'development';
}
