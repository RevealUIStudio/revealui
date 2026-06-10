import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Subset of Next.js config shape used by withRevealUI.
 * Defined locally to avoid requiring `next` as a dependency of @revealui/core.
 * Consumers pass their full NextConfig through; we only access these fields.
 */
interface NextConfig {
  env?: Record<string, string | undefined>;
  webpack?: (
    config: Record<string, unknown>,
    context: { isServer: boolean; dev: boolean; dir: string; [key: string]: unknown },
  ) => Record<string, unknown>;
  turbopack?: { resolveAlias?: Record<string, string> };
  headers?: () => Promise<
    Array<{ source: string; headers: Array<{ key: string; value: string }> }>
  >;
  images?: { remotePatterns?: Array<Record<string, unknown>> };
  [key: string]: unknown;
}

// Get __dirname equivalent for ESM
// Since package.json has "type": "module", we're in ESM context
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface WithRevealUIOptions {
  /** Path to the RevealUI config file (relative to Next.js project root) */
  configPath?: string;
  /** Whether to enable admin UI */
  admin?: boolean;
  /** Admin route path */
  adminRoute?: string;
  /** API route path */
  apiRoute?: string;
}

/**
 * Next.js configuration wrapper for RevealUI
 * Provides webpack aliases, environment variables, and build configuration
 *
 * MUST NOT alias the `@revealui/config` package specifier: that is a real
 * workspace package (type-safe env config). Aliasing it to the app's
 * revealui.config.ts shadows the package in every server bundle, so
 * `config.reveal` / `config.database` reads resolve against the CMS instance
 * config and come back undefined at runtime (prod admin passkey/MFA 500s,
 * 2026-06-10). Apps load their CMS config via relative imports or their own
 * `@reveal-config` alias instead.
 */
export function withRevealUI(
  nextConfig: NextConfig = {},
  options: WithRevealUIOptions = {},
): NextConfig {
  const {
    configPath = './revealui.config.ts',
    admin = true,
    adminRoute = '/admin',
    apiRoute = '/api',
  } = options;

  return {
    ...nextConfig,

    // Environment variables for RevealUI
    env: {
      ...nextConfig.env,
      REVEALUI_CONFIG_PATH: configPath,
      REVEALUI_ADMIN_ENABLED: admin.toString(),
      REVEALUI_ADMIN_ROUTE: adminRoute,
      REVEALUI_API_ROUTE: apiRoute,
    },

    // Webpack configuration (for Next.js < 15 or when not using Turbopack)
    webpack: (config, context) => {
      const { isServer, dev } = context;
      void isServer;
      void dev;

      // Apply any existing webpack config first
      if (nextConfig.webpack) {
        config = nextConfig.webpack(config, context);
      }

      // Add RevealUI-specific webpack aliases
      const resolve = (config.resolve || {}) as {
        alias?: Record<string, string>;
        modules?: string[];
      };
      config.resolve = resolve;
      resolve.alias = {
        ...resolve.alias,
        // RevealUI core aliases - resolve to source index file
        '@revealui/core': path.resolve(__dirname, '../index'),
      };

      // Also ensure it's in resolve.modules if needed (for some edge cases)
      if (!resolve.modules) {
        resolve.modules = ['node_modules'];
      }

      return config;
    },

    // Turbopack config passes through verbatim via the `...nextConfig` spread —
    // withRevealUI injects no resolveAlias entries (see the docstring constraint).

    // Headers for RevealUI
    async headers() {
      const existingHeaders = nextConfig.headers ? await nextConfig.headers() : [];

      return [
        ...existingHeaders,
        // RevealUI admin headers
        ...(admin
          ? [
              {
                source: `${adminRoute}/:path*`,
                headers: [
                  {
                    key: 'X-Frame-Options',
                    value: 'SAMEORIGIN',
                  },
                  {
                    key: 'X-Content-Type-Options',
                    value: 'nosniff',
                  },
                ],
              },
            ]
          : []),
      ];
    },

    // Images configuration for RevealUI
    images: {
      ...nextConfig.images,
      // Add RevealUI-specific image domains if needed
      remotePatterns: [
        ...(nextConfig.images?.remotePatterns || []),
        // Add any RevealUI-specific image domains here
      ],
    },
  };
}
