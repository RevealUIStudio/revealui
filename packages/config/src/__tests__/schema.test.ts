import { describe, expect, it } from 'vitest';
import { envSchema, validateEnvironment } from '../schema';

const testRevealuiSecret = `revealui-test-${'x'.repeat(32)}`;

function makeValidEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    REVEALUI_SECRET: testRevealuiSecret,
    REVEALUI_PUBLIC_SERVER_URL: 'http://localhost:4000',
    NEXT_PUBLIC_SERVER_URL: 'http://localhost:4000',
    POSTGRES_URL: 'postgresql://user:pass@localhost:5432/db',
    ...overrides,
  };
}

describe('envSchema', () => {
  it('parses a minimal valid environment', () => {
    const result = envSchema.parse(makeValidEnv());

    expect(result.REVEALUI_SECRET).toBe(testRevealuiSecret);
    expect(result.POSTGRES_URL).toBe('postgresql://user:pass@localhost:5432/db');
  });

  it('accepts optional branding and feature-gating fields with valid formats', () => {
    const result = envSchema.parse(
      makeValidEnv({
        REVEALUI_BRAND_PRIMARY_COLOR: '#ea580c',
        REVEALUI_SHOW_POWERED_BY: 'false',
        REVEALUI_SIGNUP_OPEN: 'true',
        STRIPE_PROXY: '1',
        SKIP_ONINIT: 'false',
      }),
    );

    expect(result.REVEALUI_BRAND_PRIMARY_COLOR).toBe('#ea580c');
    expect(result.REVEALUI_SHOW_POWERED_BY).toBe('false');
    expect(result.REVEALUI_SIGNUP_OPEN).toBe('true');
    expect(result.STRIPE_PROXY).toBe('1');
    expect(result.SKIP_ONINIT).toBe('false');
  });

  it('rejects invalid optional field formats', () => {
    expect(() =>
      envSchema.parse(
        makeValidEnv({
          REVEALUI_BRAND_PRIMARY_COLOR: 'orange',
        }),
      ),
    ).toThrow(/hex color/i);

    expect(() =>
      envSchema.parse(
        makeValidEnv({
          REVEALUI_ADMIN_EMAIL: 'not-an-email',
        }),
      ),
    ).toThrow();

    expect(() =>
      envSchema.parse(
        makeValidEnv({
          DATABASE_URL: 'mysql://user:pass@localhost/db',
        }),
      ),
    ).toThrow(/PostgreSQL/i);
  });
});

describe('validateEnvironment', () => {
  it('returns no errors for a healthy development config', () => {
    const result = validateEnvironment(
      makeValidEnv({
        STRIPE_SECRET_KEY: 'sk_test_123',
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_123',
      }),
      'development',
    );

    expect(result).toEqual({
      valid: true,
      errors: [],
    });
  });

  it('flags production-only URL and Stripe issues', () => {
    const result = validateEnvironment(
      makeValidEnv({
        REVEALUI_PUBLIC_SERVER_URL: 'http://app.example.com',
        NEXT_PUBLIC_SERVER_URL: 'http://app.example.com',
        STRIPE_SECRET_KEY: 'sk_test_123',
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_123',
      }),
      'production',
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('REVEALUI_PUBLIC_SERVER_URL must use HTTPS in production');
    expect(result.errors).toContain('NEXT_PUBLIC_SERVER_URL must use HTTPS in production');
    expect(result.errors).toContain(
      'STRIPE_SECRET_KEY must be a live key (sk_live_...) in production',
    );
    expect(result.errors).toContain(
      'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY must be a live key (pk_live_...) in production',
    );
  });

  it('flags live Stripe keys in development and mismatched server URLs', () => {
    const result = validateEnvironment(
      makeValidEnv({
        REVEALUI_PUBLIC_SERVER_URL: 'http://localhost:4000',
        NEXT_PUBLIC_SERVER_URL: 'http://localhost:3000',
        STRIPE_SECRET_KEY: 'sk_live_123',
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_live_123',
      }),
      'development',
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'STRIPE_SECRET_KEY should use test key (sk_test_...) in development',
    );
    expect(result.errors).toContain(
      'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY should use test key (pk_test_...) in development',
    );
    expect(result.errors).toContain(
      'REVEALUI_PUBLIC_SERVER_URL and NEXT_PUBLIC_SERVER_URL should match',
    );
  });

  it('treats an empty nodeEnv as development for Stripe key checks', () => {
    const result = validateEnvironment(
      makeValidEnv({
        STRIPE_SECRET_KEY: 'sk_live_123',
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_live_123',
      }),
      '',
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'STRIPE_SECRET_KEY should use test key (sk_test_...) in development',
    );
    expect(result.errors).toContain(
      'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY should use test key (pk_test_...) in development',
    );
  });
});
