/**
 * Environment variable validation
 */

export interface EnvVariable {
  name: string;
  description: string;
  required: boolean;
  validator?: (value: string) => boolean;
}

export interface ValidationResult {
  valid: boolean;
  missing: string[];
  invalid: string[];
}

/**
 * Validates environment variables against required schema.
 *
 * @param required - Array of required environment variable definitions
 * @param env - Environment variable object to validate
 * @returns Validation result
 *
 * @example
 * ```typescript
 * const result = validateEnv([
 *   { name: 'DB_URL', description: 'Database URL', required: true }
 * ], process.env)
 * ```
 */
export function validateEnv(
  required: EnvVariable[],
  env: Record<string, string | undefined>,
): ValidationResult {
  const missing: string[] = [];
  const invalid: string[] = [];

  for (const variable of required) {
    const value = env[variable.name];

    // Check if required variable is missing
    if (variable.required && (!value || value.trim() === '')) {
      missing.push(variable.name);
      continue;
    }

    // Check if value passes custom validator
    if (value && variable.validator && !variable.validator(value)) {
      invalid.push(variable.name);
    }
  }

  return {
    valid: missing.length === 0 && invalid.length === 0,
    missing,
    invalid,
  };
}

/**
 * Common environment variable validators
 */
export const validators = {
  /**
   * Validates PostgreSQL connection string format
   */
  postgresUrl: (value: string): boolean => {
    try {
      const url = new URL(value);
      return url.protocol === 'postgresql:' || url.protocol === 'postgres:';
    } catch {
      return false;
    }
  },

  /**
   * Validates Stripe secret key format
   */
  stripeSecretKey: (value: string): boolean => {
    return value.startsWith('sk_test_') || value.startsWith('sk_live_');
  },

  /**
   * Validates Stripe publishable key format
   */
  stripePublishableKey: (value: string): boolean => {
    return value.startsWith('pk_test_') || value.startsWith('pk_live_');
  },

  /**
   * Validates URL format
   */
  url: (value: string): boolean => {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Validates minimum length
   */
  minLength:
    (min: number) =>
    (value: string): boolean => {
      return value.length >= min;
    },

  /**
   * Validates email format
   */
  email: (value: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  },
};

/**
 * Common required environment variables for RevealUI
 */
export const REQUIRED_ENV_VARS: EnvVariable[] = [
  {
    name: 'REVEALUI_SECRET',
    description: 'Secret key for JWT tokens and session encryption (min 32 chars)',
    required: true,
    validator: validators.minLength(32),
  },
  {
    name: 'POSTGRES_URL',
    description: 'PostgreSQL connection string',
    required: true,
    validator: validators.postgresUrl,
  },
  {
    name: 'BLOB_READ_WRITE_TOKEN',
    description: 'Vercel Blob storage token',
    required: true,
  },
  {
    name: 'STRIPE_SECRET_KEY',
    description: 'Stripe secret key (sk_test_... or sk_live_...)',
    required: true,
    validator: validators.stripeSecretKey,
  },
  {
    name: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
    description: 'Stripe publishable key (pk_test_... or pk_live_...)',
    required: true,
    validator: validators.stripePublishableKey,
  },
];

/**
 * Optional environment variables
 */
export const OPTIONAL_ENV_VARS: EnvVariable[] = [
  {
    name: 'STRIPE_WEBHOOK_SECRET',
    description: 'Stripe webhook secret (whsec_...)',
    required: false,
  },
  {
    name: 'NEXT_PUBLIC_SUPABASE_URL',
    description: 'Supabase project URL',
    required: false,
    validator: validators.url,
  },
  {
    name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    description: 'Supabase anonymous key',
    required: false,
  },
  {
    name: 'REVEALUI_ADMIN_EMAIL',
    description: 'Initial admin email',
    required: false,
    validator: validators.email,
  },
  {
    name: 'REVEALUI_ADMIN_PASSWORD',
    description: 'Initial admin password (min 12 chars)',
    required: false,
    validator: validators.minLength(12),
  },
];
