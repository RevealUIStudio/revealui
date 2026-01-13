/**
 * Brute Force Protection
 *
 * Tracks failed login attempts and locks accounts after threshold.
 */

interface FailedAttempt {
  count: number
  lockUntil?: number
}

// In-memory store (reset on server restart)
// In production, use Redis or database
const failedAttemptsStore = new Map<string, FailedAttempt>()

export interface BruteForceConfig {
  maxAttempts: number
  lockDurationMs: number
  windowMs: number
}

const DEFAULT_CONFIG: BruteForceConfig = {
  maxAttempts: 5,
  lockDurationMs: 30 * 60 * 1000, // 30 minutes
  windowMs: 15 * 60 * 1000, // 15 minutes
}

/**
 * Records a failed login attempt
 *
 * @param email - User email
 * @param config - Brute force configuration
 */
export function recordFailedAttempt(
  email: string,
  config: BruteForceConfig = DEFAULT_CONFIG
): void {
  const now = Date.now()
  const entry = failedAttemptsStore.get(email) || { count: 0 }

  // Reset if lock expired
  if (entry.lockUntil && entry.lockUntil < now) {
    entry.count = 0
    entry.lockUntil = undefined
  }

  entry.count++

  // Lock account if threshold reached
  if (entry.count >= config.maxAttempts) {
    entry.lockUntil = now + config.lockDurationMs
  }

  failedAttemptsStore.set(email, entry)

  // Clean up old entries (older than window)
  setTimeout(() => {
    const currentEntry = failedAttemptsStore.get(email)
    if (currentEntry && !currentEntry.lockUntil && currentEntry.count > 0) {
      const elapsed = now - (currentEntry.lockUntil || now - config.windowMs)
      if (elapsed > config.windowMs) {
        failedAttemptsStore.delete(email)
      }
    }
  }, config.windowMs)
}

/**
 * Clears failed attempts for an email (on successful login)
 *
 * @param email - User email
 */
export function clearFailedAttempts(email: string): void {
  failedAttemptsStore.delete(email)
}

/**
 * Checks if account is locked due to brute force attempts
 *
 * @param email - User email
 * @param config - Brute force configuration
 * @returns True if locked, false otherwise
 */
export function isAccountLocked(
  email: string,
  config: BruteForceConfig = DEFAULT_CONFIG
): { locked: boolean; lockUntil?: number; attemptsRemaining: number } {
  const now = Date.now()
  const entry = failedAttemptsStore.get(email)

  if (!entry) {
    return {
      locked: false,
      attemptsRemaining: config.maxAttempts,
    }
  }

  // Check if lock expired
  if (entry.lockUntil && entry.lockUntil < now) {
    failedAttemptsStore.delete(email)
    return {
      locked: false,
      attemptsRemaining: config.maxAttempts,
    }
  }

  if (entry.lockUntil) {
    return {
      locked: true,
      lockUntil: entry.lockUntil,
      attemptsRemaining: 0,
    }
  }

  return {
    locked: false,
    attemptsRemaining: Math.max(0, config.maxAttempts - entry.count),
  }
}

/**
 * Gets failed attempt count for an email
 *
 * @param email - User email
 * @returns Failed attempt count
 */
export function getFailedAttemptCount(email: string): number {
  const entry = failedAttemptsStore.get(email)
  return entry?.count || 0
}
