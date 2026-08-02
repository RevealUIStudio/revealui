/**
 * withRevealUI (Vite) tests — config merge, define inject, admin headers,
 * and the hard lock that `@revealui/config` is never aliased (same class of
 * regression as nextjs/withRevealUI, 2026-06-10).
 */

import { describe, expect, it } from 'vitest';
import { type WithRevealUIOptions, withRevealUI } from '../../vite/withRevealUI.js';

describe('withRevealUI (vite) — default options', () => {
  it('returns a Vite config object', () => {
    const result = withRevealUI();
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });

  it('injects default REVEALUI_* process.env defines', () => {
    const result = withRevealUI();
    expect(result.define).toMatchObject({
      'process.env.REVEALUI_CONFIG_PATH': JSON.stringify('./revealui.config.ts'),
      'process.env.REVEALUI_ADMIN_ENABLED': JSON.stringify('true'),
      'process.env.REVEALUI_ADMIN_ROUTE': JSON.stringify('/admin'),
      'process.env.REVEALUI_API_ROUTE': JSON.stringify('/api'),
    });
  });

  it('preserves existing define entries', () => {
    const result = withRevealUI({ define: { __APP__: JSON.stringify('x') } });
    expect(result.define?.__APP__).toBe(JSON.stringify('x'));
    expect(result.define?.['process.env.REVEALUI_CONFIG_PATH']).toBe(
      JSON.stringify('./revealui.config.ts'),
    );
  });
});

describe('withRevealUI (vite) — custom options', () => {
  it('accepts custom configPath', () => {
    const result = withRevealUI({}, { configPath: './my-config.ts' });
    expect(result.define?.['process.env.REVEALUI_CONFIG_PATH']).toBe(
      JSON.stringify('./my-config.ts'),
    );
  });

  it('accepts admin disabled', () => {
    const result = withRevealUI({}, { admin: false });
    expect(result.define?.['process.env.REVEALUI_ADMIN_ENABLED']).toBe(JSON.stringify('false'));
  });

  it('accepts custom admin and api routes', () => {
    const options: WithRevealUIOptions = {
      adminRoute: '/dashboard',
      apiRoute: '/v1',
    };
    const result = withRevealUI({}, options);
    expect(result.define?.['process.env.REVEALUI_ADMIN_ROUTE']).toBe(JSON.stringify('/dashboard'));
    expect(result.define?.['process.env.REVEALUI_API_ROUTE']).toBe(JSON.stringify('/v1'));
  });
});

describe('withRevealUI (vite) — config merging', () => {
  it('spreads existing vite config properties', () => {
    const result = withRevealUI({
      base: '/app/',
      plugins: [],
    });
    expect(result.base).toBe('/app/');
    expect(result.plugins).toEqual([]);
  });

  it('preserves existing resolve.alias entries without adding @revealui/config', () => {
    const result = withRevealUI({
      resolve: {
        alias: { '@reveal-config': './revealui.config.ts' },
      },
    });
    const alias = result.resolve?.alias;
    expect(alias).toEqual({ '@reveal-config': './revealui.config.ts' });
    if (alias && !Array.isArray(alias)) {
      expect(alias['@revealui/config']).toBeUndefined();
    }
  });

  it('throws when consumer aliases @revealui/config (record form)', () => {
    expect(() =>
      withRevealUI({
        resolve: {
          alias: { '@revealui/config': './revealui.config.ts' },
        },
      }),
    ).toThrow(/do not alias @revealui\/config/);
  });

  it('throws when consumer aliases @revealui/config (array form)', () => {
    expect(() =>
      withRevealUI({
        resolve: {
          alias: [{ find: '@revealui/config', replacement: './revealui.config.ts' }],
        },
      }),
    ).toThrow(/do not alias @revealui\/config/);
  });
});

describe('withRevealUI (vite) — headers', () => {
  it('injects baseline admin headers on server and preview when admin enabled', () => {
    const result = withRevealUI();
    expect(result.server?.headers).toMatchObject({
      'X-Frame-Options': 'SAMEORIGIN',
      'X-Content-Type-Options': 'nosniff',
    });
    expect(result.preview?.headers).toMatchObject({
      'X-Frame-Options': 'SAMEORIGIN',
      'X-Content-Type-Options': 'nosniff',
    });
  });

  it('does not inject admin headers when admin is disabled', () => {
    const result = withRevealUI({}, { admin: false });
    expect(result.server?.headers?.['X-Frame-Options']).toBeUndefined();
    expect(result.preview?.headers?.['X-Frame-Options']).toBeUndefined();
  });

  it('merges with existing server headers', () => {
    const result = withRevealUI({
      server: { headers: { 'X-Custom': '1' } },
    });
    expect(result.server?.headers).toMatchObject({
      'X-Custom': '1',
      'X-Frame-Options': 'SAMEORIGIN',
      'X-Content-Type-Options': 'nosniff',
    });
  });
});
