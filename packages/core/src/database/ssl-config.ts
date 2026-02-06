/**
 * SSL Configuration Utility
 *
 * Provides centralized SSL configuration for PostgreSQL connections based on
 * connection string sslmode parameter and environment variables.
 *
 * @module ssl-config
 */

/**
 * PostgreSQL SSL configuration options
 */
export interface SSLConfig {
  rejectUnauthorized: boolean
}

/**
 * Determines the appropriate SSL configuration for a PostgreSQL connection
 * based on the connection string's sslmode parameter.
 *
 * SSL Modes (aligned with PostgreSQL libpq standards):
 * - `disable`: No SSL connection
 * - `require`: SSL connection with certificate verification
 * - `verify-full`: Full SSL verification (same as require in pg v9+)
 * - `verify-ca`: CA verification (treated as verify-full)
 *
 * Environment Override:
 * - `DATABASE_SSL_REJECT_UNAUTHORIZED=false`: Force skip certificate verification
 *   (DEVELOPMENT ONLY - use for self-signed certificates in local environments)
 *
 * @param connectionString - PostgreSQL connection string (may include sslmode parameter)
 * @returns SSL configuration object or false to disable SSL
 *
 * @example
 * ```typescript
 * // Connection string with SSL required
 * const ssl = getSSLConfig('postgresql://user:pass@host/db?sslmode=require')
 * // Returns: { rejectUnauthorized: true }
 *
 * // Connection string without SSL
 * const ssl = getSSLConfig('postgresql://localhost:5432/db')
 * // Returns: false
 *
 * // Development override for self-signed certificates
 * process.env.DATABASE_SSL_REJECT_UNAUTHORIZED = 'false'
 * const ssl = getSSLConfig('postgresql://user:pass@host/db?sslmode=require')
 * // Returns: { rejectUnauthorized: false }
 * ```
 */
export function getSSLConfig(connectionString: string): SSLConfig | false {
  try {
    // Parse connection string
    const url = new URL(connectionString)
    const sslmode = url.searchParams.get('sslmode')

    // No SSL if sslmode is explicitly disabled or not specified
    if (!sslmode || sslmode === 'disable') {
      return false
    }

    // Environment override for local development with self-signed certificates
    // This should ONLY be used in development environments
    // SECURITY: Explicitly check NODE_ENV to prevent accidental use in production
    if (
      process.env.NODE_ENV !== 'production' &&
      process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'false'
    ) {
      return { rejectUnauthorized: false }
    }

    // Default: verify certificates (security best practice)
    // Handles: require, verify-full, verify-ca, prefer
    // In pg v9+, these will all use verify-full semantics
    return { rejectUnauthorized: true }
  } catch (_error) {
    // If URL parsing fails, assume local connection without SSL
    // Silently fallback to no SSL for invalid connection strings
    return false
  }
}

/**
 * Validates SSL configuration for production environments.
 * Warns if insecure SSL settings are detected in production.
 *
 * @param connectionString - PostgreSQL connection string
 * @param environment - Current environment (e.g., 'production', 'development')
 */
export function validateSSLConfig(
  connectionString: string,
  environment: string = process.env.NODE_ENV || 'development',
): boolean {
  const sslConfig = getSSLConfig(connectionString)

  // Check if SSL is disabled in production
  if (environment === 'production' && sslConfig === false) {
    return false // SSL disabled in production - security risk
  }

  // Check if certificate verification is disabled in production
  if (environment === 'production' && sslConfig && !sslConfig.rejectUnauthorized) {
    return false // Certificate verification disabled - security risk
  }

  return true // SSL configuration is valid
}
