/**
 * SSL Configuration Utility
 *
 * Re-exports from @revealui/utils to maintain backward compatibility.
 * The actual implementation has been moved to @revealui/utils to break circular dependencies.
 */

export type { SSLConfig } from '@revealui/utils/database'
export { getSSLConfig, validateSSLConfig } from '@revealui/utils/database'
