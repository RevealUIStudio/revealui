import fs from 'node:fs';
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
 * Sets up `@revealui/config` alias to import the RevealUI config file.
 * The alias works with both Webpack (Next.js < 15) and Turbopack (Next.js 16+).
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

  /**
   * Resolve config file path with validation
   * Attempts multiple extensions (.ts, .js, .mjs) if base path doesn't exist
   */
  const resolveConfigPath = (baseDir: string): string => {
    const basePath = path.isAbsolute(configPath) ? configPath : path.resolve(baseDir, configPath);

    // Try exact path first
    if (fs.existsSync(basePath)) {
      return basePath;
    }

    // Try with extensions if no extension provided
    const extensions = ['.ts', '', '.mjs'];
    const baseWithoutExt = path.parse(basePath);

    for (const ext of extensions) {
      const candidate = path.format({
        ...baseWithoutExt,
        base: undefined,
        ext: ext,
      });
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    // If not found, throw helpful error
    throw new Error(
      `RevealUI config file not found: ${basePath}\n` +
        `Searched for: ${basePath}, ${extensions.map((ext) => path.format({ ...baseWithoutExt, base: undefined, ext })).join(', ')}\n` +
        `Please ensure the config file exists or provide a valid configPath option.`,
    );
  };

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

      // Resolve config path at execution time (when webpack runs)
      // This ensures we're using the correct cwd for the Next.js project
      const projectRoot = context.dir || process.cwd();
      let resolvedConfigPath: string;

      try {
        resolvedConfigPath = resolveConfigPath(projectRoot);
      } catch (error) {
        // In development, warn but don't fail - allow for dynamic config creation
        if (dev) {
          // Lazy import logger to avoid ESM resolution issues at module load time
          import('../instance/logger.js')
            .then(({ defaultLogger }) => {
              defaultLogger.warn(error instanceof Error ? error.message : String(error));
            })
            .catch(() => {
              // Logger failed to load - silently continue (already falling back to default config path)
            });
          // Use fallback path
          resolvedConfigPath = path.isAbsolute(configPath)
            ? configPath
            : path.resolve(projectRoot, configPath);
        } else {
          // In production, fail fast
          throw error;
        }
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
        // Config alias - resolves to the actual config file path in the Next.js project
        // Use absolute path for reliable resolution
        '@revealui/config': resolvedConfigPath,
      };

      // Also ensure it's in resolve.modules if needed (for some edge cases)
      if (!resolve.modules) {
        resolve.modules = ['node_modules'];
      }

      return config;
    },

    // Turbopack configuration (Next.js 16+)
    // IMPORTANT: Turbopack's resolveAlias must be resolved at config evaluation time
    // Turbopack should read tsconfig.json paths, but we also set it explicitly here for reliability
    // If next.config.mjs already set @revealui/config, we respect it (it uses __dirname which is reliable).
    turbopack: {
      ...nextConfig.turbopack,
      resolveAlias: {
        // Start with existing aliases from next.config.mjs (which includes @revealui/config)
        ...nextConfig.turbopack?.resolveAlias,
        // RevealUI core aliases - use relative path for Turbopack compatibility
        // Don't set @revealui/core here - let next.config.mjs handle it via the @revealui alias
        // Ensure @revealui/config is set (next.config.mjs should have it, but ensure it's there)
        // Use the existing one if present (prefer relative path for Turbopack)
        // Otherwise resolve it to relative path from project root
        '@revealui/config':
          nextConfig.turbopack?.resolveAlias?.['@revealui/config'] ||
          (() => {
            // Prefer relative path for Turbopack (matches tsconfig.json format)
            if (!path.isAbsolute(configPath)) {
              return configPath;
            }
            // If absolute, convert to relative from project root
            try {
              const projectRoot = process.cwd();
              const resolved = resolveConfigPath(projectRoot);
              if (fs.existsSync(resolved)) {
                // Return relative path from project root
                return path.relative(projectRoot, resolved);
              }
            } catch {
              // Fall through to fallback
            }
            // Fallback: use configPath as-is (should be relative)
            return configPath;
          })(),
      },
    },

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
