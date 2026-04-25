import { afterEach, describe, expect, it, vi } from 'vitest';
import { type EnvMap, validateStartup } from '../validate-startup.js';

const HEX_64 = 'a'.repeat(64);
const SECRET_32 = 'x'.repeat(32);
const CRON_32 = 'c'.repeat(32);
const HTTPS_URL = 'https://app.revealui.com';

/**
 * Live-mode production fixture. Used by all the long-standing format-check
 * tests so the strict (`sk_live_` + `pk_live_`) path is exercised.
 */
function validLiveProdEnv(overrides: EnvMap = {}): EnvMap {
  return {
    NODE_ENV: 'production',
    STRIPE_LIVE_MODE: 'true',
    POSTGRES_URL: 'postgresql://user:pw@host/db',
    REVEALUI_SECRET: SECRET_32,
    REVEALUI_KEK: HEX_64,
    REVEALUI_PUBLIC_SERVER_URL: HTTPS_URL,
    NEXT_PUBLIC_SERVER_URL: HTTPS_URL,
    STRIPE_SECRET_KEY: 'sk_live_deadbeef',
    STRIPE_WEBHOOK_SECRET: 'whsec_deadbeef',
    REVEALUI_LICENSE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----',
    REVEALUI_CRON_SECRET: CRON_32,
    CORS_ORIGIN: 'https://app.revealui.com,https://admin.revealui.com',
    REVEALUI_ALERT_EMAIL: 'ops@revealui.com',
    ...overrides,
  };
}

/**
 * Test-mode production fixture (pre-launch / pre-audit posture). Used by the
 * STRIPE_LIVE_MODE toggle tests + as the realistic shape of today's prod env.
 */
function validTestProdEnv(overrides: EnvMap = {}): EnvMap {
  const live = validLiveProdEnv();
  return {
    ...live,
    STRIPE_LIVE_MODE: undefined,
    STRIPE_SECRET_KEY: 'sk_test_deadbeef',
    ...overrides,
  };
}

// Backwards-compat: a few legacy tests below reference `validProdEnv` —
// keep the alias pointed at the live-mode fixture so they exercise the
// strict path.
const validProdEnv = validLiveProdEnv;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('validateStartup — always-required presence', () => {
  it('throws when POSTGRES_URL is missing', () => {
    expect(() => validateStartup({ NODE_ENV: 'development' })).toThrow(/POSTGRES_URL/);
  });

  it('throws when NODE_ENV is missing', () => {
    expect(() => validateStartup({ POSTGRES_URL: 'postgresql://x' })).toThrow(/NODE_ENV/);
  });
});

describe('validateStartup — SKIP_ENV_VALIDATION', () => {
  it('short-circuits when SKIP_ENV_VALIDATION=true regardless of missing vars', () => {
    expect(() => validateStartup({ SKIP_ENV_VALIDATION: 'true' } as EnvMap)).not.toThrow();
  });

  it('does not short-circuit for other truthy values', () => {
    expect(() => validateStartup({ SKIP_ENV_VALIDATION: '1' } as EnvMap)).toThrow(/POSTGRES_URL/);
  });
});

describe('validateStartup — development mode', () => {
  it('passes with just POSTGRES_URL + NODE_ENV=development', () => {
    expect(() =>
      validateStartup({ NODE_ENV: 'development', POSTGRES_URL: 'postgresql://x' }),
    ).not.toThrow();
  });

  it('does not enforce prod-required vars in development', () => {
    expect(() =>
      validateStartup({
        NODE_ENV: 'development',
        POSTGRES_URL: 'postgresql://x',
      }),
    ).not.toThrow();
  });
});

describe('validateStartup — production presence', () => {
  it('throws when any prod-required var is missing', () => {
    const env = validProdEnv();
    delete env.REVEALUI_ALERT_EMAIL;
    expect(() => validateStartup(env)).toThrow(/REVEALUI_ALERT_EMAIL/);
  });

  it('names all missing prod vars in the error', () => {
    const env = validProdEnv();
    delete env.REVEALUI_ALERT_EMAIL;
    delete env.REVEALUI_CRON_SECRET;
    expect(() => validateStartup(env)).toThrow(
      /REVEALUI_ALERT_EMAIL.*REVEALUI_CRON_SECRET|REVEALUI_CRON_SECRET.*REVEALUI_ALERT_EMAIL/,
    );
  });
});

describe('validateStartup — production format checks (live mode)', () => {
  it('rejects STRIPE_SECRET_KEY without sk_live_ prefix', () => {
    expect(() => validateStartup(validLiveProdEnv({ STRIPE_SECRET_KEY: 'sk_test_abc' }))).toThrow(
      /sk_live_/,
    );
  });

  it('rejects STRIPE_WEBHOOK_SECRET without whsec_ prefix', () => {
    expect(() => validateStartup(validLiveProdEnv({ STRIPE_WEBHOOK_SECRET: 'abc' }))).toThrow(
      /whsec_/,
    );
  });

  it('rejects non-HTTPS REVEALUI_PUBLIC_SERVER_URL', () => {
    expect(() =>
      validateStartup(
        validLiveProdEnv({
          REVEALUI_PUBLIC_SERVER_URL: 'http://app.revealui.com',
          NEXT_PUBLIC_SERVER_URL: 'http://app.revealui.com',
        }),
      ),
    ).toThrow(/HTTPS/);
  });

  it('rejects mismatched REVEALUI_PUBLIC_SERVER_URL and NEXT_PUBLIC_SERVER_URL', () => {
    expect(() =>
      validateStartup(
        validLiveProdEnv({
          REVEALUI_PUBLIC_SERVER_URL: 'https://a.example.com',
          NEXT_PUBLIC_SERVER_URL: 'https://b.example.com',
        }),
      ),
    ).toThrow();
  });

  it('rejects REVEALUI_KEK shorter than 64 hex chars', () => {
    expect(() => validateStartup(validLiveProdEnv({ REVEALUI_KEK: 'a'.repeat(63) }))).toThrow();
  });

  it('rejects REVEALUI_ALERT_EMAIL without an @', () => {
    expect(() => validateStartup(validLiveProdEnv({ REVEALUI_ALERT_EMAIL: 'notanemail' }))).toThrow(
      /REVEALUI_ALERT_EMAIL/,
    );
  });

  it('rejects REVEALUI_CRON_SECRET shorter than 32 chars', () => {
    expect(() => validateStartup(validLiveProdEnv({ REVEALUI_CRON_SECRET: 'short' }))).toThrow(
      /REVEALUI_CRON_SECRET/,
    );
  });

  it('rejects CORS_ORIGIN containing an http:// origin', () => {
    expect(() =>
      validateStartup(
        validLiveProdEnv({ CORS_ORIGIN: 'https://a.example.com,http://b.example.com' }),
      ),
    ).toThrow(/CORS_ORIGIN/);
  });

  it('accepts a fully valid live-mode production environment', () => {
    expect(() => validateStartup(validLiveProdEnv())).not.toThrow();
  });

  it('does NOT emit the test-mode warning when STRIPE_LIVE_MODE=true', () => {
    const warnSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    validateStartup(validLiveProdEnv());
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('rejects pk_test_ when STRIPE_LIVE_MODE=true and publishable key is set', () => {
    expect(() =>
      validateStartup(validLiveProdEnv({ NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_xxxx' })),
    ).toThrow(/pk_live_/);
  });

  it('accepts pk_live_ when STRIPE_LIVE_MODE=true and publishable key is set', () => {
    expect(() =>
      validateStartup(validLiveProdEnv({ NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_live_xxxx' })),
    ).not.toThrow();
  });
});

describe('validateStartup — STRIPE_LIVE_MODE toggle (test-mode pre-launch)', () => {
  it('accepts a fully valid test-mode production environment', () => {
    // Suppress the warning banner so vitest output stays clean.
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    expect(() => validateStartup(validTestProdEnv())).not.toThrow();
  });

  it('emits a loud warning banner when STRIPE_LIVE_MODE is unset', () => {
    const warnSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    validateStartup(validTestProdEnv());
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [message] = warnSpy.mock.calls[0] ?? [''];
    expect(String(message)).toMatch(/STRIPE TEST MODE/i);
    expect(String(message)).toMatch(/GAP-124/);
  });

  it('emits the warning banner when STRIPE_LIVE_MODE is the literal string "false"', () => {
    const warnSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    validateStartup(validTestProdEnv({ STRIPE_LIVE_MODE: 'false' }));
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('rejects sk_live_ keys when STRIPE_LIVE_MODE is unset', () => {
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    expect(() =>
      validateStartup(validTestProdEnv({ STRIPE_SECRET_KEY: 'sk_live_realmoney' })),
    ).toThrow(/sk_test_/);
  });

  it('rejects pk_live_ keys when STRIPE_LIVE_MODE is unset and publishable key is set', () => {
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    expect(() =>
      validateStartup(
        validTestProdEnv({ NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_live_realmoney' }),
      ),
    ).toThrow(/pk_test_/);
  });

  it('rejects empty STRIPE_SECRET_KEY in test mode (presence still required)', () => {
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const env = validTestProdEnv();
    delete env.STRIPE_SECRET_KEY;
    expect(() => validateStartup(env)).toThrow(/STRIPE_SECRET_KEY/);
  });

  it('still requires whsec_ prefix for STRIPE_WEBHOOK_SECRET in test mode', () => {
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    expect(() =>
      validateStartup(validTestProdEnv({ STRIPE_WEBHOOK_SECRET: 'not-a-webhook-secret' })),
    ).toThrow(/whsec_/);
  });

  it('still enforces non-Stripe production format rules in test mode', () => {
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    expect(() => validateStartup(validTestProdEnv({ REVEALUI_CRON_SECRET: 'short' }))).toThrow(
      /REVEALUI_CRON_SECRET/,
    );
  });

  it('treats any non-"true" value as test mode (e.g., "1", "yes", " true ")', () => {
    const warnSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    validateStartup(validTestProdEnv({ STRIPE_LIVE_MODE: '1' }));
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});
