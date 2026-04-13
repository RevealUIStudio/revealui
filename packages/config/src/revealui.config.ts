/**
 * RevealUI Framework Configuration
 *
 * This is the unified configuration file for the RevealUI monorepo.
 * It provides shared configuration values that both the web (RevealUI) and admin (Next.js) apps can use.
 *
 * ## Usage
 *
 * ### Admin App (apps/admin/revealui.config.ts)
 * ```typescript
 * import { getSharedCMSConfig } from '@revealui/config/revealui'
 *
 * export default buildConfig({
 *   ...getSharedCMSConfig(),
 *   // App-specific config here
 * })
 * ```
 *
 * ### Web App (apps/mainframe/src/pages/+config.ts)
 * ```typescript
 * import { getSharedWebConfig } from '@revealui/config/revealui'
 *
 * const config: Config = {
 *   ...getSharedWebConfig(),
 *   // App-specific config here
 * }
 * ```
 *
 * @see https://reveal.dev/config
 */

/**
 * Require an env var in production. Falls back to a dev default otherwise.
 *
 * Validation is intentionally skipped during the following non-runtime phases:
 *   - `NEXT_PHASE === 'phase-production-build'` — Next.js production build
 *     (page-data collection imports route modules with `NODE_ENV=production`
 *     set by the build tool, even though no real request is being served).
 *   - `SKIP_ENV_VALIDATION === 'true'` — explicit opt-out for ad-hoc builds
 *     and tooling that doesn't have access to runtime secrets.
 *
 * This means a fresh clone can run `pnpm build` successfully without any env
 * vars configured, while still failing loudly at request time in production
 * if a required var is missing.
 */
function requireInProduction(name: string, devFallback: string): string {
  const value = process.env[name];
  if (value) return value;

  const isBuildPhase =
    process.env.NEXT_PHASE === 'phase-production-build' ||
    process.env.SKIP_ENV_VALIDATION === 'true';

  if (process.env.NODE_ENV === 'production' && !isBuildPhase) {
    throw new Error(
      `${name} is required in production. Set it in your environment or Vercel project settings.`,
    );
  }
  return devFallback;
}

/**
 * Shared configuration values used across both apps
 */
export const sharedConfig = {
  /**
   * Server URL - used by both admin and web apps
   */
  serverURL: requireInProduction('REVEALUI_PUBLIC_SERVER_URL', 'http://localhost:4000'),

  /**
   * Secret key - used by admin for encryption
   */
  secret: requireInProduction(
    'REVEALUI_SECRET',
    'INSECURE-DEV-ONLY-CHANGE-ME-SET-REVEALUI_SECRET-IN-PRODUCTION',
  ),

  /**
   * Base Reveal configuration
   * These settings apply globally across both apps
   */
  reveal: {
    prerender: {
      partial: false,
      parallel: 4,
      noExtraDir: false,
      disableAutoRun: false,
    },
    disableAutoFullBuild: false,
    baseServer: '/',
    baseAssets: '/',
    trailingSlash: false,
    disableUrlNormalization: false,
    redirects: {},
    crawl: {
      git: false, // Disable git-based crawling by default
    },
    includeAssetsImportedByServer: true,
  },

  /**
   * Environment-specific overrides
   */
  env: {
    development: {
      revealui: {
        prerender: false, // Disable prerender in development
      },
      reveal: {
        prerender: false,
      },
    },
    production: {
      revealui: {
        prerender: {
          partial: false,
          parallel: 4,
          noExtraDir: false,
        },
      },
      reveal: {
        prerender: {
          partial: false,
          parallel: 4,
        },
      },
    },
    test: {
      revealui: {
        prerender: false,
      },
    },
  },
} as const;

/**
 * Get shared configuration for admin app
 * Returns base config that can be extended in apps/admin/revealui.config.ts
 */
export function getSharedCMSConfig(): { serverURL: string; secret: string } {
  return {
    serverURL: sharedConfig.serverURL,
    secret: sharedConfig.secret,
  };
}

export interface SharedWebConfig {
  prerender: {
    partial: boolean;
    noExtraDir: boolean;
    parallel: number;
    disableAutoRun: boolean;
    [key: string]: unknown;
  };
  trailingSlash: boolean;
  baseServer: string;
  baseAssets: string;
  disableUrlNormalization: boolean;
  redirects: Record<string, never>;
}

/**
 * Get shared configuration for web app (RevealUI)
 * Returns base config that can be extended in apps/mainframe/src/pages/+config.ts
 *
 * @returns Partial RevealUI Config object with shared prerender and routing settings
 */
export function getSharedWebConfig(): SharedWebConfig {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isProduction = process.env.NODE_ENV === 'production';
  const isTest = process.env.NODE_ENV === 'test';

  // Apply environment-specific overrides
  const envConfig = isDevelopment
    ? sharedConfig.env.development
    : isProduction
      ? sharedConfig.env.production
      : isTest
        ? sharedConfig.env.test
        : null;

  const envPrerender = envConfig && 'revealui' in envConfig && envConfig.revealui?.prerender;

  return {
    prerender: {
      partial: sharedConfig.reveal.prerender.partial,
      noExtraDir: sharedConfig.reveal.prerender.noExtraDir,
      parallel: sharedConfig.reveal.prerender.parallel,
      disableAutoRun: sharedConfig.reveal.prerender.disableAutoRun,
      ...(typeof envPrerender === 'object' ? envPrerender : {}),
    },
    trailingSlash: sharedConfig.reveal.trailingSlash,
    baseServer: sharedConfig.reveal.baseServer,
    baseAssets: sharedConfig.reveal.baseAssets,
    disableUrlNormalization: sharedConfig.reveal.disableUrlNormalization,
    redirects: sharedConfig.reveal.redirects,
  };
}

/**
 * Get shared Vite configuration
 * Can be used in vite.config.ts files
 */
export function getSharedViteConfig(): { build: { sourcemap: boolean }; server: { port: number } } {
  return {
    build: {
      sourcemap: true,
    },
    server: {
      port: 3000, // Web app dev server port
    },
  };
}

/**
 * Get shared Next.js configuration
 * Can be used in next.config.mjs files
 */
export function getSharedNextJSConfig(): {
  output: 'standalone';
  serverExternalPackages: string[];
} {
  return {
    output: 'standalone' as const,
    serverExternalPackages: ['sharp', 'react-animate-height'],
  };
}

// Export default for backward compatibility (if needed)
// This is not used directly but kept for potential future use
export default {
  ...sharedConfig,
  getSharedCMSConfig,
  getSharedWebConfig,
  getSharedViteConfig,
  getSharedNextJSConfig,
};
