/**
 * Environment Variable Validation for admin App
 *
 * Lightweight validation that can be imported without bundling script dependencies.
 * Validates critical environment variables at startup.
 */

/**
 * Validate required environment variables
 *
 * @param options - Validation options
 * @returns Object with validation result and missing variables
 */
export function validateRequiredEnvVars(
  options: {
    /**
     * Whether to fail on missing variables (throw error) or just return result
     * @default false (returns result, doesn't throw)
     */
    failOnMissing?: boolean;

    /**
     * Environment (affects which variables are required)
     */
    environment?: string;
  } = {},
): {
  valid: boolean;
  missing: string[];
  warnings: string[];
} {
  const { failOnMissing = false, environment } = options;

  // Base required variables
  const baseRequired: string[] = ['REVEALUI_SECRET', 'REVEALUI_PUBLIC_SERVER_URL', 'POSTGRES_URL'];

  const missing: string[] = [];
  const warnings: string[] = [];

  // Check required variables
  for (const key of baseRequired) {
    // Special handling for POSTGRES_URL - also check DATABASE_URL
    if (key === 'POSTGRES_URL') {
      if (!(process.env.POSTGRES_URL || process.env.DATABASE_URL)) {
        missing.push(key);
      } else if (process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
        warnings.push(
          'Using DATABASE_URL instead of POSTGRES_URL (consider standardizing to POSTGRES_URL)',
        );
      }
    } else if (!process.env[key]) {
      missing.push(key);
    }
  }

  // Validate formats
  if (process.env.REVEALUI_SECRET && process.env.REVEALUI_SECRET.length < 32) {
    if (environment === 'production') {
      missing.push('REVEALUI_SECRET (must be at least 32 characters in production)');
    } else {
      warnings.push('REVEALUI_SECRET should be at least 32 characters');
    }
  }

  // Check URLs have protocol and no trailing whitespace
  const urlVars = ['REVEALUI_PUBLIC_SERVER_URL', 'NEXT_PUBLIC_SERVER_URL'];
  for (const key of urlVars) {
    const url = process.env[key];
    if (url) {
      if (url !== url.trim()) {
        warnings.push(`${key} has leading/trailing whitespace (will be auto-trimmed at runtime)`);
      }
      const trimmed = url.trim();
      if (trimmed && !trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
        warnings.push(`${key} should start with http:// or https://`);
      }
    }
  }

  // Production-specific validations
  if (environment === 'production') {
    if (
      process.env.REVEALUI_PUBLIC_SERVER_URL &&
      !process.env.REVEALUI_PUBLIC_SERVER_URL.startsWith('https://')
    ) {
      const error = 'Production REVEALUI_PUBLIC_SERVER_URL must use HTTPS';
      if (failOnMissing) {
        throw new Error(error);
      }
      warnings.push(error);
    }

    // SESSION_COOKIE_DOMAIN is required in production for cross-subdomain auth.
    // Without it, sign-in throws at request time instead of at startup.
    if (!process.env.SESSION_COOKIE_DOMAIN) {
      missing.push('SESSION_COOKIE_DOMAIN');
    }

    // Stripe price IDs are required in production  -  without them, billing buttons
    // silently send priceId:'' which the API rejects with a 400, showing
    // "Failed to start checkout" to paying customers with no actionable error.
    const stripePriceVars = [
      'NEXT_PUBLIC_STRIPE_PRO_PRICE_ID',
      'NEXT_PUBLIC_STRIPE_MAX_PRICE_ID',
      'NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID',
    ];
    for (const key of stripePriceVars) {
      if (!process.env[key]) {
        missing.push(key);
      }
    }
  }

  const valid = missing.length === 0;

  if (failOnMissing && !valid) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return {
    valid,
    missing,
    warnings,
  };
}
