/**
 * @revealui/config - Type-Safe Environment Configuration
 *
 * Centralized, type-safe environment variable configuration with runtime validation
 *
 * ## Limitations
 *
 * ### TypeScript Proxy Limitations
 * - TypeScript has limited support for Proxy types. The config object uses a Proxy
 *   for lazy loading, which means some TypeScript operations may not work as expected.
 * - Symbol property access requires type assertions (`as any`) due to TypeScript limitations.
 *   This is a known limitation - TypeScript cannot properly type symbol indexing on Proxy objects.
 * - Property access uses `as unknown as Record<string, unknown>` for type safety. This double
 *   cast is necessary because TypeScript cannot infer that a Proxy property access returns
 *   the correct type. The `unknown` intermediate step ensures type safety while allowing
 *   the property access to work correctly.
 *
 * ### Lazy Loading Behavior
 * - Validation occurs on first property access (e.g., `config.database.url`).
 * - The `in` operator (`'database' in config`) does NOT trigger validation for known properties.
 * - Unknown property checks with `in` return `false` without validation (truly lazy).
 * - `Object.keys(config)` returns known keys without validation.
 * - `Object.getOwnPropertyDescriptor(config, 'database')` returns a getter descriptor without validation.
 * - Build-time detection allows lenient validation during Next.js builds.
 *
 * ### ESM Compatibility
 * - This module uses ESM (ES Modules) exclusively.
 * - Direct imports are safe because validation is lazy (Proxy-based).
 * - All consuming code should use ESM imports, not CommonJS `require()`.
 *
 * ### Build-Time vs Runtime
 * - During builds (detected via `NEXT_PHASE` or `SKIP_ENV_VALIDATION`), lenient mode is used.
 * - At runtime, full validation is required - all environment variables must be set.
 * - Attempting to use lenient mode at runtime will throw an error.
 */

import { loadEnvironment } from './loader.js';
import { type BrandingConfig, getBrandingConfig } from './modules/branding.js';
import { type DatabaseConfig, getDatabaseConfig } from './modules/database.js';
import {
  type DevToolsConfig,
  getOptionalConfig,
  type OptionalConfig,
  type SentryConfig,
  type SupabaseConfig,
} from './modules/optional.js';
import { getRevealConfig, type RevealConfig } from './modules/reveal.js';
import { getStorageConfig, type StorageConfig } from './modules/storage.js';
import { getStripeConfig, type StripeConfig } from './modules/stripe.js';
import type { EnvConfig } from './schema.js';
import { formatValidationErrors, validateAndThrow, validateEnvVars } from './validator.js';

// =============================================================================
// Main Config Interface
// =============================================================================

export interface Config {
  database: DatabaseConfig;
  stripe: StripeConfig;
  storage: StorageConfig;
  reveal: RevealConfig;
  branding: BrandingConfig;
  optional: OptionalConfig;
  // Direct access to raw env (for edge cases)
  env: EnvConfig;
}

// =============================================================================
// Config Creation
// =============================================================================

let cachedConfig: Config | null = null;

/**
 * Single placeholder string used for every build-time env fallback in
 * `createConfig`. Intentionally unmistakable to human reviewers and secret
 * scanners (Gitleaks, TruffleHog) so a grep for this file never reads as
 * "oh, that's a credential." The `isBuildTime()` throw below prevents these
 * values from ever reaching a request-handling context at runtime.
 *
 * Must be at least 32 characters to satisfy `secretSchema` in schema.ts.
 */
const BUILD_PLACEHOLDER = '__REVEALUI_BUILD_ONLY_NOT_A_SECRET__';

/**
 * Check if we're in a build-time context where full validation isn't required
 */
function isBuildTime(): boolean {
  // Recognized build-time contexts  -  env vars are not yet populated.
  const isNextBuild =
    process.env.NEXT_PHASE === 'phase-production-build' ||
    process.env.NEXT_PHASE === 'phase-development-build';
  const isTestEnv = process.env.NODE_ENV === 'test';

  // SKIP_ENV_VALIDATION is only valid when a recognized build context is active
  // or when running tests.  If it appears in any other context (production runtime,
  // Hono API server, Docker containers) the BUILD_PLACEHOLDER values would be
  // used at runtime  -  making JWTs trivially forgeable and Stripe calls fail.
  if (process.env.SKIP_ENV_VALIDATION === 'true' && !isNextBuild && !isTestEnv) {
    throw new Error(
      'SKIP_ENV_VALIDATION=true is only valid during Next.js build phases (NEXT_PHASE) or ' +
        'in test environments (NODE_ENV=test). Remove it from all other environments  -  ' +
        'using it at runtime exposes build-time placeholder values in production.',
    );
  }

  return isNextBuild || process.env.SKIP_ENV_VALIDATION === 'true';
}

/**
 * Create typed config object from environment variables
 * Validates and throws if invalid (unless in build-time context)
 */
function createConfig(strict: boolean = true): Config {
  const envVars = loadEnvironment();
  const isBuild = isBuildTime();

  // Runtime guard: prevent using lenient mode at runtime
  if (!(strict || isBuild)) {
    throw new Error(
      'Cannot use lenient config mode at runtime. ' +
        'Set SKIP_ENV_VALIDATION=true only during builds. ' +
        'At runtime, all required environment variables must be set.',
    );
  }

  // During build time, use lenient validation (only check format, not presence)
  if (!strict && isBuild) {
    // For builds, create config with fallbacks - validation happens at runtime.
    // Every fallback uses BUILD_PLACEHOLDER (see top of file); Stripe fallbacks
    // keep their `sk_test_` / `whsec_` / `pk_test_` prefixes so the dev-env
    // sanity validator in schema.ts does not emit "use test key in development"
    // warnings during builds.
    const partialEnv = {
      REVEALUI_SECRET: envVars.REVEALUI_SECRET || BUILD_PLACEHOLDER,
      REVEALUI_PUBLIC_SERVER_URL: envVars.REVEALUI_PUBLIC_SERVER_URL || 'http://localhost:4000',
      NEXT_PUBLIC_SERVER_URL:
        envVars.NEXT_PUBLIC_SERVER_URL ||
        envVars.REVEALUI_PUBLIC_SERVER_URL ||
        'http://localhost:4000',
      POSTGRES_URL: envVars.POSTGRES_URL || envVars.DATABASE_URL || '',
      BLOB_READ_WRITE_TOKEN: envVars.BLOB_READ_WRITE_TOKEN || '',
      STRIPE_SECRET_KEY: envVars.STRIPE_SECRET_KEY || `sk_test_${BUILD_PLACEHOLDER}`,
      STRIPE_WEBHOOK_SECRET: envVars.STRIPE_WEBHOOK_SECRET || `whsec_${BUILD_PLACEHOLDER}`,
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
        envVars.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || `pk_test_${BUILD_PLACEHOLDER}`,
      ...envVars,
    } as EnvConfig;

    return {
      database: getDatabaseConfig(partialEnv),
      stripe: getStripeConfig(partialEnv),
      storage: getStorageConfig(partialEnv),
      reveal: getRevealConfig(partialEnv),
      branding: getBrandingConfig(partialEnv),
      optional: getOptionalConfig(partialEnv),
      env: partialEnv,
    };
  }

  // Runtime: Full validation
  const validatedEnv = validateAndThrow(envVars);

  return {
    database: getDatabaseConfig(validatedEnv),
    stripe: getStripeConfig(validatedEnv),
    storage: getStorageConfig(validatedEnv),
    reveal: getRevealConfig(validatedEnv),
    branding: getBrandingConfig(validatedEnv),
    optional: getOptionalConfig(validatedEnv),
    env: validatedEnv,
  };
}

// =============================================================================
// Singleton Config Instance
// =============================================================================

/**
 * Get the validated, type-safe config object
 * Validates on first access, then caches the result
 *
 * @param strict - If false, allows build-time lenient validation (default: true for runtime)
 */
export function getConfig(strict: boolean = true): Config {
  if (!cachedConfig) {
    cachedConfig = createConfig(strict);
  }
  return cachedConfig;
}

/**
 * Reset the cached config (useful for testing)
 */
export function resetConfig(): void {
  cachedConfig = null;
}

// =============================================================================
// Default Export (Lazy)
// =============================================================================

/**
 * Default export: validated, type-safe config object
 * Validates on first access (lazy), not on import
 * This allows the module to be imported during builds without immediate validation
 */
// Helper to ensure config is initialized
function ensureConfig(): Config {
  if (!cachedConfig) {
    const isBuild = isBuildTime();
    // Use lenient mode (strict=false) during builds, strict mode (strict=true) at runtime
    cachedConfig = createConfig(!isBuild);
  }
  return cachedConfig;
}

const configProxy = new Proxy({} as Config, {
  get(_target, prop: string | symbol) {
    // Lazy initialization - only validate when actually accessed
    const config = ensureConfig();

    // Type-safe property access
    if (typeof prop === 'string' && prop in config) {
      return (config as unknown as Record<string, unknown>)[prop];
    }

    // Handle symbol keys (e.g., Symbol.iterator, Symbol.toStringTag)
    if (typeof prop === 'symbol') {
      // Symbols require type assertion as TypeScript doesn't support symbol indexing well
      // This is a documented TypeScript limitation - see file header comments (lines 9-16)
      return (config as unknown as Record<symbol, unknown>)[prop];
    }

    return undefined;
  },
  ownKeys() {
    // Truly lazy: return known keys without initializing config
    // This allows Object.keys(config) without triggering validation
    if (cachedConfig) {
      return Object.keys(cachedConfig);
    }

    // Return known properties from Config interface without validation
    return ['database', 'stripe', 'storage', 'reveal', 'branding', 'optional', 'env'];
  },
  has(_target, prop) {
    // Truly lazy: check if property exists on Config interface without initializing
    // This allows 'database' in config checks without triggering validation
    if (cachedConfig) {
      return prop in cachedConfig;
    }

    // Known properties from Config interface - return true without initializing
    const knownProps = ['database', 'stripe', 'storage', 'reveal', 'branding', 'optional', 'env'];
    if (typeof prop === 'string' && knownProps.includes(prop)) {
      return true;
    }

    // For unknown properties, return false without initializing
    // Unknown properties don't exist on the Config interface, so safe to return false
    return false;
  },
  getOwnPropertyDescriptor(_target, prop) {
    // Truly lazy: for known properties, return descriptor without initializing
    if (cachedConfig) {
      return Object.getOwnPropertyDescriptor(cachedConfig, prop);
    }

    // For known properties, return a descriptor without initializing
    // Use a getter to indicate the property exists but value is lazy
    const knownProps = ['database', 'stripe', 'storage', 'reveal', 'branding', 'optional', 'env'];
    if (typeof prop === 'string' && knownProps.includes(prop)) {
      // Return a descriptor with a getter that will be called when value is accessed
      // This indicates the property exists without initializing the config
      return {
        enumerable: true,
        configurable: true,
        get: () => {
          // When the getter is called, initialize and return the actual value
          const config = ensureConfig();
          return (config as unknown as Record<string, unknown>)[prop];
        },
      };
    }

    // For unknown properties, return undefined (property doesn't exist)
    // This avoids initializing config just to check for non-existent properties
    return undefined;
  },
  defineProperty(_target, prop, descriptor) {
    // Need to initialize to define property
    const config = ensureConfig();
    Object.defineProperty(config, prop, descriptor);
    return true;
  },
  deleteProperty(_target, prop: string | symbol) {
    const config = ensureConfig();
    // Type-safe delete for string keys
    if (typeof prop === 'string' && prop in config) {
      return Reflect.deleteProperty(config as unknown as Record<string, unknown>, prop);
    }
    // Symbols require type assertion
    // This is a documented TypeScript limitation - see file header comments (lines 9-16)
    if (typeof prop === 'symbol') {
      return Reflect.deleteProperty(config as unknown as Record<symbol, unknown>, prop);
    }
    return false;
  },
  getPrototypeOf() {
    return Object.prototype;
  },
  setPrototypeOf() {
    // Prevent prototype changes
    return false;
  },
});

export default configProxy;

export type { Environment } from './loader.js';
// Export loader utilities (for advanced usage)
export { detectEnvironment, loadEnvironment } from './loader.js';
// Export module-level config getters (documented in docs/REFERENCE.md as standalone helpers)
export { getDatabaseConfig } from './modules/database.js';
export { getRevealConfig } from './modules/reveal.js';
export { getStripeConfig } from './modules/stripe.js';
// Export shared RevealUI configuration functions
export {
  getSharedCMSConfig,
  getSharedNextJSConfig,
  getSharedViteConfig,
  getSharedWebConfig,
  sharedConfig,
} from './revealui.config.js';
// Export types (Config is already exported as interface above)
export type {
  BrandingConfig,
  DatabaseConfig,
  DevToolsConfig,
  EnvConfig,
  OptionalConfig,
  RevealConfig,
  SentryConfig,
  StorageConfig,
  StripeConfig,
  SupabaseConfig,
};
// Export validation functions
export { formatValidationErrors, validateAndThrow, validateEnvVars };
