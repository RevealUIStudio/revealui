/**
 * SSL Configuration Utility for Scripts
 *
 * Provides centralized SSL configuration for PostgreSQL connections based on
 * connection string sslmode parameter and environment variables.
 *
 * Note: This is a copy of the core SSL config utility for use in scripts.
 * Scripts cannot import from @revealui/core due to build dependencies.
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
 * @param connectionString - PostgreSQL connection string (may include sslmode parameter)
 * @returns SSL configuration object or false to disable SSL, or undefined for default behavior
 */
export function getSSLConfig(connectionString: string): SSLConfig | false | undefined {
  try {
    // Parse connection string
    const url = new URL(connectionString)
    const sslmode = url.searchParams.get('sslmode')

    // No SSL if sslmode is explicitly disabled
    if (sslmode === 'disable') {
      return false
    }

    // No sslmode specified - return undefined to use driver defaults
    if (!sslmode) {
      return undefined
    }

    // Environment override for local development with self-signed certificates
    // This should ONLY be used in development environments
    if (process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'false') {
      return { rejectUnauthorized: false }
    }

    // Default: verify certificates (security best practice)
    // Handles: require, verify-full, verify-ca, prefer
    return { rejectUnauthorized: true }
  } catch (_error) {
    // If URL parsing fails, assume local connection - return undefined for defaults
    // Silently fallback to driver defaults for invalid connection strings
    return undefined
  }
}
