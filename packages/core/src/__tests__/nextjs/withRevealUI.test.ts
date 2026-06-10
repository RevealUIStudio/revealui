/**
 * withRevealUI tests  -  validates Next.js config wrapper including
 * config merging, webpack alias setup, turbopack passthrough, headers,
 * and environment variables. Locks the regression that the `@revealui/config`
 * package specifier is never aliased: the alias shadowed the env-config
 * package in server bundles (prod admin passkey/MFA 500s, 2026-06-10).
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { type WithRevealUIOptions, withRevealUI } from '../../nextjs/withRevealUI.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface WebpackResolve {
  alias?: Record<string, string>;
  modules?: string[];
}

interface WebpackConfig {
  resolve?: WebpackResolve;
  module?: { rules: unknown[] };
}

interface WebpackContext {
  isServer: boolean;
  dev: boolean;
  dir: string;
}

function createWebpackContext(overrides: Partial<WebpackContext> = {}): WebpackContext {
  return {
    isServer: false,
    dev: true,
    dir: '/project',
    ...overrides,
  };
}

function callWebpack(
  result: ReturnType<typeof withRevealUI>,
  config: WebpackConfig = {},
  context?: Partial<WebpackContext>,
): WebpackConfig {
  const webpackFn = result.webpack as (cfg: WebpackConfig, ctx: WebpackContext) => WebpackConfig;
  return webpackFn(config, createWebpackContext(context));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

afterEach(() => {
  vi.restoreAllMocks();
});

// =============================================================================
// Default options
// =============================================================================

describe('withRevealUI  -  default options', () => {
  it('returns a Next.js config object', () => {
    const result = withRevealUI();
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });

  it('sets default environment variables', () => {
    const result = withRevealUI();
    expect(result.env).toMatchObject({
      REVEALUI_CONFIG_PATH: './revealui.config.ts',
      REVEALUI_ADMIN_ENABLED: 'true',
      REVEALUI_ADMIN_ROUTE: '/admin',
      REVEALUI_API_ROUTE: '/api',
    });
  });

  it('preserves existing env variables', () => {
    const result = withRevealUI({ env: { MY_VAR: 'hello' } });
    expect(result.env).toMatchObject({
      MY_VAR: 'hello',
      REVEALUI_CONFIG_PATH: './revealui.config.ts',
    });
  });

  it('creates a webpack function', () => {
    const result = withRevealUI();
    expect(typeof result.webpack).toBe('function');
  });

  it('creates a headers function', () => {
    const result = withRevealUI();
    expect(typeof result.headers).toBe('function');
  });

  it('includes images configuration', () => {
    const result = withRevealUI();
    expect(result.images).toBeDefined();
    expect(result.images?.remotePatterns).toEqual([]);
  });
});

// =============================================================================
// Custom options
// =============================================================================

describe('withRevealUI  -  custom options', () => {
  it('accepts custom configPath', () => {
    const result = withRevealUI({}, { configPath: './my-config.ts' });
    expect(result.env?.REVEALUI_CONFIG_PATH).toBe('./my-config.ts');
  });

  it('accepts admin disabled', () => {
    const result = withRevealUI({}, { admin: false });
    expect(result.env?.REVEALUI_ADMIN_ENABLED).toBe('false');
  });

  it('accepts custom admin route', () => {
    const result = withRevealUI({}, { adminRoute: '/dashboard' });
    expect(result.env?.REVEALUI_ADMIN_ROUTE).toBe('/dashboard');
  });

  it('accepts custom api route', () => {
    const result = withRevealUI({}, { apiRoute: '/v1' });
    expect(result.env?.REVEALUI_API_ROUTE).toBe('/v1');
  });
});

// =============================================================================
// Config merging
// =============================================================================

describe('withRevealUI  -  config merging', () => {
  it('spreads existing nextConfig properties', () => {
    const result = withRevealUI({
      reactStrictMode: true,
      output: 'standalone',
    });
    expect(result.reactStrictMode).toBe(true);
    expect(result.output).toBe('standalone');
  });

  it('merges existing images remotePatterns', () => {
    const existingPattern = {
      protocol: 'https' as const,
      hostname: 'example.com',
    };
    const result = withRevealUI({
      images: { remotePatterns: [existingPattern] },
    });
    expect(result.images?.remotePatterns).toContainEqual(existingPattern);
  });
});

// =============================================================================
// Webpack configuration
// =============================================================================

describe('withRevealUI  -  webpack', () => {
  it('does not alias @revealui/config (must resolve to the real env-config package)', () => {
    const result = withRevealUI();
    const webpackResult = callWebpack(result);

    const alias = webpackResult.resolve?.alias ?? {};
    expect(alias['@revealui/config']).toBeUndefined();
  });

  it('sets @revealui/core alias', () => {
    const result = withRevealUI();
    const webpackResult = callWebpack(result);

    const alias = webpackResult.resolve?.alias ?? {};
    expect(alias['@revealui/core']).toBeDefined();
    expect(alias['@revealui/core']).toContain('index');
  });

  it('preserves existing resolve.alias entries', () => {
    const result = withRevealUI();
    const webpackResult = callWebpack(result, {
      resolve: {
        alias: { 'my-alias': '/some/path' },
      },
    });

    const alias = webpackResult.resolve?.alias ?? {};
    expect(alias['my-alias']).toBe('/some/path');
    expect(alias['@revealui/config']).toBeUndefined();
  });

  it('initializes resolve.modules if missing', () => {
    const result = withRevealUI();
    const webpackResult = callWebpack(result, { resolve: {} });

    expect(webpackResult.resolve?.modules).toEqual(['node_modules']);
  });

  it('preserves existing resolve.modules', () => {
    const result = withRevealUI();
    const webpackResult = callWebpack(result, {
      resolve: { modules: ['node_modules', 'src'] },
    });

    expect(webpackResult.resolve?.modules).toEqual(['node_modules', 'src']);
  });

  it('calls existing webpack function first', () => {
    const existingWebpack = vi.fn((config: WebpackConfig) => {
      return { ...config, customField: true } as WebpackConfig & { customField: boolean };
    });

    const result = withRevealUI({ webpack: existingWebpack as never });
    callWebpack(result);

    expect(existingWebpack).toHaveBeenCalledOnce();
  });
});

// =============================================================================
// Turbopack configuration
// =============================================================================

describe('withRevealUI  -  turbopack', () => {
  it('injects no turbopack config when the app provides none', () => {
    const result = withRevealUI();
    expect(result.turbopack).toBeUndefined();
  });

  it('passes through existing turbopack config without injecting @revealui/config', () => {
    const result = withRevealUI({
      turbopack: {
        resolveAlias: { 'my-pkg': './src/my-pkg' },
      },
    });

    expect(result.turbopack?.resolveAlias?.['my-pkg']).toBe('./src/my-pkg');
    expect(result.turbopack?.resolveAlias?.['@revealui/config']).toBeUndefined();
  });

  it('passes through a consumer-set @revealui/config alias untouched', () => {
    const result = withRevealUI({
      turbopack: {
        resolveAlias: { '@revealui/config': './custom-config.ts' },
      },
    });

    expect(result.turbopack?.resolveAlias?.['@revealui/config']).toBe('./custom-config.ts');
  });
});

// =============================================================================
// Headers
// =============================================================================

describe('withRevealUI  -  headers', () => {
  it('returns admin headers when admin is enabled', async () => {
    const result = withRevealUI();
    const headers = await result.headers!();

    expect(headers).toHaveLength(1);
    expect(headers[0].source).toBe('/admin/:path*');
    expect(headers[0].headers).toEqual([
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
    ]);
  });

  it('returns no admin headers when admin is disabled', async () => {
    const result = withRevealUI({}, { admin: false });
    const headers = await result.headers!();

    expect(headers).toHaveLength(0);
  });

  it('uses custom admin route in header source', async () => {
    const result = withRevealUI({}, { adminRoute: '/dashboard' });
    const headers = await result.headers!();

    expect(headers[0].source).toBe('/dashboard/:path*');
  });

  it('preserves existing headers', async () => {
    const existingHeaders = [
      {
        source: '/api/:path*',
        headers: [{ key: 'X-Custom', value: 'test' }],
      },
    ];

    const result = withRevealUI({
      headers: async () => existingHeaders,
    });
    const headers = await result.headers!();

    expect(headers).toHaveLength(2);
    expect(headers[0]).toEqual(existingHeaders[0]);
  });

  it('handles missing existing headers function', async () => {
    const result = withRevealUI({});
    const headers = await result.headers!();

    // Should still return admin headers
    expect(headers.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// Images
// =============================================================================

describe('withRevealUI  -  images', () => {
  it('preserves existing image settings', () => {
    const result = withRevealUI({
      images: {
        domains: ['example.com'],
        deviceSizes: [640, 750],
      },
    });

    expect(result.images?.domains).toEqual(['example.com']);
    expect(result.images?.deviceSizes).toEqual([640, 750]);
  });

  it('merges remote patterns', () => {
    const pattern = { protocol: 'https' as const, hostname: 'cdn.example.com' };
    const result = withRevealUI({
      images: { remotePatterns: [pattern] },
    });

    expect(result.images?.remotePatterns).toContainEqual(pattern);
  });
});

// =============================================================================
// WithRevealUIOptions type
// =============================================================================

describe('WithRevealUIOptions', () => {
  it('all options are optional', () => {
    // Should compile and work without any options
    const result = withRevealUI({}, {});
    expect(result).toBeDefined();
  });

  it('accepts partial options', () => {
    const options: WithRevealUIOptions = { admin: false };
    const result = withRevealUI({}, options);
    expect(result.env?.REVEALUI_ADMIN_ENABLED).toBe('false');
  });
});
