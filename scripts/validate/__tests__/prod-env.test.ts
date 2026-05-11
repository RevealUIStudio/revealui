import { describe, expect, it } from 'vitest';

import {
  isVercelEncryptedBlob,
  parseDotenv,
  scrubVercelEncryptedBlobs,
  validatePulledEnv,
} from '../prod-env';

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
    SENTRY_DSN: 'https://abcdef0123456789@o123456.ingest.sentry.io/4505123456789012',
    STRIPE_SECRET_KEY: 'sk_test_abc',
    STRIPE_WEBHOOK_SECRET: 'whsec_xyz',
    REVEALUI_LICENSE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\nAAA\n-----END PRIVATE KEY-----',
    REVEALUI_CRON_SECRET: VALID_CRON,
    CORS_ORIGIN: 'https://revealui.com,https://admin.revealui.com',
    REVEALUI_ALERT_EMAIL: 'founder@revealui.com',
    ...overrides,
  };
}

/**
 * A real-world Vercel v2 encryption envelope shape, base64 of
 * `{"v":"v2","c":"<ciphertext>","k":[...]}`. Used to verify the blob
 * detector — must NOT be confused with a regular env value.
 */
const SAMPLE_V2_BLOB = 'eyJ2IjoidjIiLCJjIjoiYWJjZGVmZ2hpamtsbW5vcCIsImsiOlsxLDIsM119';
// Decoded: {"v":"v2","c":"abcdefghijklmnop","k":[1,2,3]}

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

describe('isVercelEncryptedBlob', () => {
  it('detects a Vercel v2 envelope by prefix + JSON structure', () => {
    expect(isVercelEncryptedBlob(SAMPLE_V2_BLOB)).toBe(true);
  });

  it('rejects plaintext values that happen to be valid HTTPS URLs', () => {
    expect(isVercelEncryptedBlob('https://api.revealui.com')).toBe(false);
  });

  it('rejects comma-separated origin lists', () => {
    expect(isVercelEncryptedBlob('https://revealui.com,https://admin.revealui.com')).toBe(false);
  });

  it('rejects empty strings', () => {
    expect(isVercelEncryptedBlob('')).toBe(false);
  });

  it('rejects the v2 prefix without valid JSON body', () => {
    // Prefix-only collision — must NOT pass detection.
    expect(isVercelEncryptedBlob('eyJ2IjoidjIimalformed')).toBe(false);
  });

  it('rejects valid base64 JSON with the wrong version', () => {
    // {"v":"v1","c":"..."} — Vercel's older format; our scrub is targeted at v2 only.
    const v1 = Buffer.from('{"v":"v1","c":"xyz"}').toString('base64');
    expect(isVercelEncryptedBlob(v1)).toBe(false);
  });

  it('rejects valid base64 JSON missing the c (ciphertext) field', () => {
    const noCiphertext = Buffer.from('{"v":"v2"}').toString('base64');
    expect(isVercelEncryptedBlob(noCiphertext)).toBe(false);
  });

  it('rejects valid base64 of a non-object (defensive)', () => {
    const arrayShape = Buffer.from('["v2"]').toString('base64');
    expect(isVercelEncryptedBlob(arrayShape)).toBe(false);
  });
});

describe('scrubVercelEncryptedBlobs', () => {
  it('replaces encrypted blob values with empty strings', () => {
    const { env, scrubbedKeys } = scrubVercelEncryptedBlobs({
      CORS_ORIGIN: SAMPLE_V2_BLOB,
      OTHER: 'plaintext',
    });
    expect(env.CORS_ORIGIN).toBe('');
    expect(env.OTHER).toBe('plaintext');
    expect(scrubbedKeys).toEqual(['CORS_ORIGIN']);
  });

  it('leaves plaintext values untouched', () => {
    const input = {
      POSTGRES_URL: 'postgresql://example.com/prod',
      CORS_ORIGIN: 'https://revealui.com',
      SENTRY_DSN: 'https://abc@o123.ingest.sentry.io/456',
    };
    const { env, scrubbedKeys } = scrubVercelEncryptedBlobs(input);
    expect(env).toEqual(input);
    expect(scrubbedKeys).toEqual([]);
  });

  it('returns an empty key list when no blobs are present', () => {
    const { scrubbedKeys } = scrubVercelEncryptedBlobs({ FOO: 'bar' });
    expect(scrubbedKeys).toEqual([]);
  });

  it('handles an env with multiple blobs', () => {
    const { env, scrubbedKeys } = scrubVercelEncryptedBlobs({
      A: SAMPLE_V2_BLOB,
      B: 'plaintext',
      C: SAMPLE_V2_BLOB,
    });
    expect(env.A).toBe('');
    expect(env.B).toBe('plaintext');
    expect(env.C).toBe('');
    expect(scrubbedKeys.sort()).toEqual(['A', 'C']);
  });
});

describe('validatePulledEnv (Vercel v2 envelope integration)', () => {
  it('passes when CORS_ORIGIN is a v2 envelope (treated as opaque; runtime decrypts)', () => {
    // This is the 2026-05-11 regression: Vercel CLI started returning
    // ciphertext for `encrypted`-type vars, breaking every main Deploy.
    // After the scrub fix, the CI gate skips format check (presence still
    // counts) and lets deploy proceed; runtime validateStartup() catches
    // any real misconfig with decrypted values.
    const result = validatePulledEnv(validHostedEnv({ CORS_ORIGIN: SAMPLE_V2_BLOB }));
    expect(result.ok).toBe(true);
    expect(result.scrubbedBlobKeys).toEqual(['CORS_ORIGIN']);
  });

  it('lists every scrubbed key so CI logs can report the platform-encrypted footprint', () => {
    const result = validatePulledEnv(
      validHostedEnv({
        CORS_ORIGIN: SAMPLE_V2_BLOB,
        REVEALUI_PUBLIC_SERVER_URL: SAMPLE_V2_BLOB,
        NEXT_PUBLIC_SERVER_URL: SAMPLE_V2_BLOB,
      }),
    );
    expect(result.ok).toBe(true);
    expect(result.scrubbedBlobKeys.sort()).toEqual([
      'CORS_ORIGIN',
      'NEXT_PUBLIC_SERVER_URL',
      'REVEALUI_PUBLIC_SERVER_URL',
    ]);
  });

  it('still fails on missing required vars even with blobs present (presence > format)', () => {
    const env = validHostedEnv({ CORS_ORIGIN: SAMPLE_V2_BLOB });
    delete (env as Record<string, string | undefined>).REVEALUI_ALERT_EMAIL;
    const result = validatePulledEnv(env);
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/REVEALUI_ALERT_EMAIL/);
  });
});
