/**
 * GAP-287 PR-2 — subscription license exp derivation (period_end + slack).
 *
 * Covers the pure derivation surface added to the license issuer:
 *  - RENEWAL_SLACK_DAYS is the owner-countersigned 7 days (2026-07-18).
 *  - subscriptionLicenseExpiresInSeconds derives a period-bound lifetime and
 *    falls back to the 365d default when no billing period is available.
 *  - subscriptionExpBound is the absolute epoch bound the renewal cadence
 *    compares against.
 *  - readLicenseExp reads (never verifies) a token's exp for that comparison.
 *  - A subscription mint driven through these helpers sets exp = period_end +
 *    slack (RED against the pre-GAP-287 flat 365d default).
 *  - Exemptions: a perpetual mint still carries NO exp; the canary path is
 *    untouched.
 *  - Rotation interplay: a token minted under the OUTGOING key still verifies
 *    during a dual-key window (GAP-259 composition).
 */

import { generateKeyPairSync } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  coversRenewalBound,
  DEFAULT_SUBSCRIPTION_TTL_SECONDS,
  generateLicenseKey,
  RENEWAL_IDEMPOTENCY_TOLERANCE_SECONDS,
  RENEWAL_SLACK_DAYS,
  RENEWAL_SLACK_SECONDS,
  readLicenseExp,
  selfVerifyLicenseKeypair,
  subscriptionExpBound,
  subscriptionLicenseExpiresInSeconds,
  validateLicenseKey,
} from '../license.js';

let publicKeyPem: string;
let privateKeyPem: string;

beforeAll(() => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  publicKeyPem = publicKey;
  privateKeyPem = privateKey;
});

const DAY = 86_400;

describe('countersigned constants', () => {
  it('RENEWAL_SLACK is the owner-ratified 7 days', () => {
    expect(RENEWAL_SLACK_DAYS).toBe(7);
    expect(RENEWAL_SLACK_SECONDS).toBe(7 * DAY);
  });

  it('DEFAULT_SUBSCRIPTION_TTL_SECONDS is one year', () => {
    expect(DEFAULT_SUBSCRIPTION_TTL_SECONDS).toBe(365 * DAY);
  });
});

describe('subscriptionLicenseExpiresInSeconds', () => {
  it('derives (period_end + slack) − now', () => {
    const now = 1_000_000_000_000; // fixed epoch ms
    const periodEnd = new Date(now + 30 * DAY * 1000);
    const got = subscriptionLicenseExpiresInSeconds(periodEnd, now);
    expect(got).toBe(30 * DAY + RENEWAL_SLACK_SECONDS);
  });

  it('falls back to the 365d default when the period end is absent', () => {
    expect(subscriptionLicenseExpiresInSeconds(null)).toBe(DEFAULT_SUBSCRIPTION_TTL_SECONDS);
    expect(subscriptionLicenseExpiresInSeconds(undefined)).toBe(DEFAULT_SUBSCRIPTION_TTL_SECONDS);
  });

  it('floors at one second for a period already in the past (never a non-positive lifetime)', () => {
    const now = 1_000_000_000_000;
    const pastPeriodEnd = new Date(now - 60 * DAY * 1000);
    expect(subscriptionLicenseExpiresInSeconds(pastPeriodEnd, now)).toBe(1);
  });
});

describe('subscriptionExpBound', () => {
  it('is the absolute epoch bound period_end + slack', () => {
    const periodEnd = new Date(1_700_000_000_000);
    expect(subscriptionExpBound(periodEnd)).toBe(1_700_000_000 + RENEWAL_SLACK_SECONDS);
  });
});

// #1978 guardrail-2 verdict, non-blocking finding: the minted exp can floor 1s
// below subscriptionExpBound's value, so a duplicate invoice.payment_succeeded
// must still treat that 1s-short exp as covering the bound (SKIP re-mint).
describe('coversRenewalBound (idempotency tolerance)', () => {
  it('is 1 second', () => {
    expect(RENEWAL_IDEMPOTENCY_TOLERANCE_SECONDS).toBe(1);
  });

  it('covers when the stored exp meets the bound exactly', () => {
    expect(coversRenewalBound(1_700_000_000, 1_700_000_000)).toBe(true);
  });

  it('covers when the stored exp is exactly 1s below the bound (the flooring gap)', () => {
    expect(coversRenewalBound(1_700_000_000 - 1, 1_700_000_000)).toBe(true);
  });

  it('does NOT cover when the stored exp is 2s or more below the bound', () => {
    expect(coversRenewalBound(1_700_000_000 - 2, 1_700_000_000)).toBe(false);
  });

  it('does NOT cover a perpetual/undecodable token (null exp)', () => {
    expect(coversRenewalBound(null, 1_700_000_000)).toBe(false);
  });
});

describe('subscription mint exp derivation (end-to-end)', () => {
  it('sets exp = period_end + slack (RED against the pre-GAP-287 flat 365d)', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const periodEnd = new Date((nowSec + 30 * DAY) * 1000);

    const jwt = await generateLicenseKey(
      { tier: 'pro', customerId: 'cus_exp' },
      privateKeyPem,
      subscriptionLicenseExpiresInSeconds(periodEnd),
    );

    const exp = await readLicenseExp(jwt);
    expect(exp).not.toBeNull();
    const expectedBound = subscriptionExpBound(periodEnd);
    // Allow a couple seconds of skew between the call-site now and the sign-time now.
    expect(Math.abs((exp as number) - expectedBound)).toBeLessThanOrEqual(5);

    // The whole point of PR-2: the token is period-bound (~37d), NOT a flat year.
    expect(exp as number).toBeLessThan(nowSec + 60 * DAY);
  });
});

describe('exemptions (byte-identical behavior)', () => {
  it('a perpetual mint still carries NO exp claim', async () => {
    const jwt = await generateLicenseKey(
      { tier: 'enterprise', customerId: 'cus_perp', perpetual: true },
      privateKeyPem,
      null,
    );
    expect(await readLicenseExp(jwt)).toBeNull();
  });

  it('the keypair canary path is untouched (self-verify still ok)', async () => {
    const result = await selfVerifyLicenseKeypair(privateKeyPem, [publicKeyPem]);
    expect(result.status).toBe('ok');
  });
});

describe('rotation interplay (GAP-259 composition)', () => {
  it('a period-bound token minted under the outgoing key verifies during a dual-key window', async () => {
    const { publicKey: nextPublic } = generateKeyPairSync('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    const nowSec = Math.floor(Date.now() / 1000);
    const periodEnd = new Date((nowSec + 30 * DAY) * 1000);
    const jwt = await generateLicenseKey(
      { tier: 'pro', customerId: 'cus_rot' },
      privateKeyPem, // outgoing signer
      subscriptionLicenseExpiresInSeconds(periodEnd),
      publicKeyPem,
    );

    // Ordered multi-key set: incoming key first, outgoing key still present.
    const payload = await validateLicenseKey(jwt, [nextPublic, publicKeyPem]);
    expect(payload).not.toBeNull();
    expect(payload?.tier).toBe('pro');
  });
});

describe('readLicenseExp', () => {
  it('returns null for an undecodable token', async () => {
    expect(await readLicenseExp('not-a-jwt')).toBeNull();
  });
});
