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

// =========================================================================
// Wizard env vars (Studio installer prerequisite)
// =========================================================================

describe('envSchema  -  wizard env vars', () => {
  describe('REVEALUI_KEK', () => {
    it('accepts a valid 64-char lowercase hex string', () => {
      const result = envSchema.safeParse(makeValidEnv({ REVEALUI_KEK: 'ab'.repeat(32) }));
      expect(result.success).toBe(true);
    });

    it('accepts uppercase hex', () => {
      const result = envSchema.safeParse(makeValidEnv({ REVEALUI_KEK: 'AB'.repeat(32) }));
      expect(result.success).toBe(true);
    });

    it('rejects a 63-char hex string', () => {
      const result = envSchema.safeParse(makeValidEnv({ REVEALUI_KEK: 'a'.repeat(63) }));
      expect(result.success).toBe(false);
    });

    it('rejects non-hex characters', () => {
      const result = envSchema.safeParse(makeValidEnv({ REVEALUI_KEK: 'g'.repeat(64) }));
      expect(result.success).toBe(false);
    });

    it('is optional', () => {
      const result = envSchema.safeParse(makeValidEnv());
      expect(result.success).toBe(true);
    });
  });

  describe('REVEALUI_CRON_SECRET', () => {
    it('accepts a string >= 32 chars', () => {
      const result = envSchema.safeParse(makeValidEnv({ REVEALUI_CRON_SECRET: 'x'.repeat(32) }));
      expect(result.success).toBe(true);
    });

    it('rejects a string < 32 chars', () => {
      const result = envSchema.safeParse(makeValidEnv({ REVEALUI_CRON_SECRET: 'x'.repeat(31) }));
      expect(result.success).toBe(false);
    });

    it('is optional', () => {
      const result = envSchema.safeParse(makeValidEnv());
      expect(result.success).toBe(true);
    });
  });

  describe('license key signing', () => {
    it('accepts REVEALUI_LICENSE_PRIVATE_KEY', () => {
      const result = envSchema.safeParse(
        makeValidEnv({
          REVEALUI_LICENSE_PRIVATE_KEY:
            '-----BEGIN RSA PRIVATE KEY-----\nfake\n-----END RSA PRIVATE KEY-----',
        }),
      );
      expect(result.success).toBe(true);
    });

    it('accepts REVEALUI_LICENSE_PUBLIC_KEY', () => {
      const result = envSchema.safeParse(
        makeValidEnv({
          REVEALUI_LICENSE_PUBLIC_KEY: '-----BEGIN PUBLIC KEY-----\nfake\n-----END PUBLIC KEY-----',
        }),
      );
      expect(result.success).toBe(true);
    });

    it('both are optional', () => {
      const result = envSchema.safeParse(makeValidEnv());
      expect(result.success).toBe(true);
    });
  });

  describe('email provider  -  Gmail', () => {
    it('accepts EMAIL_REPLY_TO', () => {
      const result = envSchema.safeParse(makeValidEnv({ EMAIL_REPLY_TO: 'support@example.com' }));
      expect(result.success).toBe(true);
    });

    it('email fields are optional', () => {
      const result = envSchema.safeParse(makeValidEnv());
      expect(result.success).toBe(true);
    });
  });
});
