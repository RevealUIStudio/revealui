/**
 * Vite configuration wrapper for RevealUI dual-mode apps.
 *
 * Sibling of `@revealui/core/nextjs/withRevealUI` for the GAP-194 admin port
 * (Phase 3 Tier 0 step 3.0). Config-time only — import from
 * `@revealui/core/vite/withRevealUI` in `vite.config.ts`, never from the
 * package root (keeps Node path helpers out of app runtime graphs).
 *
 * MUST NOT alias the `@revealui/config` package specifier: that is a real
 * workspace package (type-safe env config). Aliasing it to the app's
 * revealui.config.ts shadows the package in every SSR bundle (prod
 * passkey/MFA 500s, 2026-06-10). Apps load CMS config via relative imports
 * or their own `@reveal-config` alias.
 *
 * Path-scoped headers (admin-only CSP, CSRF) belong in the request layer
 * (`packages/router/docs/REQUEST-LAYER.md`), not Vite's global
 * `server.headers`. When `admin` is true this helper only injects a baseline
 * pair on dev/preview servers for early dogfood.
 */

/**
 * Minimal Vite config surface used by withRevealUI.
 * Defined locally so `@revealui/core` does not depend on `vite` types.
 * Consumers pass their full UserConfig; we only read/merge these fields.
 */
export interface ViteUserConfig {
  define?: Record<string, unknown>;
  resolve?: {
    alias?: Record<string, string> | Array<{ find: string | RegExp; replacement: string }>;
    [key: string]: unknown;
  };
  server?: {
    headers?: Record<string, string>;
    [key: string]: unknown;
  };
  preview?: {
    headers?: Record<string, string>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface WithRevealUIOptions {
  /** Path to the RevealUI config file (relative to the Vite project root) */
  configPath?: string;
  /** Whether to enable admin UI env flags + baseline dev/preview headers */
  admin?: boolean;
  /** Admin route path (documented for consumers; request-layer owns path gates) */
  adminRoute?: string;
  /** API route path */
  apiRoute?: string;
}

const FORBIDDEN_CONFIG_ALIAS = '@revealui/config';

type ViteAlias = Record<string, string> | Array<{ find: string | RegExp; replacement: string }>;

function revealUIDefine(options: Required<WithRevealUIOptions>): Record<string, string> {
  return {
    'process.env.REVEALUI_CONFIG_PATH': JSON.stringify(options.configPath),
    'process.env.REVEALUI_ADMIN_ENABLED': JSON.stringify(options.admin.toString()),
    'process.env.REVEALUI_ADMIN_ROUTE': JSON.stringify(options.adminRoute),
    'process.env.REVEALUI_API_ROUTE': JSON.stringify(options.apiRoute),
  };
}

function assertNoConfigAlias(alias: ViteAlias | undefined): void {
  if (!alias) return;
  if (Array.isArray(alias)) {
    for (const entry of alias) {
      if (entry.find === FORBIDDEN_CONFIG_ALIAS) {
        throw new Error(
          'withRevealUI: do not alias @revealui/config to revealui.config.ts — ' +
            'that shadows the env-config package (use @reveal-config instead)',
        );
      }
    }
    return;
  }
  if (Object.hasOwn(alias, FORBIDDEN_CONFIG_ALIAS)) {
    throw new Error(
      'withRevealUI: do not alias @revealui/config to revealui.config.ts — ' +
        'that shadows the env-config package (use @reveal-config instead)',
    );
  }
}

function mergeHeaders(
  existing: Record<string, string> | undefined,
  inject: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!inject) return existing;
  return { ...existing, ...inject };
}

/**
 * Vite configuration wrapper for RevealUI.
 *
 * Injects `process.env.REVEALUI_*` via `define`, never aliases
 * `@revealui/config`, and optionally sets baseline X-Frame-Options /
 * X-Content-Type-Options on `server` + `preview` when admin is enabled.
 */
export function withRevealUI(
  viteConfig: ViteUserConfig = {},
  options: WithRevealUIOptions = {},
): ViteUserConfig {
  const resolved: Required<WithRevealUIOptions> = {
    configPath: options.configPath ?? './revealui.config.ts',
    admin: options.admin ?? true,
    adminRoute: options.adminRoute ?? '/admin',
    apiRoute: options.apiRoute ?? '/api',
  };

  assertNoConfigAlias(viteConfig.resolve?.alias);

  const adminHeaders: Record<string, string> | undefined = resolved.admin
    ? {
        'X-Frame-Options': 'SAMEORIGIN',
        'X-Content-Type-Options': 'nosniff',
      }
    : undefined;

  return {
    ...viteConfig,
    define: {
      ...viteConfig.define,
      ...revealUIDefine(resolved),
    },
    resolve: viteConfig.resolve
      ? {
          ...viteConfig.resolve,
          // Passthrough only — never inject @revealui/config (see module doc).
          alias: viteConfig.resolve.alias,
        }
      : viteConfig.resolve,
    server: {
      ...viteConfig.server,
      headers: mergeHeaders(viteConfig.server?.headers, adminHeaders),
    },
    preview: {
      ...viteConfig.preview,
      headers: mergeHeaders(viteConfig.preview?.headers, adminHeaders),
    },
  };
}
