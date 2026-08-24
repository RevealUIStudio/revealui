/**
 * When the first-week lifecycle cron may call the mailer.
 *
 * Investigation (2026-08-20): templates, dispatcher registration, and the
 * Gmail send provider already exist. The cron stayed disarmed on purpose
 * behind LIFECYCLE_EMAILS_ENABLED so production would not blast the
 * sequence. Hosted test/staging already consumes the same Gmail SA +
 * EMAIL_FROM path (GAP-343: vercel:api-staging). This resolver arms that
 * test path when the mailbox fields are present, fails closed without
 * them, never arms CI, and leaves production (main) disarmed unless the
 * owner later sets the flag after a delivery check.
 */

/** Same root as scripts/setup/gen-staging-secrets.ts (GAP-343). */
export const HOSTED_TEST_ROOT_DOMAIN = 'staging.revealui.com';

/** Exact hostnames only. Substring / suffix checks are a CodeQL high (js/incomplete-url-substring-sanitization). */
export const HOSTED_TEST_HOSTNAMES = [
  HOSTED_TEST_ROOT_DOMAIN,
  `admin.${HOSTED_TEST_ROOT_DOMAIN}`,
  `api.${HOSTED_TEST_ROOT_DOMAIN}`,
] as const;

const HOSTED_TEST_HOSTNAME_SET: ReadonlySet<string> = new Set(HOSTED_TEST_HOSTNAMES);

export type LifecycleArmingReason =
  | 'hosted-test-mailbox'
  | 'explicit-flag'
  | 'ci'
  | 'mailbox-missing'
  | 'production-hold'
  | 'explicitly-disabled';

export interface LifecycleArmingEnv {
  NODE_ENV?: string;
  VERCEL_ENV?: string;
  VERCEL_GIT_COMMIT_REF?: string;
  REVEALUI_API_URL?: string;
  REVEALUI_PUBLIC_SERVER_URL?: string;
  NEXT_PUBLIC_SERVER_URL?: string;
  ADMIN_URL?: string;
  LIFECYCLE_EMAILS_ENABLED?: string;
  GOOGLE_SERVICE_ACCOUNT_EMAIL?: string;
  GOOGLE_PRIVATE_KEY?: string;
}

export interface LifecycleArmingDecision {
  armed: boolean;
  reason: LifecycleArmingReason;
}

export function isLifecycleMailboxConfigured(env: LifecycleArmingEnv): boolean {
  return Boolean(env.GOOGLE_SERVICE_ACCOUNT_EMAIL && env.GOOGLE_PRIVATE_KEY);
}

export function isLifecycleEligibleTier(tier: string): boolean {
  return tier === 'pro' || tier === 'max';
}

function hostnameFromAbsoluteUrl(value: string | undefined): string | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  try {
    const hostname = new URL(value).hostname;
    return hostname.length > 0 ? hostname : null;
  } catch {
    return null;
  }
}

function isHostedTestUrl(value: string | undefined): boolean {
  const hostname = hostnameFromAbsoluteUrl(value);
  return hostname !== null && HOSTED_TEST_HOSTNAME_SET.has(hostname);
}

export function isHostedTestEnvironment(env: LifecycleArmingEnv): boolean {
  if (env.VERCEL_ENV === 'preview') return true;
  if (env.VERCEL_GIT_COMMIT_REF === 'test') return true;
  return (
    isHostedTestUrl(env.REVEALUI_API_URL) ||
    isHostedTestUrl(env.REVEALUI_PUBLIC_SERVER_URL) ||
    isHostedTestUrl(env.NEXT_PUBLIC_SERVER_URL) ||
    isHostedTestUrl(env.ADMIN_URL)
  );
}

export function resolveLifecycleEmailArming(env: LifecycleArmingEnv): LifecycleArmingDecision {
  if (env.NODE_ENV === 'test') {
    return { armed: false, reason: 'ci' };
  }
  if (env.LIFECYCLE_EMAILS_ENABLED === 'false') {
    return { armed: false, reason: 'explicitly-disabled' };
  }
  if (!isLifecycleMailboxConfigured(env)) {
    return { armed: false, reason: 'mailbox-missing' };
  }
  if (isHostedTestEnvironment(env)) {
    return { armed: true, reason: 'hosted-test-mailbox' };
  }
  if (env.LIFECYCLE_EMAILS_ENABLED === 'true') {
    return { armed: true, reason: 'explicit-flag' };
  }
  return { armed: false, reason: 'production-hold' };
}

export function readLifecycleArmingEnv(env: NodeJS.ProcessEnv = process.env): LifecycleArmingEnv {
  return {
    NODE_ENV: env.NODE_ENV,
    VERCEL_ENV: env.VERCEL_ENV,
    VERCEL_GIT_COMMIT_REF: env.VERCEL_GIT_COMMIT_REF,
    REVEALUI_API_URL: env.REVEALUI_API_URL,
    REVEALUI_PUBLIC_SERVER_URL: env.REVEALUI_PUBLIC_SERVER_URL,
    NEXT_PUBLIC_SERVER_URL: env.NEXT_PUBLIC_SERVER_URL,
    ADMIN_URL: env.ADMIN_URL,
    LIFECYCLE_EMAILS_ENABLED: env.LIFECYCLE_EMAILS_ENABLED,
    GOOGLE_SERVICE_ACCOUNT_EMAIL: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    GOOGLE_PRIVATE_KEY: env.GOOGLE_PRIVATE_KEY,
  };
}
