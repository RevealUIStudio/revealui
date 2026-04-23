import { describe, expect, it } from 'vitest';
import { type EnvMap, validateStartup } from '../validate-startup.js';

const HEX_64 = 'a'.repeat(64);
const SECRET_32 = 'x'.repeat(32);
const CRON_32 = 'c'.repeat(32);
const HTTPS_URL = 'https://app.revealui.com';

function validProdEnv(overrides: EnvMap = {}): EnvMap {
  return {
    NODE_ENV: 'production',
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

describe('validateStartup — production format checks', () => {
  it('rejects STRIPE_SECRET_KEY without sk_live_ prefix', () => {
    expect(() => validateStartup(validProdEnv({ STRIPE_SECRET_KEY: 'sk_test_abc' }))).toThrow(
      /sk_live_/,
    );
  });

  it('rejects STRIPE_WEBHOOK_SECRET without whsec_ prefix', () => {
    expect(() => validateStartup(validProdEnv({ STRIPE_WEBHOOK_SECRET: 'abc' }))).toThrow(/whsec_/);
  });

  it('rejects non-HTTPS REVEALUI_PUBLIC_SERVER_URL', () => {
    expect(() =>
      validateStartup(
        validProdEnv({
          REVEALUI_PUBLIC_SERVER_URL: 'http://app.revealui.com',
          NEXT_PUBLIC_SERVER_URL: 'http://app.revealui.com',
        }),
      ),
    ).toThrow(/HTTPS/);
  });

  it('rejects mismatched REVEALUI_PUBLIC_SERVER_URL and NEXT_PUBLIC_SERVER_URL', () => {
    expect(() =>
      validateStartup(
        validProdEnv({
          REVEALUI_PUBLIC_SERVER_URL: 'https://a.example.com',
          NEXT_PUBLIC_SERVER_URL: 'https://b.example.com',
        }),
      ),
    ).toThrow();
  });

  it('rejects REVEALUI_KEK shorter than 64 hex chars', () => {
    expect(() => validateStartup(validProdEnv({ REVEALUI_KEK: 'a'.repeat(63) }))).toThrow();
  });

  it('rejects REVEALUI_ALERT_EMAIL without an @', () => {
    expect(() => validateStartup(validProdEnv({ REVEALUI_ALERT_EMAIL: 'notanemail' }))).toThrow(
      /REVEALUI_ALERT_EMAIL/,
    );
  });

  it('rejects REVEALUI_CRON_SECRET shorter than 32 chars', () => {
    expect(() => validateStartup(validProdEnv({ REVEALUI_CRON_SECRET: 'short' }))).toThrow(
      /REVEALUI_CRON_SECRET/,
    );
  });

  it('rejects CORS_ORIGIN containing an http:// origin', () => {
    expect(() =>
      validateStartup(validProdEnv({ CORS_ORIGIN: 'https://a.example.com,http://b.example.com' })),
    ).toThrow(/CORS_ORIGIN/);
  });

  it('accepts a fully valid production environment', () => {
    expect(() => validateStartup(validProdEnv())).not.toThrow();
  });
});
