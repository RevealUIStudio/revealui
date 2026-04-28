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

// ─── validateLicenseAtStartup (Forge boot-time enforcement) ─────────────
import { generateKeyPairSync } from 'node:crypto';
import { generateLicenseKey } from '@revealui/core/license';
import { beforeAll } from 'vitest';
import { validateLicenseAtStartup } from '../validate-startup.js';

let testPrivateKey: string;
let testPublicKey: string;
let mismatchedPublicKey: string;

beforeAll(() => {
  const pair = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  testPrivateKey = pair.privateKey;
  testPublicKey = pair.publicKey;

  // Second keypair to test signature mismatch detection.
  const otherPair = generateKeyPairSync('rsa', {
    modulusLength: 2048,
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
    ).rejects.toThrow(/REVEALUI_LICENSE_KEY is required for Forge/);
  });

  it('throws in Forge mode when REVEALUI_LICENSE_PUBLIC_KEY is missing', async () => {
    await expect(
      validateLicenseAtStartup({
        REVEALUI_LICENSE_KEY: 'doesnt-matter-no-pubkey-to-verify',
      }),
    ).rejects.toThrow(/REVEALUI_LICENSE_PUBLIC_KEY is required for Forge/);
  });

  it('throws when the JWT is malformed', async () => {
    await expect(
      validateLicenseAtStartup({
        REVEALUI_LICENSE_KEY: 'not.a.valid.jwt',
        REVEALUI_LICENSE_PUBLIC_KEY: testPublicKey,
      }),
    ).rejects.toThrow(/REVEALUI_LICENSE_KEY is invalid/);
  });

  it('throws when the JWT was signed with a different key', async () => {
    const jwt = await generateLicenseKey(
      { tier: 'enterprise', customerId: 'allevia' },
      testPrivateKey,
      30 * 24 * 60 * 60,
      testPublicKey,
    );
    // Verify against a DIFFERENT public key — must fail.
    await expect(
      validateLicenseAtStartup({
        REVEALUI_LICENSE_KEY: jwt,
        REVEALUI_LICENSE_PUBLIC_KEY: mismatchedPublicKey,
      }),
    ).rejects.toThrow(/REVEALUI_LICENSE_KEY is invalid/);
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
      { tier: 'enterprise', customerId: 'allevia' },
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
    // KEK is generated by forge/stamp.sh (RevealUIStudio/forge#10) and
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

// ─── x402 + RVUI activation gates (mode-agnostic) ──────────────────────
import { emitRvuiSafeguardsWarning } from '../validate-startup.js';

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

describe('validateStartup — RVUI activation gate + GAP-159 warning', () => {
  const validUsdcAddr = `0x${'a'.repeat(40)}`;
  const validRvuiWallet = 'EFvaPJL7HpFvzG7g7CKyP1u4LpY9Wn8sBprS1Pw7tJM6'; // base58 placeholder

  it('passes when RVUI_PAYMENTS_ENABLED is unset', () => {
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    expect(() => validateStartup(validTestProdEnv())).not.toThrow();
  });

  it('throws when RVUI_PAYMENTS_ENABLED=true but RVUI_RECEIVING_WALLET is missing', () => {
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    expect(() => validateStartup(validTestProdEnv({ RVUI_PAYMENTS_ENABLED: 'true' }))).toThrow(
      /RVUI_RECEIVING_WALLET/,
    );
  });

  it('emits the RVUI experimental banner when RVUI_PAYMENTS_ENABLED=true and wallet is set', () => {
    const warnSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    validateStartup(
      validTestProdEnv({
        RVUI_PAYMENTS_ENABLED: 'true',
        RVUI_RECEIVING_WALLET: validRvuiWallet,
      }),
    );

    const messages = warnSpy.mock.calls.map((c) => String(c[0] ?? ''));
    const rvuiBanner = messages.find((m) => m.includes('RVUI PAYMENTS'));
    expect(rvuiBanner).toBeDefined();
    expect(rvuiBanner).toMatch(/experimental/i);
    // GAP-159 is referenced as historical closure context, not as an
    // active gate (closed via revealui#648).
    expect(rvuiBanner).toMatch(/GAP-159/);
    expect(rvuiBanner).toMatch(/devnet/i);
  });

  it('does NOT emit the RVUI experimental banner when RVUI_PAYMENTS_ENABLED is unset', () => {
    const warnSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    validateStartup(validTestProdEnv());

    const messages = warnSpy.mock.calls.map((c) => String(c[0] ?? ''));
    expect(messages.some((m) => m.includes('RVUI PAYMENTS'))).toBe(false);
  });

  it('emits both Stripe test-mode AND RVUI experimental banners when both apply', () => {
    const warnSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    validateStartup(
      validTestProdEnv({
        RVUI_PAYMENTS_ENABLED: 'true',
        RVUI_RECEIVING_WALLET: validRvuiWallet,
      }),
    );

    const messages = warnSpy.mock.calls.map((c) => String(c[0] ?? ''));
    expect(messages.some((m) => m.includes('STRIPE TEST MODE'))).toBe(true);
    expect(messages.some((m) => m.includes('RVUI PAYMENTS'))).toBe(true);
  });

  it('also enforces the RVUI gate in forge mode', () => {
    expect(() => validateStartup(validForgeProdEnv({ RVUI_PAYMENTS_ENABLED: 'true' }))).toThrow(
      /RVUI_RECEIVING_WALLET/,
    );
  });

  it('combines x402 + RVUI activation gates without conflict', () => {
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    expect(() =>
      validateStartup(
        validTestProdEnv({
          X402_ENABLED: 'true',
          X402_RECEIVING_ADDRESS: validUsdcAddr,
          RVUI_PAYMENTS_ENABLED: 'true',
          RVUI_RECEIVING_WALLET: validRvuiWallet,
        }),
      ),
    ).not.toThrow();
  });
});

describe('emitRvuiSafeguardsWarning', () => {
  it('writes a single banner naming RVUI as experimental with safeguards wired', () => {
    const writeSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    emitRvuiSafeguardsWarning();

    expect(writeSpy).toHaveBeenCalledTimes(1);
    const message = String(writeSpy.mock.calls[0]?.[0] ?? '');
    expect(message).toMatch(/RVUI PAYMENTS/);
    expect(message).toMatch(/experimental/i);
    expect(message).toMatch(/RVUI_PAYMENTS_ENABLED/);
    // Historical closure context — banner names GAP-159 + the PR that closed it
    // so an operator reading runtime logs can trace the safety story.
    expect(message).toMatch(/GAP-159/);
    expect(message).toMatch(/devnet/i);
  });
});
