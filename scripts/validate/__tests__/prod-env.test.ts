import { describe, expect, it } from 'vitest';

import { parseDotenv, validatePulledEnv } from '../prod-env';

const VALID_KEK = 'a'.repeat(64);
const VALID_SECRET = 's'.repeat(32);
const VALID_CRON = 'c'.repeat(32);

function validHostedEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    POSTGRES_URL: 'postgresql://example.com/prod',
    REVEALUI_SECRET: VALID_SECRET,
    REVEALUI_KEK: VALID_KEK,
    REVEALUI_PUBLIC_SERVER_URL: 'https://api.revealui.com',
    NEXT_PUBLIC_SERVER_URL: 'https://api.revealui.com',
    STRIPE_SECRET_KEY: 'sk_test_abc',
    STRIPE_WEBHOOK_SECRET: 'whsec_xyz',
    REVEALUI_LICENSE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\nAAA\n-----END PRIVATE KEY-----',
    REVEALUI_CRON_SECRET: VALID_CRON,
    CORS_ORIGIN: 'https://revealui.com,https://admin.revealui.com',
    REVEALUI_ALERT_EMAIL: 'founder@revealui.com',
    ...overrides,
  };
}

describe('parseDotenv', () => {
  it('parses simple KEY=value pairs', () => {
    expect(parseDotenv('FOO=bar\nBAZ=qux')).toEqual({ FOO: 'bar', BAZ: 'qux' });
  });

  it('strips surrounding double quotes', () => {
    expect(parseDotenv('FOO="bar baz"')).toEqual({ FOO: 'bar baz' });
  });

  it('strips surrounding single quotes', () => {
    expect(parseDotenv("FOO='bar baz'")).toEqual({ FOO: 'bar baz' });
  });

  it('expands literal \\n into real newlines (PEM-encoded keys)', () => {
    expect(parseDotenv('KEY="line1\\nline2"')).toEqual({ KEY: 'line1\nline2' });
  });

  it('skips blank lines and comments', () => {
    const content = '# header\nFOO=bar\n\n# another\nBAZ=qux\n';
    expect(parseDotenv(content)).toEqual({ FOO: 'bar', BAZ: 'qux' });
  });

  it('handles CRLF line endings', () => {
    expect(parseDotenv('FOO=bar\r\nBAZ=qux\r\n')).toEqual({ FOO: 'bar', BAZ: 'qux' });
  });

  it('ignores malformed lines that do not match KEY=VALUE', () => {
    expect(parseDotenv('not_a_var\nFOO=bar\n=missing_key')).toEqual({ FOO: 'bar' });
  });

  it('preserves = within quoted values', () => {
    expect(parseDotenv('FOO="a=b=c"')).toEqual({ FOO: 'a=b=c' });
  });
});

describe('validatePulledEnv', () => {
  it('passes a clean hosted env (test-mode default)', () => {
    const result = validatePulledEnv(validHostedEnv());
    expect(result.ok).toBe(true);
    expect(result.mode).toBe('hosted');
    expect(result.stripeLiveMode).toBe(false);
  });

  it('passes a clean hosted env in STRIPE_LIVE_MODE with live keys', () => {
    const result = validatePulledEnv(
      validHostedEnv({ STRIPE_LIVE_MODE: 'true', STRIPE_SECRET_KEY: 'sk_live_abc' }),
    );
    expect(result.ok).toBe(true);
    expect(result.stripeLiveMode).toBe(true);
  });

  it('always injects NODE_ENV=production (gap-acceptance: pulled env never carries NODE_ENV)', () => {
    const env = validHostedEnv();
    delete (env as Record<string, string | undefined>).NODE_ENV;
    const result = validatePulledEnv(env);
    expect(result.ok).toBe(true);
  });

  it('fails when a required env var is missing (acceptance: missing var fails pre-deploy)', () => {
    const env = validHostedEnv();
    delete (env as Record<string, string | undefined>).NEXT_PUBLIC_SERVER_URL;
    const result = validatePulledEnv(env);
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/NEXT_PUBLIC_SERVER_URL/);
  });

  it('fails when sk_test_* used in STRIPE_LIVE_MODE=true (acceptance criterion)', () => {
    const result = validatePulledEnv(
      validHostedEnv({ STRIPE_LIVE_MODE: 'true', STRIPE_SECRET_KEY: 'sk_test_abc' }),
    );
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/sk_live_/);
  });

  it('fails when sk_live_* used with STRIPE_LIVE_MODE unset (test-mode posture)', () => {
    const result = validatePulledEnv(validHostedEnv({ STRIPE_SECRET_KEY: 'sk_live_abc' }));
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/sk_test_/);
  });

  it('fails when REVEALUI_CRON_SECRET <32 chars (acceptance criterion)', () => {
    const result = validatePulledEnv(validHostedEnv({ REVEALUI_CRON_SECRET: 'short' }));
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/REVEALUI_CRON_SECRET/);
    expect(result.message).toMatch(/32/);
  });

  it('fails when REVEALUI_KEK is not 64 hex characters', () => {
    const result = validatePulledEnv(validHostedEnv({ REVEALUI_KEK: 'not-hex-zzz' }));
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/REVEALUI_KEK/);
  });

  it('fails when production URL is not HTTPS', () => {
    const result = validatePulledEnv(
      validHostedEnv({
        REVEALUI_PUBLIC_SERVER_URL: 'http://api.revealui.com',
        NEXT_PUBLIC_SERVER_URL: 'http://api.revealui.com',
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/HTTPS/);
  });

  it('fails when URL parity is broken between REVEALUI_PUBLIC_SERVER_URL and NEXT_PUBLIC_SERVER_URL', () => {
    const result = validatePulledEnv(
      validHostedEnv({ NEXT_PUBLIC_SERVER_URL: 'https://different.example.com' }),
    );
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/must match/);
  });

  it('fails when CORS_ORIGIN contains a non-HTTPS origin', () => {
    const result = validatePulledEnv(
      validHostedEnv({ CORS_ORIGIN: 'https://revealui.com,http://leak.example' }),
    );
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/CORS_ORIGIN/);
  });

  it('fails when REVEALUI_ALERT_EMAIL is missing @', () => {
    const result = validatePulledEnv(validHostedEnv({ REVEALUI_ALERT_EMAIL: 'no-at-sign' }));
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/REVEALUI_ALERT_EMAIL/);
  });

  it('fails when STRIPE_WEBHOOK_SECRET does not start with whsec_', () => {
    const result = validatePulledEnv(validHostedEnv({ STRIPE_WEBHOOK_SECRET: 'wrong-prefix' }));
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/whsec_/);
  });

  it('rejects SKIP_ENV_VALIDATION=true even though validateStartup honors it', () => {
    // validateStartup short-circuits when SKIP_ENV_VALIDATION=true. The
    // pre-deploy gate must NOT — pulling a prod env that still contains
    // the bypass flag is itself a config bug worth blocking on.
    const result = validatePulledEnv(validHostedEnv({ SKIP_ENV_VALIDATION: 'true' }));
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/SKIP_ENV_VALIDATION/);
  });

  it('reports the message verbatim from validateStartup so CI logs match runtime errors', () => {
    const result = validatePulledEnv(validHostedEnv({ REVEALUI_SECRET: 'short' }));
    expect(result.ok).toBe(false);
    expect(result.message).toContain('REVEALUI_SECRET must be at least 32 characters');
  });
});
