/**
 * Brute Force Protection
 *
 * Tracks failed login attempts and locks accounts after threshold.
 * Uses storage abstraction (Redis, database, or in-memory).
 */

import { getStorage } from './storage/index.js';

interface FailedAttempt {
  count: number;
  lockUntil?: number;
  windowStart: number;
}

export interface BruteForceConfig {
  maxAttempts: number;
  lockDurationMs: number;
  windowMs: number;
}

const DEFAULT_CONFIG: BruteForceConfig = {
  maxAttempts: 5,
  lockDurationMs: 30 * 60 * 1000, // 30 minutes
  windowMs: 15 * 60 * 1000, // 15 minutes
};

/**
 * Serialize failed attempt entry
 */
function serializeEntry(entry: FailedAttempt): string {
  return JSON.stringify(entry);
}

/**
 * Deserialize failed attempt entry
 */
function deserializeEntry(data: string | null): FailedAttempt | null {
  if (!data) {
    return null;
  }

  try {
    return JSON.parse(data) as FailedAttempt;
  } catch {
    return null;
  }
}

/**
 * Get storage key for failed attempts
 */
function getStorageKey(email: string): string {
  return `brute_force:${email}`;
}

/**
 * Records a failed login attempt
 *
 * @param email - User email
 * @param config - Brute force configuration
 */
export async function recordFailedAttempt(
  email: string,
  config: BruteForceConfig = DEFAULT_CONFIG,
): Promise<void> {
  const storage = getStorage();
  const storageKey = getStorageKey(email);

  const updater = (entryData: string | null): { value: string; ttlSeconds: number } => {
    const now = Date.now();
    const entry = deserializeEntry(entryData) || { count: 0, windowStart: now };

    // Reset if lock expired
    if (entry.lockUntil && entry.lockUntil < now) {
      entry.count = 0;
      entry.lockUntil = undefined;
      entry.windowStart = now;
    }

    // Reset if window expired
    if (now - entry.windowStart > config.windowMs) {
      entry.count = 0;
      entry.windowStart = now;
    }

    entry.count++;

    // Lock account if threshold reached
    if (entry.count >= config.maxAttempts) {
      entry.lockUntil = now + config.lockDurationMs;
    }

    const ttlSeconds = Math.ceil(
      Math.max(config.windowMs, entry.lockUntil ? entry.lockUntil - now : config.windowMs) / 1000,
    );
    return { value: serializeEntry(entry), ttlSeconds };
  };

  if (storage.atomicUpdate) {
    await storage.atomicUpdate(storageKey, updater);
  } else {
    // Fallback for storage backends that don't support atomic updates
    const existing = await storage.get(storageKey);
    const { value, ttlSeconds } = updater(existing);
    await storage.set(storageKey, value, ttlSeconds);
  }
}

/**
 * Clears failed attempts for an email (on successful login)
 *
 * @param email - User email
 */
export async function clearFailedAttempts(email: string): Promise<void> {
  const storage = getStorage();
  const storageKey = getStorageKey(email);
  await storage.del(storageKey);
}

/**
 * Checks if account is locked due to brute force attempts
 *
 * @param email - User email
 * @param config - Brute force configuration
 * @returns Lock status
 */
export async function isAccountLocked(
  email: string,
  config: BruteForceConfig = DEFAULT_CONFIG,
): Promise<{ locked: boolean; lockUntil?: number; attemptsRemaining: number }> {
  const storage = getStorage();
  const storageKey = getStorageKey(email);
  const now = Date.now();

  const entryData = await storage.get(storageKey);
  const entry = deserializeEntry(entryData);

  if (!entry) {
    return {
      locked: false,
      attemptsRemaining: config.maxAttempts,
    };
  }

  // Check if lock expired
  if (entry.lockUntil && entry.lockUntil < now) {
    await storage.del(storageKey);
    return {
      locked: false,
      attemptsRemaining: config.maxAttempts,
    };
  }

  // Check if window expired
  if (now - entry.windowStart > config.windowMs) {
    await storage.del(storageKey);
    return {
      locked: false,
      attemptsRemaining: config.maxAttempts,
    };
  }

  if (entry.lockUntil) {
    return {
      locked: true,
      lockUntil: entry.lockUntil,
      attemptsRemaining: 0,
    };
  }

  return {
    locked: false,
    attemptsRemaining: Math.max(0, config.maxAttempts - entry.count),
  };
}

/**
 * Gets failed attempt count for an email
 *
 * @param email - User email
 * @returns Failed attempt count
 */
export async function getFailedAttemptCount(email: string): Promise<number> {
  const storage = getStorage();
  const storageKey = getStorageKey(email);

  const entryData = await storage.get(storageKey);
  const entry = deserializeEntry(entryData);

  return entry?.count || 0;
}
