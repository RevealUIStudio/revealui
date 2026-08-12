import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { validateRequiredEnvVars } from '../env-validation.js';

/**
 * GAP-430/GAP-440: a fresh, unlicensed self-host deploy (e.g. the Railway
 * marketplace template) never uses Stripe checkout, cross-subdomain session
 * cookies, or the Workspace-backed signup verification email — those are
 * hosted-SaaS-only concerns. Requiring their env vars in production blocked
 * a stranger's deploy from booting at all without SKIP_ENV_VALIDATION=true.
 */

const ENV_KEYS = [
  'REVEALUI_SECRET',
  'REVEALUI_PUBLIC_SERVER_URL',
  'POSTGRES_URL',
  'DATABASE_URL',
  'REVEALUI_KEK',
  'REVEALUI_FLEET_MODE',
  'REVEALUI_LICENSE_PRIVATE_KEY',
  'REVEALUI_DEPLOYMENT_MODE',
  'SESSION_COOKIE_DOMAIN',
  'NEXT_PUBLIC_STRIPE_PRO_PRICE_ID',
  'NEXT_PUBLIC_STRIPE_MAX_PRICE_ID',
  'NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID',
  'GOOGLE_SERVICE_ACCOUNT_EMAIL',
  'GOOGLE_PRIVATE_KEY',
] as const;

const saved: Record<string, string | undefined> = {};

const VALID_KEK = 'a'.repeat(64);

function setCriticalRequiredVars(): void {
  process.env.REVEALUI_SECRET = 'a'.repeat(32);
  process.env.REVEALUI_PUBLIC_SERVER_URL = 'https://admin.example.com';
  process.env.POSTGRES_URL = 'postgresql://user:pass@host:5432/db';
  process.env.REVEALUI_KEK = VALID_KEK;
}

describe('validateRequiredEnvVars', () => {
  beforeEach(() => {
    for (const key of ENV_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = saved[key];
      }
    }
  });

  describe('unlicensed self-host / marketplace-template deploy (no license private key)', () => {
    it('does not require SESSION_COOKIE_DOMAIN, Stripe price IDs, or Google email vars', () => {
      setCriticalRequiredVars();
      // No REVEALUI_LICENSE_PRIVATE_KEY, no REVEALUI_DEPLOYMENT_MODE, no
      // REVEALUI_FLEET_MODE — exactly the env shape of a stranger's fresh
      // Railway deploy (REVEALUI_ALLOW_UNLICENSED_SELF_HOST is a separate,
      // license-enforcement-only flag checked in instrumentation.ts, not here).

      const result = validateRequiredEnvVars({ environment: 'production' });

      expect(result.valid).toBe(true);
      expect(result.missing).toEqual([]);
    });

    it('still requires the critical base vars (e.g. REVEALUI_KEK)', () => {
      // Deliberately omit REVEALUI_KEK.
      process.env.REVEALUI_SECRET = 'a'.repeat(32);
      process.env.REVEALUI_PUBLIC_SERVER_URL = 'https://admin.example.com';
      process.env.POSTGRES_URL = 'postgresql://user:pass@host:5432/db';

      const result = validateRequiredEnvVars({ environment: 'production' });

      expect(result.valid).toBe(false);
      expect(result.missing).toContain('REVEALUI_KEK');
    });
  });

  describe('RevForge Fleet-branded kit (REVEALUI_FLEET_MODE=true)', () => {
    it('does not require SESSION_COOKIE_DOMAIN, Stripe price IDs, or Google email vars', () => {
      setCriticalRequiredVars();
      process.env.REVEALUI_FLEET_MODE = 'true';

      const result = validateRequiredEnvVars({ environment: 'production' });

      expect(result.valid).toBe(true);
      expect(result.missing).toEqual([]);
    });
  });

  describe('RevealUI Studio hosted SaaS (REVEALUI_LICENSE_PRIVATE_KEY present)', () => {
    it('still requires SESSION_COOKIE_DOMAIN, Stripe price IDs, and Google email vars', () => {
      setCriticalRequiredVars();
      process.env.REVEALUI_LICENSE_PRIVATE_KEY = 'a-private-key';

      const result = validateRequiredEnvVars({ environment: 'production' });

      expect(result.valid).toBe(false);
      expect(result.missing).toEqual(
        expect.arrayContaining([
          'SESSION_COOKIE_DOMAIN',
          'NEXT_PUBLIC_STRIPE_PRO_PRICE_ID',
          'NEXT_PUBLIC_STRIPE_MAX_PRICE_ID',
          'NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID',
          'GOOGLE_SERVICE_ACCOUNT_EMAIL',
          'GOOGLE_PRIVATE_KEY',
        ]),
      );
    });

    it('passes when all hosted-only vars are set', () => {
      setCriticalRequiredVars();
      process.env.REVEALUI_LICENSE_PRIVATE_KEY = 'a-private-key';
      process.env.SESSION_COOKIE_DOMAIN = '.example.com';
      process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID = 'price_pro';
      process.env.NEXT_PUBLIC_STRIPE_MAX_PRICE_ID = 'price_max';
      process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID = 'price_ent';
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = 'svc@example.iam.gserviceaccount.com';
      process.env.GOOGLE_PRIVATE_KEY = 'a-private-key';

      const result = validateRequiredEnvVars({ environment: 'production' });

      expect(result.valid).toBe(true);
      expect(result.missing).toEqual([]);
    });

    it('treats MODE=hosted without a signing private key as hosted SaaS (GAP-260 P4-4)', () => {
      setCriticalRequiredVars();
      process.env.REVEALUI_DEPLOYMENT_MODE = 'hosted';
      delete process.env.REVEALUI_LICENSE_PRIVATE_KEY;

      const result = validateRequiredEnvVars({ environment: 'production' });

      expect(result.valid).toBe(false);
      expect(result.missing).toEqual(expect.arrayContaining(['SESSION_COOKIE_DOMAIN']));
    });
  });

  describe('non-production environments', () => {
    it('never requires the hosted-only vars regardless of deployment mode', () => {
      setCriticalRequiredVars();
      process.env.REVEALUI_LICENSE_PRIVATE_KEY = 'a-private-key';

      const result = validateRequiredEnvVars({ environment: 'development' });

      expect(result.valid).toBe(true);
      expect(result.missing).toEqual([]);
    });
  });
});
