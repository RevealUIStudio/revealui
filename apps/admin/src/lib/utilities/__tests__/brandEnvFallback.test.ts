import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mergeOpenGraph } from '../mergeOpenGraph';

// Docker Compose `${VAR:-}` interpolation delivers unset env vars to the
// container as empty strings, not undefined. The brand fallback chains must
// treat '' as unset so a kit without overrides keeps canonical branding
// instead of rendering an empty brand name.

const ENV_KEYS = [
  'REVEALUI_BRAND_NAME',
  'REVEALUI_TENANT_NAME',
  'REVEALUI_BRAND_DESCRIPTION',
  'NEXT_PUBLIC_SITE_NAME',
  'NEXT_PUBLIC_SITE_OPERATOR',
] as const;

const saved: Record<string, string | undefined> = {};

describe('brand env fallback (empty-string safety)', () => {
  beforeEach(() => {
    for (const key of ENV_KEYS) {
      saved[key] = process.env[key];
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
    vi.resetModules();
  });

  describe('mergeOpenGraph identity', () => {
    it('treats an empty brand name as unset (falls through to tenant name)', () => {
      process.env.REVEALUI_BRAND_NAME = '';
      process.env.REVEALUI_TENANT_NAME = 'Acme';
      const og = mergeOpenGraph();
      expect(og?.siteName).toBe('Acme');
      expect(og?.title).toBe('Acme');
    });

    it('falls back to the canonical name when both overrides are empty', () => {
      process.env.REVEALUI_BRAND_NAME = '';
      process.env.REVEALUI_TENANT_NAME = '';
      const og = mergeOpenGraph();
      expect(og?.siteName).toBe('RevealUI');
    });

    it('keeps the empty-string description opt-out', () => {
      process.env.REVEALUI_BRAND_DESCRIPTION = '';
      const og = mergeOpenGraph();
      expect(og?.description).toBeUndefined();
    });
  });

  describe('siteBranding constants', () => {
    it('treats empty NEXT_PUBLIC_SITE_NAME / SITE_OPERATOR as unset', async () => {
      process.env.NEXT_PUBLIC_SITE_NAME = '';
      process.env.NEXT_PUBLIC_SITE_OPERATOR = '';
      vi.resetModules();
      const mod = await import('../siteBranding');
      expect(mod.SITE_NAME).toBe('RevealUI');
      expect(mod.SITE_OPERATOR).toBe('REVEALUI STUDIO L.L.C.');
      expect(mod.IS_CANONICAL_BRANDING).toBe(true);
    });

    it('uses the configured site name when set', async () => {
      process.env.NEXT_PUBLIC_SITE_NAME = 'Acme';
      vi.resetModules();
      const mod = await import('../siteBranding');
      expect(mod.SITE_NAME).toBe('Acme');
      expect(mod.IS_CANONICAL_BRANDING).toBe(false);
    });
  });
});
