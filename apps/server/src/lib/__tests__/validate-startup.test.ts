import { generateKeyPairSync } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type EnvMap, validateStartup } from '../validate-startup.js';

const HEX_64 = 'a'.repeat(64);
const SECRET_32 = 'x'.repeat(32);
const CRON_32 = 'c'.repeat(32);
const HTTPS_URL = 'https://app.revealui.com';

// A REAL Ed25519 PKCS#8 PEM — the GAP-355 Stage 3 boot guard parses
// REVEALUI_AUDIT_SIGNING_KEY as an actual Ed25519 key, so every production
// fixture must ship one that parses.
const AUDIT_SIGNING_KEY_PEM = generateKeyPairSync('ed25519', {
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
}).privateKey;

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
    // Governed MCP tool loopback origin (required hosted boot as of GAP-MCP-self-url)
    REVEALUI_API_URL: 'https://api.revealui.com',
    STRIPE_SECRET_KEY: 'sk_live_deadbeef',
    STRIPE_WEBHOOK_SECRET: 'whsec_deadbeef',
    REVEALUI_LICENSE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----',
    REVEALUI_CRON_SECRET: CRON_32,
    CORS_ORIGIN: 'https://app.revealui.com,https://admin.revealui.com',
    REVEALUI_ALERT_EMAIL: 'ops@revealui.com',
    SENTRY_DSN: 'https://abc123@o123456.ingest.sentry.io/456789',
    REVEALUI_BILLING_PORTAL_CONFIG_ID: 'bpc_test_fixture',
    REVEALUI_AUDIT_SIGNING_KEY: AUDIT_SIGNING_KEY_PEM,
    GOOGLE_SERVICE_ACCOUNT_EMAIL: 'svc@project.iam.gserviceaccount.com',
    GOOGLE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----',
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
  it('throws when neither POSTGRES_URL nor DATABASE_URL is set', () => {
    expect(() => validateStartup({ NODE_ENV: 'development' })).toThrow(
      /POSTGRES_URL or DATABASE_URL/,
    );
  });

  it('passes when only POSTGRES_URL is set (legacy/Vercel-default name)', () => {
    expect(() =>
      validateStartup({ NODE_ENV: 'development', POSTGRES_URL: 'postgresql://x' }),
    ).not.toThrow();
  });

  it('passes when only DATABASE_URL is set (Neon-driver-aliased name)', () => {
    expect(() =>
      validateStartup({ NODE_ENV: 'development', DATABASE_URL: 'postgresql://x' }),
    ).not.toThrow();
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
    expect(() => validateStartup({ SKIP_ENV_VALIDATION: '1' } as EnvMap)).toThrow(
      /POSTGRES_URL or DATABASE_URL/,
    );
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

  it('rejects missing SENTRY_DSN in production hosted env', () => {
    const env = validLiveProdEnv();
    delete env.SENTRY_DSN;
    expect(() => validateStartup(env)).toThrow(/SENTRY_DSN/);
  });

  it('rejects missing Gmail email transport vars in production hosted env', () => {
    const env = validLiveProdEnv();
    delete env.GOOGLE_PRIVATE_KEY;
    expect(() => validateStartup(env)).toThrow(/GOOGLE_PRIVATE_KEY/);
  });
});

describe('validateStartup — audit signing key (GAP-355 Stage 3, both modes)', () => {
  it('rejects a missing REVEALUI_AUDIT_SIGNING_KEY (no REVEALUI_SECRET fallback)', () => {
    const env = validLiveProdEnv();
    delete env.REVEALUI_AUDIT_SIGNING_KEY;
    expect(() => validateStartup(env)).toThrow('REVEALUI_AUDIT_SIGNING_KEY');
  });

  it('accepts a single-line \\n-escaped Ed25519 key (env_file transport, #2164 review)', () => {
    // The kit's docker/.env carries the PEM one-line with literal \n escapes;
    // the format check must read the SAME normalized value the signer does,
    // or a valid kit key fails boot blaming the key instead of the transport.
    const env = validLiveProdEnv();
    const escaped = (env.REVEALUI_AUDIT_SIGNING_KEY as string).split('\n').join('\\n');
    expect(() =>
      validateStartup(validLiveProdEnv({ REVEALUI_AUDIT_SIGNING_KEY: escaped })),
    ).not.toThrow();
  });

  it('rejects a REVEALUI_AUDIT_SIGNING_KEY that is not a valid Ed25519 key', () => {
    expect(() =>
      validateStartup(validLiveProdEnv({ REVEALUI_AUDIT_SIGNING_KEY: 'not-a-pem' })),
    ).toThrow('REVEALUI_AUDIT_SIGNING_KEY');
  });

  it('rejects a valid PEM that is the wrong key type (RSA, not Ed25519)', () => {
    const rsaPem = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    }).privateKey;
    expect(() => validateStartup(validLiveProdEnv({ REVEALUI_AUDIT_SIGNING_KEY: rsaPem }))).toThrow(
      'ed25519',
    );
  });

  it('accepts a valid Ed25519 signing key', () => {
    expect(() => validateStartup(validLiveProdEnv())).not.toThrow();
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

  it('rejects STRIPE_WEBHOOK_SECRET_LIVE without whsec_ prefix when set', () => {
    expect(() =>
      validateStartup(validLiveProdEnv({ STRIPE_WEBHOOK_SECRET_LIVE: 'not-a-secret' })),
    ).toThrow('STRIPE_WEBHOOK_SECRET_LIVE');
  });

  it('accepts a valid or unset STRIPE_WEBHOOK_SECRET_LIVE', () => {
    expect(() =>
      validateStartup(validLiveProdEnv({ STRIPE_WEBHOOK_SECRET_LIVE: 'whsec_livedeadbeef' })),
    ).not.toThrow();
    expect(() =>
      validateStartup(validLiveProdEnv({ STRIPE_WEBHOOK_SECRET_LIVE: '' })),
    ).not.toThrow();
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

  it('accepts a valid REVEALUI_KEK_NEXT during dual-key rotation', () => {
    expect(() =>
      validateStartup(validLiveProdEnv({ REVEALUI_KEK_NEXT: 'b'.repeat(64) })),
    ).not.toThrow();
  });

  it('rejects REVEALUI_KEK_NEXT with wrong length', () => {
    expect(() => validateStartup(validLiveProdEnv({ REVEALUI_KEK_NEXT: 'b'.repeat(63) }))).toThrow(
      /REVEALUI_KEK_NEXT must be exactly 64 hexadecimal characters/,
    );
  });

  it('treats empty REVEALUI_KEK_NEXT as unset (steady state, no fallback)', () => {
    expect(() => validateStartup(validLiveProdEnv({ REVEALUI_KEK_NEXT: '' }))).not.toThrow();
  });

  it('rejects REVEALUI_ALERT_EMAIL without an @', () => {
    expect(() => validateStartup(validLiveProdEnv({ REVEALUI_ALERT_EMAIL: 'notanemail' }))).toThrow(
      /REVEALUI_ALERT_EMAIL/,
    );
  });

  it('rejects malformed SENTRY_DSN (no :// scheme separator)', () => {
    expect(() => validateStartup(validLiveProdEnv({ SENTRY_DSN: 'not-a-dsn' }))).toThrow(
      /SENTRY_DSN/,
    );
  });

  it('rejects REVEALUI_CRON_SECRET shorter than 32 chars', () => {
    expect(() => validateStartup(validLiveProdEnv({ REVEALUI_CRON_SECRET: 'short' }))).toThrow(
      /REVEALUI_CRON_SECRET/,
    );
  });

  it('throws when SENTRY_DSN is missing in hosted production (J-P0-1)', () => {
    const env = validLiveProdEnv();
    delete env.SENTRY_DSN;
    expect(() => validateStartup(env)).toThrow(/SENTRY_DSN/);
  });

  it('rejects SENTRY_DSN that is not a valid HTTPS URL', () => {
    expect(() => validateStartup(validLiveProdEnv({ SENTRY_DSN: 'not-a-url' }))).toThrow(
      /SENTRY_DSN/,
    );
  });

  it('rejects SENTRY_DSN with http:// (must be https)', () => {
    expect(() =>
      validateStartup(validLiveProdEnv({ SENTRY_DSN: 'http://abc@o123.ingest.sentry.io/456' })),
    ).toThrow(/SENTRY_DSN/);
  });

  it('accepts a well-formed Sentry DSN', () => {
    expect(() =>
      validateStartup(
        validLiveProdEnv({ SENTRY_DSN: 'https://abc123@o123456.ingest.sentry.io/456789' }),
      ),
    ).not.toThrow();
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

  it('rejects hosted production without REVEALUI_API_URL (MCP loopback)', () => {
    const env = validLiveProdEnv();
    delete env.REVEALUI_API_URL;
    expect(() => validateStartup(env)).toThrow(/REVEALUI_API_URL/);
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

// ─── validateLicenseAtStartup (Forge boot-time enforcement) ─────────────
import { generateLicenseKey } from '@revealui/core/license';
import { beforeAll } from 'vitest';
import { validateLicenseAtStartup } from '../validate-startup.js';

let testPrivateKey: string;
let testPublicKey: string;
let mismatchedPublicKey: string;

beforeAll(() => {
  const pair = generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  testPrivateKey = pair.privateKey;
  testPublicKey = pair.publicKey;

  // Second keypair to test signature mismatch detection.
  const otherPair = generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  mismatchedPublicKey = otherPair.publicKey;
});

describe('validateLicenseAtStartup', () => {
  it('is a no-op when SKIP_ENV_VALIDATION=true', async () => {
    await expect(
      validateLicenseAtStartup({ SKIP_ENV_VALIDATION: 'true' }),
    ).resolves.toBeUndefined();
  });

  it('is a no-op in hosted mode (REVEALUI_LICENSE_PRIVATE_KEY present)', async () => {
    // Hosted SaaS deployment has the signing key — license enforcement
    // is DB-driven via account_entitlements, not boot-time.
    await expect(
      validateLicenseAtStartup({
        REVEALUI_LICENSE_PRIVATE_KEY: 'any-non-empty-value',
        // Even with KEY/PUBLIC_KEY missing, hosted mode skips the check.
      }),
    ).resolves.toBeUndefined();
  });

  it('throws in Forge mode when REVEALUI_LICENSE_KEY is missing', async () => {
    await expect(
      validateLicenseAtStartup({
        REVEALUI_LICENSE_PUBLIC_KEY: testPublicKey,
        // No REVEALUI_LICENSE_PRIVATE_KEY → Forge mode
        // No REVEALUI_LICENSE_KEY → should throw
      }),
    ).rejects.toThrow(/REVEALUI_LICENSE_KEY is required for RevForge/);
  });

  it('throws in Forge mode when REVEALUI_LICENSE_PUBLIC_KEY is missing', async () => {
    await expect(
      validateLicenseAtStartup({
        REVEALUI_LICENSE_KEY: 'doesnt-matter-no-pubkey-to-verify',
      }),
    ).rejects.toThrow(/REVEALUI_LICENSE_PUBLIC_KEY is required for RevForge/);
  });

  it('throws when the JWT is malformed', async () => {
    await expect(
      validateLicenseAtStartup({
        REVEALUI_LICENSE_KEY: 'not.a.valid.jwt',
        REVEALUI_LICENSE_PUBLIC_KEY: testPublicKey,
      }),
    ).rejects.toThrow(/REVEALUI_LICENSE_KEY is invalid/);
  });

  it('throws a precise wrong-public-key error when the JWT was signed with a different key', async () => {
    const jwt = await generateLicenseKey(
      { tier: 'enterprise', customerId: 'acme' },
      testPrivateKey,
      30 * 24 * 60 * 60,
      testPublicKey,
    );
    // Verify against a DIFFERENT public key: the kit baked the wrong key. The
    // boot check should name this specific cause (public-key id mismatch), not
    // the generic invalid/expired/customerId message.
    const err = await validateLicenseAtStartup({
      REVEALUI_LICENSE_KEY: jwt,
      REVEALUI_LICENSE_PUBLIC_KEY: mismatchedPublicKey,
    }).then(
      () => null,
      (e: unknown) => (e instanceof Error ? e.message : String(e)),
    );
    expect(err).toContain('does not match the key that signed');
    expect(err).toContain('baked the wrong public key');
  });

  it('throws when the JWT is expired beyond the grace window', async () => {
    // Generate a JWT that expired 30 days ago — well past the default
    // 3-day subscription grace.
    const jwt = await generateLicenseKey(
      { tier: 'pro', customerId: 'expired-co' },
      testPrivateKey,
      -30 * 24 * 60 * 60, // negative seconds → already expired
      testPublicKey,
    );
    await expect(
      validateLicenseAtStartup({
        REVEALUI_LICENSE_KEY: jwt,
        REVEALUI_LICENSE_PUBLIC_KEY: testPublicKey,
      }),
    ).rejects.toThrow(/REVEALUI_LICENSE_KEY is invalid/);
  });

  it('passes for a valid Forge license JWT', async () => {
    const jwt = await generateLicenseKey(
      { tier: 'enterprise', customerId: 'acme' },
      testPrivateKey,
      30 * 24 * 60 * 60,
      testPublicKey,
    );
    await expect(
      validateLicenseAtStartup({
        REVEALUI_LICENSE_KEY: jwt,
        REVEALUI_LICENSE_PUBLIC_KEY: testPublicKey,
      }),
    ).resolves.toBeUndefined();
  });

  it('handles single-line PEM public key (with literal \\n separators)', async () => {
    const jwt = await generateLicenseKey(
      { tier: 'pro', customerId: 'docker-co' },
      testPrivateKey,
      30 * 24 * 60 * 60,
      testPublicKey,
    );
    // Simulate the .env-encoded form that stamp.sh writes.
    const singleLinePublicKey = testPublicKey.replace(/\n/g, '\\n');
    await expect(
      validateLicenseAtStartup({
        REVEALUI_LICENSE_KEY: jwt,
        REVEALUI_LICENSE_PUBLIC_KEY: singleLinePublicKey,
      }),
    ).resolves.toBeUndefined();
  });

  // ── JWT-derived domain binding (the boot-time half of the domain-lock) ──
  it('passes when the licensed domain covers REVEALUI_PUBLIC_SERVER_URL host', async () => {
    const jwt = await generateLicenseKey(
      { tier: 'enterprise', customerId: 'acme', domains: ['acme.com'] },
      testPrivateKey,
      30 * 24 * 60 * 60,
      testPublicKey,
    );
    await expect(
      validateLicenseAtStartup({
        REVEALUI_LICENSE_KEY: jwt,
        REVEALUI_LICENSE_PUBLIC_KEY: testPublicKey,
        REVEALUI_PUBLIC_SERVER_URL: 'https://admin.acme.com',
      }),
    ).resolves.toBeUndefined();
  });

  it('throws when the licensed domain does NOT cover REVEALUI_PUBLIC_SERVER_URL host', async () => {
    const jwt = await generateLicenseKey(
      { tier: 'enterprise', customerId: 'acme', domains: ['acme.com'] },
      testPrivateKey,
      30 * 24 * 60 * 60,
      testPublicKey,
    );
    await expect(
      validateLicenseAtStartup({
        REVEALUI_LICENSE_KEY: jwt,
        REVEALUI_LICENSE_PUBLIC_KEY: testPublicKey,
        REVEALUI_PUBLIC_SERVER_URL: 'https://evil.com',
      }),
    ).rejects.toThrow(/restricted to/);
  });

  it('allows a localhost public URL under a domain-restricted license (trial-kit default)', async () => {
    const jwt = await generateLicenseKey(
      { tier: 'enterprise', customerId: 'acme', domains: ['acme.com'] },
      testPrivateKey,
      30 * 24 * 60 * 60,
      testPublicKey,
    );
    await expect(
      validateLicenseAtStartup({
        REVEALUI_LICENSE_KEY: jwt,
        REVEALUI_LICENSE_PUBLIC_KEY: testPublicKey,
        REVEALUI_PUBLIC_SERVER_URL: 'http://localhost:4000',
      }),
    ).resolves.toBeUndefined();
  });

  it('skips the domain check when no public URL is set (presence enforced by validateStartup)', async () => {
    const jwt = await generateLicenseKey(
      { tier: 'enterprise', customerId: 'acme', domains: ['acme.com'] },
      testPrivateKey,
      30 * 24 * 60 * 60,
      testPublicKey,
    );
    await expect(
      validateLicenseAtStartup({
        REVEALUI_LICENSE_KEY: jwt,
        REVEALUI_LICENSE_PUBLIC_KEY: testPublicKey,
      }),
    ).resolves.toBeUndefined();
  });
});

// ─── Forge mode (validateStartup) ──────────────────────────────────────
import { detectDeploymentMode } from '../validate-startup.js';

/**
 * Forge customer production fixture. NO REVEALUI_LICENSE_PRIVATE_KEY —
 * that's the signal that triggers forge-mode validation. Includes the
 * vars a stamped Forge kit ships with after revvault-bootstrap.sh.
 */
function validForgeProdEnv(overrides: EnvMap = {}): EnvMap {
  return {
    NODE_ENV: 'production',
    POSTGRES_URL: 'postgresql://revealui:pw@postgres:5432/revealui',
    REVEALUI_SECRET: SECRET_32,
    // KEK is generated by forge/stamp.sh (RevealUIStudio/revforge#10) and
    // propagated through the revvault pipeline, so forge customers ship
    // with one. Required in REQUIRED_IN_PRODUCTION_FORGE.
    REVEALUI_KEK: HEX_64,
    // Forge default Docker stack uses http://localhost — must NOT be
    // rejected by HTTPS-only checks.
    REVEALUI_PUBLIC_SERVER_URL: 'http://localhost:4000',
    NEXT_PUBLIC_SERVER_URL: 'http://localhost:4000',
    REVEALUI_LICENSE_KEY: 'eyJhbGc.eyJ.fake-jwt-presence-check-only',
    REVEALUI_LICENSE_PUBLIC_KEY: '-----BEGIN PUBLIC KEY-----\\nFAKE\\n-----END PUBLIC KEY-----',
    CORS_ORIGIN: 'http://localhost:4000',
    // Self-hosted deployments sign audit rows too (GAP-355 Stage 3, ADR §2b).
    REVEALUI_AUDIT_SIGNING_KEY: AUDIT_SIGNING_KEY_PEM,
    ...overrides,
  };
}

describe('detectDeploymentMode', () => {
  it('returns "hosted" when REVEALUI_LICENSE_PRIVATE_KEY is set', () => {
    expect(detectDeploymentMode({ REVEALUI_LICENSE_PRIVATE_KEY: 'any-value' })).toBe('hosted');
  });

  it('returns "forge" when REVEALUI_LICENSE_PRIVATE_KEY is absent', () => {
    expect(detectDeploymentMode({})).toBe('forge');
    expect(detectDeploymentMode({ REVEALUI_LICENSE_KEY: 'jwt' })).toBe('forge');
  });

  it('returns "forge" for empty-string private key (treated as unset)', () => {
    expect(detectDeploymentMode({ REVEALUI_LICENSE_PRIVATE_KEY: '' })).toBe('forge');
  });

  it('returns "hosted" when REVEALUI_DEPLOYMENT_MODE=hosted without private key (GAP-260 P4-1)', () => {
    expect(detectDeploymentMode({ REVEALUI_DEPLOYMENT_MODE: 'hosted' })).toBe('hosted');
  });
});

describe('validateStartup — hosted MODE without private key', () => {
  it('accepts production hosted with MODE=hosted and no private key', () => {
    const env = {
      ...validLiveProdEnv(),
      REVEALUI_DEPLOYMENT_MODE: 'hosted',
    };
    delete env.REVEALUI_LICENSE_PRIVATE_KEY;
    expect(() => validateStartup(env)).not.toThrow();
  });

  it('rejects MODE=forge when private key is present', () => {
    const env = {
      ...validLiveProdEnv(),
      REVEALUI_DEPLOYMENT_MODE: 'forge',
    };
    expect(() => validateStartup(env)).toThrow(/MODE=forge/);
  });
});

describe('validateStartup — forge mode', () => {
  it('accepts a fully valid forge-mode production environment', () => {
    expect(() => validateStartup(validForgeProdEnv())).not.toThrow();
  });

  it('does NOT require Stripe vars in forge mode', () => {
    // No STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.
    expect(() => validateStartup(validForgeProdEnv())).not.toThrow();
  });

  it('does NOT require REVEALUI_CRON_SECRET in forge mode', () => {
    expect(() => validateStartup(validForgeProdEnv())).not.toThrow();
  });

  it('does NOT require REVEALUI_ALERT_EMAIL in forge mode', () => {
    expect(() => validateStartup(validForgeProdEnv())).not.toThrow();
  });

  it('does NOT require SENTRY_DSN in forge mode', () => {
    expect(() => validateStartup(validForgeProdEnv())).not.toThrow();
  });

  it('does NOT enforce HTTPS on REVEALUI_PUBLIC_SERVER_URL in forge mode', () => {
    // Forge default stack uses http://localhost — must not throw.
    expect(() =>
      validateStartup(validForgeProdEnv({ REVEALUI_PUBLIC_SERVER_URL: 'http://localhost:4000' })),
    ).not.toThrow();
  });

  it('does NOT enforce HTTPS on CORS_ORIGIN in forge mode', () => {
    expect(() =>
      validateStartup(validForgeProdEnv({ CORS_ORIGIN: 'http://localhost:4000' })),
    ).not.toThrow();
  });

  it('does NOT emit the Stripe test-mode warning in forge mode', () => {
    const warnSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    validateStartup(validForgeProdEnv());
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('throws when REVEALUI_LICENSE_KEY is missing in forge mode', () => {
    const env = validForgeProdEnv();
    delete env.REVEALUI_LICENSE_KEY;
    expect(() => validateStartup(env)).toThrow(/forge mode.*REVEALUI_LICENSE_KEY/);
  });

  it('throws when REVEALUI_LICENSE_PUBLIC_KEY is missing in forge mode', () => {
    const env = validForgeProdEnv();
    delete env.REVEALUI_LICENSE_PUBLIC_KEY;
    expect(() => validateStartup(env)).toThrow(/forge mode.*REVEALUI_LICENSE_PUBLIC_KEY/);
  });

  it('requires REVEALUI_KEK in forge mode', () => {
    // KEK is generated + propagated by forge/stamp.sh; missing it means
    // the customer's bootstrap step skipped the kek revvault path.
    const env = validForgeProdEnv();
    delete env.REVEALUI_KEK;
    expect(() => validateStartup(env)).toThrow(/forge mode.*REVEALUI_KEK/);
  });

  it('rejects a malformed REVEALUI_KEK in forge mode', () => {
    expect(() => validateStartup(validForgeProdEnv({ REVEALUI_KEK: 'a'.repeat(63) }))).toThrow(
      /REVEALUI_KEK/,
    );
  });

  it('accepts a valid 64-hex KEK in forge mode', () => {
    expect(() => validateStartup(validForgeProdEnv({ REVEALUI_KEK: HEX_64 }))).not.toThrow();
  });

  it('still enforces SECRET minimum length in forge mode', () => {
    expect(() => validateStartup(validForgeProdEnv({ REVEALUI_SECRET: 'short' }))).toThrow(
      /REVEALUI_SECRET/,
    );
  });

  it('requires REVEALUI_AUDIT_SIGNING_KEY in forge mode (self-hosted signs too)', () => {
    const env = validForgeProdEnv();
    delete env.REVEALUI_AUDIT_SIGNING_KEY;
    expect(() => validateStartup(env)).toThrow('REVEALUI_AUDIT_SIGNING_KEY');
  });

  it('rejects an invalid REVEALUI_AUDIT_SIGNING_KEY in forge mode', () => {
    expect(() =>
      validateStartup(validForgeProdEnv({ REVEALUI_AUDIT_SIGNING_KEY: 'not-a-pem' })),
    ).toThrow('REVEALUI_AUDIT_SIGNING_KEY');
  });

  it('accepts a valid Ed25519 signing key in forge mode', () => {
    expect(() => validateStartup(validForgeProdEnv())).not.toThrow();
  });

  it('still enforces URL parity when both URLs are set in forge mode', () => {
    expect(() =>
      validateStartup(
        validForgeProdEnv({
          REVEALUI_PUBLIC_SERVER_URL: 'http://localhost:4000',
          NEXT_PUBLIC_SERVER_URL: 'http://localhost:5000',
        }),
      ),
    ).toThrow(/match/);
  });

  it('does NOT require POSTGRES_URL to be HTTPS or anything special — just present', () => {
    // Forge customer's POSTGRES_URL points to the bundled postgres
    // service (postgres:5432), not an HTTPS endpoint.
    expect(() =>
      validateStartup(
        validForgeProdEnv({ POSTGRES_URL: 'postgresql://revealui:pw@postgres:5432/revealui' }),
      ),
    ).not.toThrow();
  });

  it('error messages name the deployment mode for diagnostic clarity', () => {
    const env = validForgeProdEnv();
    delete env.REVEALUI_LICENSE_KEY;
    expect(() => validateStartup(env)).toThrow(/STARTUP VALIDATION FAILED \(forge mode\)/);
  });
});

// ─── x402 activation gate (mode-agnostic) ──────────────────────

describe('validateStartup — x402 activation gate', () => {
  const validUsdcAddr = `0x${'a'.repeat(40)}`;

  beforeEach(() => {
    // Suppress unrelated banners (Stripe test-mode) so test output stays clean.
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  it('passes when X402_ENABLED is unset (default posture)', () => {
    expect(() => validateStartup(validTestProdEnv())).not.toThrow();
  });

  it('throws when X402_ENABLED=true but X402_RECEIVING_ADDRESS is missing', () => {
    expect(() => validateStartup(validTestProdEnv({ X402_ENABLED: 'true' }))).toThrow(
      /X402_RECEIVING_ADDRESS/,
    );
  });

  it('throws when X402_ENABLED=true and X402_RECEIVING_ADDRESS is malformed', () => {
    expect(() =>
      validateStartup(
        validTestProdEnv({
          X402_ENABLED: 'true',
          X402_RECEIVING_ADDRESS: 'not-a-wallet',
        }),
      ),
    ).toThrow(/0x-prefixed.*40-hex/);
  });

  it('throws on a 0x-prefixed address that is the wrong length', () => {
    expect(() =>
      validateStartup(
        validTestProdEnv({
          X402_ENABLED: 'true',
          X402_RECEIVING_ADDRESS: `0x${'a'.repeat(39)}`,
        }),
      ),
    ).toThrow(/0x-prefixed.*40-hex/);
  });

  it('accepts X402_ENABLED=true with a valid 0x40-hex EVM address', () => {
    expect(() =>
      validateStartup(
        validTestProdEnv({
          X402_ENABLED: 'true',
          X402_RECEIVING_ADDRESS: validUsdcAddr,
        }),
      ),
    ).not.toThrow();
  });

  it('treats any non-"true" value as disabled (e.g. "1", "false")', () => {
    expect(() => validateStartup(validTestProdEnv({ X402_ENABLED: '1' }))).not.toThrow();
    expect(() => validateStartup(validTestProdEnv({ X402_ENABLED: 'false' }))).not.toThrow();
  });

  it('also enforces the gate in forge mode (mode-agnostic)', () => {
    expect(() => validateStartup(validForgeProdEnv({ X402_ENABLED: 'true' }))).toThrow(
      /X402_RECEIVING_ADDRESS/,
    );
  });
});

// ─── Lenient mode (pre-deploy validation against vercel-pulled env) ───
//
// Mirrors how scripts/validate/prod-env.ts invokes validateStartup against
// a `.env.production.local` produced by `vercel pull`. Vercel-Sensitive vars
// pull as empty strings even though they're populated at runtime, so the
// validator must accept presence-by-name and skip format checks on empties
// when called in lenient mode. The runtime caller continues to use the
// strict default — empty-string env vars in process.env still represent
// real misconfig there.
describe('validateStartup — lenient mode (Vercel-Sensitive var handling)', () => {
  /**
   * Production fixture matching what `vercel pull` returns for a project
   * with every credential-shaped var marked Sensitive: each name appears,
   * each value is empty. POSTGRES_URL, NEXT_PUBLIC_SERVER_URL, and
   * REVEALUI_PUBLIC_SERVER_URL are populated as non-Sensitive (Vercel's
   * actual posture for the revealui-api project at the time this was
   * written) so URL-parity-style checks have data to operate on.
   */
  function sensitivePulledEnv(overrides: EnvMap = {}): EnvMap {
    return {
      NODE_ENV: 'production',
      POSTGRES_URL: 'postgresql://user:pw@host/db',
      REVEALUI_PUBLIC_SERVER_URL: 'https://api.revealui.com',
      NEXT_PUBLIC_SERVER_URL: 'https://api.revealui.com',
      REVEALUI_API_URL: 'https://api.revealui.com',
      CORS_ORIGIN: 'https://revealui.com',
      // Hosted-mode signals — non-empty (would be sensitive in real Vercel,
      // but their PRESENCE is what mode detection cares about; the value is
      // empty in real pulls).
      REVEALUI_LICENSE_PRIVATE_KEY: '',
      REVEALUI_SECRET: '',
      REVEALUI_KEK: '',
      REVEALUI_CRON_SECRET: '',
      REVEALUI_ALERT_EMAIL: '',
      SENTRY_DSN: '',
      STRIPE_SECRET_KEY: '',
      STRIPE_WEBHOOK_SECRET: '',
      STRIPE_LIVE_MODE: '',
      REVEALUI_BILLING_PORTAL_CONFIG_ID: '',
      GOOGLE_SERVICE_ACCOUNT_EMAIL: '',
      GOOGLE_PRIVATE_KEY: '',
      // Sensitive in real Vercel pulls (empty string) — present-by-name in
      // lenient mode, so the Ed25519 parse is deferred to runtime.
      REVEALUI_AUDIT_SIGNING_KEY: '',
      ...overrides,
    };
  }

  it('detectDeploymentMode treats empty REVEALUI_LICENSE_PRIVATE_KEY as hosted in lenient mode', () => {
    expect(detectDeploymentMode({ REVEALUI_LICENSE_PRIVATE_KEY: '' }, { lenient: true })).toBe(
      'hosted',
    );
  });

  it('detectDeploymentMode strict mode (default) treats empty REVEALUI_LICENSE_PRIVATE_KEY as forge', () => {
    // Original semantic — runtime contract is unchanged.
    expect(detectDeploymentMode({ REVEALUI_LICENSE_PRIVATE_KEY: '' })).toBe('forge');
  });

  it('always-required presence: POSTGRES_URL set as empty string passes in lenient mode', () => {
    expect(() =>
      validateStartup({ NODE_ENV: 'development', POSTGRES_URL: '' }, { lenient: true }),
    ).not.toThrow();
  });

  it('always-required presence: POSTGRES_URL set as empty string FAILS in strict mode', () => {
    // Backward-compat — preserves original runtime semantic where empty
    // string in process.env represents real misconfig.
    expect(() => validateStartup({ NODE_ENV: 'development', POSTGRES_URL: '' })).toThrow(
      /POSTGRES_URL or DATABASE_URL/,
    );
  });

  it('passes a fully-Sensitive hosted production env (every required var present-but-empty)', () => {
    expect(() => validateStartup(sensitivePulledEnv(), { lenient: true })).not.toThrow();
  });

  it('still catches missing-by-name vars in lenient mode (key absent from env entirely)', () => {
    // If a name is missing entirely (not just empty), that's still a
    // real config bug — the runtime won't have it either.
    const env = sensitivePulledEnv();
    delete env.REVEALUI_LICENSE_PRIVATE_KEY; // mode detection now sees forge
    delete env.REVEALUI_LICENSE_KEY; // forge-required, absent
    expect(() => validateStartup(env, { lenient: true })).toThrow(
      /forge mode.*REVEALUI_LICENSE_KEY/,
    );
  });

  it('skips format checks for empty values in lenient mode', () => {
    // KEK regex would normally fail on empty string; lenient skips it.
    const env = sensitivePulledEnv({ REVEALUI_KEK: '' });
    expect(() => validateStartup(env, { lenient: true })).not.toThrow();
  });

  it('still enforces format checks on non-empty values in lenient mode (defense in depth)', () => {
    // If Vercel pull DOES include a value for a sensitive var (e.g.
    // operator unset Sensitive), the format check still runs — lenient
    // only skips the empty case.
    const env = sensitivePulledEnv({ REVEALUI_KEK: 'not-64-hex' });
    expect(() => validateStartup(env, { lenient: true })).toThrow(
      /REVEALUI_KEK must be exactly 64/,
    );
  });

  it('still enforces non-HTTPS rejection on populated CORS_ORIGIN in lenient mode', () => {
    const env = sensitivePulledEnv({ CORS_ORIGIN: 'http://example.com' });
    expect(() => validateStartup(env, { lenient: true })).toThrow(
      /CORS_ORIGIN must contain only HTTPS/,
    );
  });
});

// ─── validateBillingCatalogAtStartup ────────────────────────────────────
import {
  type BillingCatalogRow,
  EXPECTED_LIVE_PLAN_IDS_FOR_TEST,
  validateBillingCatalogAtStartup,
} from '../validate-startup.js';

/**
 * Full row set every expected plan with a populated stripe_price_id.
 * Tests use this as the happy-path baseline and remove/null specific
 * rows to exercise failure modes.
 */
function fullCatalogRows(): BillingCatalogRow[] {
  return EXPECTED_LIVE_PLAN_IDS_FOR_TEST.map((planId, i) => ({
    planId,
    stripePriceId: `price_test_${i}`,
  }));
}

describe('validateBillingCatalogAtStartup — short-circuits', () => {
  it('no-ops when SKIP_ENV_VALIDATION=true', async () => {
    const fetchRows = vi.fn(() => Promise.resolve(fullCatalogRows()));
    await expect(
      validateBillingCatalogAtStartup({ SKIP_ENV_VALIDATION: 'true' }, fetchRows),
    ).resolves.toBeUndefined();
    expect(fetchRows).not.toHaveBeenCalled();
  });

  it('no-ops when NODE_ENV is not production (dev)', async () => {
    const fetchRows = vi.fn(() => Promise.resolve([]));
    await expect(
      validateBillingCatalogAtStartup({ NODE_ENV: 'development' }, fetchRows),
    ).resolves.toBeUndefined();
    expect(fetchRows).not.toHaveBeenCalled();
  });

  it('no-ops when NODE_ENV is not production (test)', async () => {
    const fetchRows = vi.fn(() => Promise.resolve([]));
    await expect(
      validateBillingCatalogAtStartup({ NODE_ENV: 'test' }, fetchRows),
    ).resolves.toBeUndefined();
    expect(fetchRows).not.toHaveBeenCalled();
  });

  it('no-ops in production Forge mode (no signing key → no Stripe → no catalog)', async () => {
    const fetchRows = vi.fn(() => Promise.resolve([]));
    await expect(
      validateBillingCatalogAtStartup(
        { NODE_ENV: 'production', STRIPE_LIVE_MODE: 'true' },
        fetchRows,
      ),
    ).resolves.toBeUndefined();
    expect(fetchRows).not.toHaveBeenCalled();
  });

  it('no-ops in production hosted mode when STRIPE_LIVE_MODE is unset', async () => {
    const fetchRows = vi.fn(() => Promise.resolve([]));
    await expect(
      validateBillingCatalogAtStartup(
        { NODE_ENV: 'production', REVEALUI_LICENSE_PRIVATE_KEY: 'present' },
        fetchRows,
      ),
    ).resolves.toBeUndefined();
    expect(fetchRows).not.toHaveBeenCalled();
  });

  it('no-ops in production hosted mode when STRIPE_LIVE_MODE is "false"', async () => {
    const fetchRows = vi.fn(() => Promise.resolve([]));
    await expect(
      validateBillingCatalogAtStartup(
        {
          NODE_ENV: 'production',
          REVEALUI_LICENSE_PRIVATE_KEY: 'present',
          STRIPE_LIVE_MODE: 'false',
        },
        fetchRows,
      ),
    ).resolves.toBeUndefined();
    expect(fetchRows).not.toHaveBeenCalled();
  });
});

describe('validateBillingCatalogAtStartup — live-mode validation', () => {
  const liveModeEnv: EnvMap = {
    NODE_ENV: 'production',
    REVEALUI_LICENSE_PRIVATE_KEY: 'present',
    STRIPE_LIVE_MODE: 'true',
  };

  it('passes when all expected plans are present with stripe_price_id', async () => {
    const fetchRows = vi.fn(() => Promise.resolve(fullCatalogRows()));
    await expect(validateBillingCatalogAtStartup(liveModeEnv, fetchRows)).resolves.toBeUndefined();
    expect(fetchRows).toHaveBeenCalledOnce();
  });

  it('throws when subscription:pro row is missing', async () => {
    const rows = fullCatalogRows().filter((r) => r.planId !== 'subscription:pro');
    await expect(
      validateBillingCatalogAtStartup(liveModeEnv, () => Promise.resolve(rows)),
    ).rejects.toThrow(/missing rows: subscription:pro/);
  });

  it('throws when multiple rows are missing — names them all in the error', async () => {
    const rows = fullCatalogRows().filter(
      (r) => r.planId !== 'subscription:enterprise' && r.planId !== 'credits:scale',
    );
    await expect(
      validateBillingCatalogAtStartup(liveModeEnv, () => Promise.resolve(rows)),
    ).rejects.toThrow(
      /subscription:enterprise.*credits:scale|credits:scale.*subscription:enterprise/,
    );
  });

  it('throws when a row exists but has null stripe_price_id', async () => {
    const rows = fullCatalogRows().map((r) =>
      r.planId === 'subscription:max' ? { ...r, stripePriceId: null } : r,
    );
    await expect(
      validateBillingCatalogAtStartup(liveModeEnv, () => Promise.resolve(rows)),
    ).rejects.toThrow(/null stripe_price_id: subscription:max/);
  });

  it('throws when both missing and incomplete rows exist — reports both categories', async () => {
    const rows = fullCatalogRows()
      .filter((r) => r.planId !== 'perpetual:enterprise')
      .map((r) => (r.planId === 'subscription:pro' ? { ...r, stripePriceId: null } : r));
    const err = await validateBillingCatalogAtStartup(liveModeEnv, () =>
      Promise.resolve(rows),
    ).then(
      () => null,
      (e: unknown) => (e instanceof Error ? e.message : String(e)),
    );
    expect(err).toMatch(/missing rows: perpetual:enterprise/);
    expect(err).toMatch(/null stripe_price_id: subscription:pro/);
  });

  it('error message points operator at the seed-billing fix', async () => {
    const rows = fullCatalogRows().filter((r) => r.planId !== 'subscription:pro');
    await expect(
      validateBillingCatalogAtStartup(liveModeEnv, () => Promise.resolve(rows)),
    ).rejects.toThrow(/seed-billing\.ts/);
  });

  it('ignores extra rows that are not in the expected list (forward-compatible)', async () => {
    const rows = [
      ...fullCatalogRows(),
      { planId: 'subscription:future-tier', stripePriceId: 'price_future' },
    ];
    await expect(
      validateBillingCatalogAtStartup(liveModeEnv, () => Promise.resolve(rows)),
    ).resolves.toBeUndefined();
  });
});

describe('EXPECTED_LIVE_PLAN_IDS — sync with billing-readiness cron', () => {
  it("matches the cron file's EXPECTED_PLAN_IDS list exactly", () => {
    // Snapshot of EXPECTED_PLAN_IDS at apps/server/src/routes/cron/billing-readiness.ts.
    // If this test fails, one of the two lists drifted. Pick the canonical source
    // (likely the cron file — it's the more-mature surface), update the other to
    // match, and ensure both lists are equal here.
    const cronExpected = [
      'subscription:pro',
      'subscription:max',
      'subscription:enterprise',
      'subscription:pro:year',
      'subscription:max:year',
      'subscription:enterprise:year',
      'perpetual:pro',
      'perpetual:max',
      'perpetual:enterprise',
      'credits:starter',
      'credits:standard',
      'credits:scale',
    ];
    expect([...EXPECTED_LIVE_PLAN_IDS_FOR_TEST]).toEqual(cronExpected);
  });
});

// ─── validateStripeTaxConfigAtStartup (GAP-437) ─────────────────────────
import { validateStripeTaxConfigAtStartup } from '../validate-startup.js';

/**
 * Live-mode hosted production fixture for the tax-config validator. Mirrors
 * `validLiveProdEnv` but keeps only the fields the guard conditions inspect —
 * the full fixture also works, this is just cheaper per-test.
 */
const liveHostedEnv: EnvMap = {
  NODE_ENV: 'production',
  STRIPE_LIVE_MODE: 'true',
  REVEALUI_LICENSE_PRIVATE_KEY: 'present',
};

describe('validateStripeTaxConfigAtStartup — short-circuits (never calls Stripe)', () => {
  it('no-ops when SKIP_ENV_VALIDATION=true', async () => {
    const fetchTaxSettings = vi.fn(() => Promise.resolve({ status: 'active' as const }));
    await validateStripeTaxConfigAtStartup(
      { ...liveHostedEnv, SKIP_ENV_VALIDATION: 'true' },
      fetchTaxSettings,
    );
    expect(fetchTaxSettings).not.toHaveBeenCalled();
  });

  it('no-ops when NODE_ENV is not production', async () => {
    const fetchTaxSettings = vi.fn(() => Promise.resolve({ status: 'active' as const }));
    await validateStripeTaxConfigAtStartup(
      { ...liveHostedEnv, NODE_ENV: 'development' },
      fetchTaxSettings,
    );
    expect(fetchTaxSettings).not.toHaveBeenCalled();
  });

  it('no-ops in Forge mode (no signing key → no Stripe account)', async () => {
    const fetchTaxSettings = vi.fn(() => Promise.resolve({ status: 'active' as const }));
    await validateStripeTaxConfigAtStartup(
      { NODE_ENV: 'production', STRIPE_LIVE_MODE: 'true' },
      fetchTaxSettings,
    );
    expect(fetchTaxSettings).not.toHaveBeenCalled();
  });

  it('never calls the Stripe API in test mode (STRIPE_LIVE_MODE unset)', async () => {
    const fetchTaxSettings = vi.fn(() => Promise.resolve({ status: 'active' as const }));
    await validateStripeTaxConfigAtStartup(
      { ...liveHostedEnv, STRIPE_LIVE_MODE: undefined },
      fetchTaxSettings,
    );
    expect(fetchTaxSettings).not.toHaveBeenCalled();
  });

  it('never calls the Stripe API when STRIPE_LIVE_MODE is "false"', async () => {
    const fetchTaxSettings = vi.fn(() => Promise.resolve({ status: 'active' as const }));
    await validateStripeTaxConfigAtStartup(
      { ...liveHostedEnv, STRIPE_LIVE_MODE: 'false' },
      fetchTaxSettings,
    );
    expect(fetchTaxSettings).not.toHaveBeenCalled();
  });
});

describe('validateStripeTaxConfigAtStartup — live-mode tax-flag guard', () => {
  it('warns when Tax Settings are active and STRIPE_TAX_ENABLED is unset', async () => {
    const warnSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const fetchTaxSettings = () => Promise.resolve({ status: 'active' as const });
    await validateStripeTaxConfigAtStartup(liveHostedEnv, fetchTaxSettings);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [message] = warnSpy.mock.calls[0] ?? [''];
    expect(String(message)).toMatch(/STRIPE_TAX_ENABLED/);
    expect(String(message)).toMatch(/tax/i);
  });

  it('warns when Tax Settings are active and STRIPE_TAX_ENABLED is "false"', async () => {
    const warnSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const fetchTaxSettings = () => Promise.resolve({ status: 'active' as const });
    await validateStripeTaxConfigAtStartup(
      { ...liveHostedEnv, STRIPE_TAX_ENABLED: 'false' },
      fetchTaxSettings,
    );
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('stays silent when Tax Settings are active and STRIPE_TAX_ENABLED=true', async () => {
    const warnSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const fetchTaxSettings = () => Promise.resolve({ status: 'active' as const });
    await validateStripeTaxConfigAtStartup(
      { ...liveHostedEnv, STRIPE_TAX_ENABLED: 'true' },
      fetchTaxSettings,
    );
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('stays silent when Tax Settings are pending (not yet active)', async () => {
    const warnSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const fetchTaxSettings = () => Promise.resolve({ status: 'pending' as const });
    await validateStripeTaxConfigAtStartup(liveHostedEnv, fetchTaxSettings);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('boots fine (no throw) when the Stripe API call fails, and logs one non-secret line', async () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const fetchTaxSettings = () => Promise.reject(new Error('ECONNRESET'));
    await expect(
      validateStripeTaxConfigAtStartup(liveHostedEnv, fetchTaxSettings),
    ).resolves.toBeUndefined();
    // Exactly one line — never the loud multi-line tax-flag banner (that's
    // the misconfig path, not the "couldn't check" path).
    expect(stderrSpy).toHaveBeenCalledTimes(1);
    const [message] = stderrSpy.mock.calls[0] ?? [''];
    expect(String(message)).toMatch(/ECONNRESET/);
    expect(String(message)).toMatch(/non-fatal/);
    expect(String(message)).not.toMatch(/STRIPE TAX ACTIVE/);
  });

  it('never throws even when the emitter itself throws (structural fail-open, B2)', async () => {
    // Guardrail-2 verdict B2: the whole body, including the emitter, is
    // wrapped in try/catch — a defect in emitStripeTaxFlagWarning must not
    // be able to reject this function and propagate into a caller's boot
    // chain (worker.ts turns a rejected chain into process.exit(1)).
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => {
      throw new Error('stderr is not writable right now');
    });
    const fetchTaxSettings = () => Promise.resolve({ status: 'active' as const });
    await expect(
      validateStripeTaxConfigAtStartup(
        { ...liveHostedEnv, STRIPE_TAX_ENABLED: 'false' },
        fetchTaxSettings,
      ),
    ).resolves.toBeUndefined();
    stderrSpy.mockRestore();
  });
});

// ─── fetchLiveStripeTaxSettings — uses protectedStripe (GAP-131) ───────
describe('fetchLiveStripeTaxSettings', () => {
  afterEach(() => {
    vi.doUnmock('../services-loader.js');
    vi.resetModules();
  });

  it('throws when @revealui/services is not installed', async () => {
    vi.resetModules();
    vi.doMock('../services-loader.js', () => ({
      getServices: () => Promise.resolve(null),
    }));
    const { fetchLiveStripeTaxSettings: fetchFresh } = await import('../validate-startup.js');
    await expect(fetchFresh()).rejects.toThrow(/@revealui\/services not installed/);
  });

  it('calls services.protectedStripe.tax.settings.retrieve (not raw getStripe)', async () => {
    const retrieve = vi.fn(() => Promise.resolve({ status: 'active' as const }));
    const getStripe = vi.fn();
    vi.resetModules();
    vi.doMock('../services-loader.js', () => ({
      getServices: () =>
        Promise.resolve({
          protectedStripe: { tax: { settings: { retrieve } } },
          getStripe,
        }),
    }));
    const { fetchLiveStripeTaxSettings: fetchFresh } = await import('../validate-startup.js');
    const result = await fetchFresh();
    expect(result).toEqual({ status: 'active' });
    expect(retrieve).toHaveBeenCalledTimes(1);
    expect(getStripe).not.toHaveBeenCalled();
  });
});
