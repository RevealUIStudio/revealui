/**
 * Session Entity Contract
 *
 * Manages authentication session lifecycle with security-critical validation.
 * Sessions can be persistent (7 days) or regular (1 day) with automatic expiration.
 *
 * Business Rules:
 * - Persistent sessions last 7 days
 * - Regular sessions last 1 day
 * - Sessions expire based on expiresAt timestamp
 * - Last activity tracked on each request
 * - Token hash stored (never plain token)
 * - Cascading deletion when user is deleted
 */

import { z } from 'zod/v4';

// =============================================================================
// Constants
// =============================================================================

export const SESSION_SCHEMA_VERSION = 1;

// Session duration constants (in milliseconds)
export const SESSION_DURATION = {
  REGULAR: 24 * 60 * 60 * 1000, // 1 day
  PERSISTENT: 7 * 24 * 60 * 60 * 1000, // 7 days
} as const;

// =============================================================================
// Base Session Schema
// =============================================================================

/**
 * Session object schema
 */
export const SessionObjectSchema = z.object({
  id: z.string().uuid(),
  schemaVersion: z.string().default(String(SESSION_SCHEMA_VERSION)),
  userId: z.string().uuid(),
  tokenHash: z.string().min(1, 'Token hash is required'),
  expiresAt: z.date(),
  userAgent: z.string().nullable().default(null),
  ipAddress: z.string().nullable().default(null),
  persistent: z.boolean().nullable().default(false),
  lastActivityAt: z.date(),
  createdAt: z.date(),
});

/**
 * Session schema with validation rules
 */
export const SessionBaseSchema = SessionObjectSchema.refine(
  (data) => {
    // Validate expiration is in the future (for new sessions)
    const now = new Date();
    return data.expiresAt > now;
  },
  {
    message: 'Session expiration must be in the future',
    path: ['expiresAt'],
  },
).refine(
  (data) => {
    // Validate token hash format (should be a hash, not plain text)
    return validateTokenHash(data.tokenHash);
  },
  {
    message: 'Token hash must be a valid SHA-256 or bcrypt hash',
    path: ['tokenHash'],
  },
);

export const SessionSchema = SessionBaseSchema;

// =============================================================================
// Insert Schema
// =============================================================================

/**
 * Schema for creating new sessions
 */
export const SessionInsertSchema = SessionObjectSchema.omit({
  id: true,
  createdAt: true,
  lastActivityAt: true,
}).extend({
  id: z.string().uuid().optional(),
  createdAt: z.date().optional(),
  lastActivityAt: z.date().optional(),
});

// =============================================================================
// Type Exports
// =============================================================================

export type Session = z.infer<typeof SessionSchema>;
export type SessionInsert = z.infer<typeof SessionInsertSchema>;

// =============================================================================
// Computed Fields
// =============================================================================

/**
 * Check if a session is expired
 */
export function isSessionExpired(session: Session): boolean {
  return session.expiresAt <= new Date();
}

/**
 * Check if a session is still valid (not expired)
 */
export function isSessionValid(session: Session): boolean {
  return !isSessionExpired(session);
}

/**
 * Calculate session duration based on persistent flag
 */
export function calculateSessionDuration(persistent: boolean): number {
  return persistent ? SESSION_DURATION.PERSISTENT : SESSION_DURATION.REGULAR;
}

/**
 * Calculate expiration date for a new session
 */
export function calculateExpiresAt(persistent: boolean, from: Date = new Date()): Date {
  const duration = calculateSessionDuration(persistent);
  return new Date(from.getTime() + duration);
}

/**
 * Check if session needs activity update (last activity > 5 minutes ago)
 */
export function needsActivityUpdate(session: Session, thresholdMinutes = 5): boolean {
  const threshold = thresholdMinutes * 60 * 1000;
  const timeSinceLastActivity = Date.now() - session.lastActivityAt.getTime();
  return timeSinceLastActivity > threshold;
}

/**
 * Get remaining session time in milliseconds
 */
export function getSessionTimeRemaining(session: Session): number {
  const now = Date.now();
  const expiresAt = session.expiresAt.getTime();
  return Math.max(0, expiresAt - now);
}

/**
 * Get session age in milliseconds
 */
export function getSessionAge(session: Session): number {
  const now = Date.now();
  const createdAt = session.createdAt.getTime();
  return now - createdAt;
}

/**
 * Check if session is nearing expiration (< 1 hour remaining)
 */
export function isSessionNearExpiration(session: Session, thresholdMinutes = 60): boolean {
  const threshold = thresholdMinutes * 60 * 1000;
  const remaining = getSessionTimeRemaining(session);
  return remaining > 0 && remaining < threshold;
}

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Check if a string is exactly 64 hex characters (SHA-256 hash)
 */
function isSha256Hex(s: string): boolean {
  if (s.length !== 64) return false;
  for (const ch of s) {
    const c = ch.charCodeAt(0);
    const isDigit = c >= 48 && c <= 57;
    const isLowerHex = c >= 97 && c <= 102;
    const isUpperHex = c >= 65 && c <= 70;
    if (!(isDigit || isLowerHex || isUpperHex)) return false;
  }
  return true;
}

/**
 * Validate session token hash format
 */
export function validateTokenHash(tokenHash: string): boolean {
  // SHA-256 hash (64 hex characters) or bcrypt hash (starts with $2)
  return isSha256Hex(tokenHash) || tokenHash.startsWith('$2');
}

/**
 * Check if a string is a valid IPv4 address
 */
function isValidIpv4(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  for (const part of parts) {
    if (part.length === 0 || part.length > 3) return false;
    for (const ch of part) {
      const c = ch.charCodeAt(0);
      if (c < 48 || c > 57) return false;
    }
    const num = Number.parseInt(part, 10);
    if (num > 255) return false;
  }
  return true;
}

/**
 * Check if a string is a valid IPv6 address
 */
function isValidIpv6(ip: string): boolean {
  const groups = ip.split(':');
  if (groups.length < 3 || groups.length > 8) return false;
  for (const group of groups) {
    if (group.length > 4) return false;
    for (const ch of group) {
      const c = ch.charCodeAt(0);
      const isDigit = c >= 48 && c <= 57;
      const isLowerHex = c >= 97 && c <= 102;
      const isUpperHex = c >= 65 && c <= 70;
      if (!(isDigit || isLowerHex || isUpperHex)) return false;
    }
  }
  return true;
}

/**
 * Validate IP address format (IPv4 or IPv6)
 */
export function validateIpAddress(ip: string | null): boolean {
  if (!ip) return true; // Nullable field
  return isValidIpv4(ip) || isValidIpv6(ip);
}

// =============================================================================
// Session State Management
// =============================================================================

/**
 * Create session insert data with computed fields
 */
export function createSessionInsert(
  userId: string,
  tokenHash: string,
  options?: {
    persistent?: boolean;
    userAgent?: string | null;
    ipAddress?: string | null;
    id?: string;
  },
): Omit<Session, 'id'> & { id?: string } {
  const now = new Date();
  const persistent = options?.persistent ?? false;

  return {
    id: options?.id,
    schemaVersion: String(SESSION_SCHEMA_VERSION),
    userId,
    tokenHash,
    expiresAt: calculateExpiresAt(persistent, now),
    userAgent: options?.userAgent ?? null,
    ipAddress: options?.ipAddress ?? null,
    persistent,
    lastActivityAt: now,
    createdAt: now,
  };
}

/**
 * Update session activity timestamp
 */
export function updateSessionActivity(): Partial<Session> {
  return {
    lastActivityAt: new Date(),
  };
}

// =============================================================================
// Extended Views with Computed Fields
// =============================================================================

/**
 * Session with computed fields for UI display
 */
export interface SessionWithComputed extends Session {
  _computed: {
    isExpired: boolean;
    isValid: boolean;
    timeRemaining: number;
    age: number;
    isNearExpiration: boolean;
    needsRefresh: boolean;
    durationMs: number;
  };
}

/**
 * Convert session to format with computed fields
 */
export function sessionToHuman(session: Session): SessionWithComputed {
  return {
    ...session,
    _computed: {
      isExpired: isSessionExpired(session),
      isValid: isSessionValid(session),
      timeRemaining: getSessionTimeRemaining(session),
      age: getSessionAge(session),
      isNearExpiration: isSessionNearExpiration(session),
      needsRefresh: isSessionNearExpiration(session, 120), // < 2 hours
      durationMs: calculateSessionDuration(session.persistent ?? false),
    },
  };
}

/**
 * Session with metadata for agent/API consumption
 */
export interface SessionAgent extends Session {
  metadata: {
    expired: boolean;
    valid: boolean;
    timeRemainingMs: number;
    ageMs: number;
    nearExpiration: boolean;
    type: 'persistent' | 'regular';
  };
}

/**
 * Convert session to agent-compatible format
 */
export function sessionToAgent(session: Session): SessionAgent {
  return {
    ...session,
    metadata: {
      expired: isSessionExpired(session),
      valid: isSessionValid(session),
      timeRemainingMs: getSessionTimeRemaining(session),
      ageMs: getSessionAge(session),
      nearExpiration: isSessionNearExpiration(session),
      type: session.persistent ? 'persistent' : 'regular',
    },
  };
}

/**
 * Zod schema for session with computed fields
 */
export const SessionWithComputedSchema = SessionSchema.and(
  z.object({
    _computed: z.object({
      isExpired: z.boolean(),
      isValid: z.boolean(),
      timeRemaining: z.number(),
      age: z.number(),
      isNearExpiration: z.boolean(),
      needsRefresh: z.boolean(),
      durationMs: z.number(),
    }),
  }),
);

/**
 * Zod schema for session with agent metadata
 */
export const SessionAgentSchema = SessionSchema.and(
  z.object({
    metadata: z.object({
      expired: z.boolean(),
      valid: z.boolean(),
      timeRemainingMs: z.number(),
      ageMs: z.number(),
      nearExpiration: z.boolean(),
      type: z.enum(['persistent', 'regular']),
    }),
  }),
);
