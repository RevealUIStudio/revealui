/**
 * withRevealUI tests  -  validates Next.js config wrapper including
 * config merging, webpack alias setup, turbopack aliases, headers,
 * environment variables, and config file resolution.
 */

import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type WithRevealUIOptions, withRevealUI } from '../../nextjs/withRevealUI.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn(),
  },
  existsSync: vi.fn(),
}));

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

beforeEach(() => {
  vi.mocked(fs.existsSync).mockReturnValue(true);
});

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
  it('sets @revealui/config alias to resolved config path', () => {
    const result = withRevealUI();
    const webpackResult = callWebpack(result);

    const alias = webpackResult.resolve?.alias ?? {};
    expect(alias['@revealui/config']).toBe(path.resolve('/project', './revealui.config.ts'));
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
    expect(alias['@revealui/config']).toBeDefined();
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

  it('uses context.dir as project root', () => {
    const result = withRevealUI();
    const webpackResult = callWebpack(result, {}, { dir: '/custom/project' });

    const alias = webpackResult.resolve?.alias ?? {};
    expect(alias['@revealui/config']).toBe(path.resolve('/custom/project', './revealui.config.ts'));
  });
});

// =============================================================================
// Config file resolution
// =============================================================================

describe('withRevealUI  -  config file resolution', () => {
  it('uses exact path when file exists', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);

    const result = withRevealUI();
    const webpackResult = callWebpack(result);

    const alias = webpackResult.resolve?.alias ?? {};
    expect(alias['@revealui/config']).toBe(path.resolve('/project', './revealui.config.ts'));
  });

  it('tries alternative extensions when exact path not found', () => {
    // First call (exact path) returns false, second (.ts ext) returns true
    vi.mocked(fs.existsSync)
      .mockReturnValueOnce(false) // exact path
      .mockReturnValueOnce(true); // .ts extension

    const result = withRevealUI({}, { configPath: './revealui.config' });
    const webpackResult = callWebpack(result);

    const alias = webpackResult.resolve?.alias ?? {};
    expect(alias['@revealui/config']).toBeDefined();
  });

  it('throws in production when config file not found', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = withRevealUI();

    expect(() => {
      callWebpack(result, {}, { dev: false });
    }).toThrow(/RevealUI config file not found/);
  });

  it('warns in development when config file not found', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = withRevealUI();

    // Should not throw in dev mode
    expect(() => {
      callWebpack(result, {}, { dev: true });
    }).not.toThrow();
  });

  it('uses fallback path in dev when config not found', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = withRevealUI();
    const webpackResult = callWebpack(result, {}, { dev: true, dir: '/my/project' });

    const alias = webpackResult.resolve?.alias ?? {};
    // Falls back to resolved configPath
    expect(alias['@revealui/config']).toBe(path.resolve('/my/project', './revealui.config.ts'));
  });

  it('handles absolute configPath', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);

    const result = withRevealUI({}, { configPath: '/absolute/path/config.ts' });
    const webpackResult = callWebpack(result);

    const alias = webpackResult.resolve?.alias ?? {};
    expect(alias['@revealui/config']).toBe('/absolute/path/config.ts');
  });

  it('error message includes searched paths', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = withRevealUI();

    try {
      callWebpack(result, {}, { dev: false });
      expect.unreachable('should have thrown');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain('RevealUI config file not found');
      expect(message).toContain('Searched for');
      expect(message).toContain('Please ensure the config file exists');
    }
  });
});

// =============================================================================
// Turbopack configuration
// =============================================================================

describe('withRevealUI  -  turbopack', () => {
  it('sets turbopack resolveAlias for @revealui/config', () => {
    const result = withRevealUI();
    expect(result.turbopack?.resolveAlias?.['@revealui/config']).toBeDefined();
  });

  it('preserves existing turbopack config', () => {
    const result = withRevealUI({
      turbopack: {
        resolveAlias: { 'my-pkg': './src/my-pkg' },
      },
    });

    expect(result.turbopack?.resolveAlias?.['my-pkg']).toBe('./src/my-pkg');
    expect(result.turbopack?.resolveAlias?.['@revealui/config']).toBeDefined();
  });

  it('prefers existing @revealui/config alias from nextConfig', () => {
    const result = withRevealUI({
      turbopack: {
        resolveAlias: { '@revealui/config': './custom-config.ts' },
      },
    });

    expect(result.turbopack?.resolveAlias?.['@revealui/config']).toBe('./custom-config.ts');
  });

  it('uses relative configPath for turbopack when not absolute', () => {
    const result = withRevealUI({}, { configPath: './my-config.ts' });
    // When configPath is relative and no existing turbopack alias, it should use configPath
    expect(result.turbopack?.resolveAlias?.['@revealui/config']).toBe('./my-config.ts');
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
