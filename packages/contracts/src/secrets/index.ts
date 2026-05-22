/**
 * Secret Schemas
 *
 * Zod contracts for revvault path conventions, rotation events, and audit
 * log entries.
 *
 * Used by the revvault Tauri frontend to validate IPC payloads crossing
 * the TS↔Rust boundary, and by any TypeScript service that reads or
 * writes via the revvault CLI / daemon API.
 *
 * SECURITY: rotation and audit events MUST NOT carry secret values.
 * Hashes are SHA-256 hex digests; the `path` field is identifying
 * metadata only. Consumers that need the value go through revvault's
 * tmpfs-backed restore directory, which is zeroized on command exit.
 */

import { z } from 'zod/v4';
import { createContract } from '../foundation/contract.js';

// =============================================================================
// Schema Versions
// =============================================================================

export const SECRETS_SCHEMA_VERSION = 1;

// =============================================================================
// Secret Path
// =============================================================================

/**
 * Revvault path convention.
 *
 * Forward-slash separated, lower-kebab segments. Each segment matches
 * `[a-z][a-z0-9-]*`. The final segment may end in a file extension
 * `.<ext>` (typical for keypairs: `revealui/prod/keys/signing-key.json`).
 *
 * Minimum 2 segments; no fixed maximum (revvault doesn't enforce one).
 *
 * Examples (canonical paths from `~/.claude/rules/secrets.md`):
 * - `revealui/dev/electric/service-url`
 * - `revealui/prod/stripe/secret-key`
 * - `revealui/prod/keys/signing-key.json`
 * - `revdev/license-signing-key`
 * - `credentials/github/anthropic-api-key`
 */
export const SecretPathSchema = z
  .string()
  .min(3)
  .max(200)
  .regex(/^[a-z][a-z0-9-]*(?:\/[a-z][a-z0-9-]*)+(?:\.[a-z]+)?$/, {
    message:
      'Secret path must be 2+ lower-kebab segments separated by /, e.g. "revealui/prod/stripe/secret-key" or "revealui/prod/keys/signing-key.json"',
  });

export type SecretPath = z.infer<typeof SecretPathSchema>;

/**
 * Splits a secret path into its segments.
 * Throws if the path does not match `SecretPathSchema`.
 */
export function parseSecretPath(path: string): {
  project: string;
  subsystems: string[];
  name: string;
} {
  const validated = SecretPathSchema.parse(path);
  const segments = validated.split('/');
  const project = segments[0] as string;
  const name = segments[segments.length - 1] as string;
  const subsystems = segments.slice(1, -1);
  return { project, subsystems, name };
}

/**
 * Type guard for secret paths. Useful in narrow-after-validate flows
 * where calling `.parse()` would throw on invalid input.
 */
export function isSecretPath(value: unknown): value is SecretPath {
  return SecretPathSchema.safeParse(value).success;
}

// =============================================================================
// Secret Actor (who took the action)
// =============================================================================

export const SecretActorTypeSchema = z.enum(['user', 'agent', 'system']);
export type SecretActorType = z.infer<typeof SecretActorTypeSchema>;

export const SecretActorSchema = z.object({
  /** Whether the actor is a human user, an AI agent, or a system component */
  type: SecretActorTypeSchema,

  /** Identifier of the actor (user ID, agent ID, system component name) */
  id: z.string().min(1).max(200),

  /** Optional human-readable label */
  label: z.string().min(1).max(200).optional(),
});
export type SecretActor = z.infer<typeof SecretActorSchema>;

// =============================================================================
// Rotation Event
// =============================================================================

export const RotationReasonSchema = z.enum([
  /** Routine rotation per policy interval */
  'scheduled',
  /** Operator-initiated rotation */
  'manual',
  /** Confirmed compromise */
  'breach',
  /** Suspected compromise */
  'compromise',
  /** Key material lost or unrecoverable */
  'key-loss',
  /** Reason not captured */
  'unknown',
]);
export type RotationReason = z.infer<typeof RotationReasonSchema>;

const Sha256HexSchema = z.string().regex(/^[a-f0-9]{64}$/, {
  message: 'Expected a 64-character lowercase SHA-256 hex digest',
});

/**
 * Records that a secret's value changed.
 *
 * SECURITY: rotation events MUST NOT contain the secret value. Hashes
 * are SHA-256 hex digests; consumers must treat them as opaque
 * identifiers, not as recoverable values.
 */
export const RotationEventSchema = z.object({
  /** Event ID */
  id: z.string().min(1).max(200),

  /** Schema version */
  version: z.number().int().default(SECRETS_SCHEMA_VERSION),

  /** Path of the rotated secret */
  path: SecretPathSchema,

  /** SHA-256 hex digest of the previous value (omitted on first creation) */
  previousHash: Sha256HexSchema.optional(),

  /** SHA-256 hex digest of the new value */
  newHash: Sha256HexSchema,

  /** Why the rotation happened */
  reason: RotationReasonSchema,

  /** Who performed the rotation */
  actor: SecretActorSchema,

  /** When the rotation completed */
  rotatedAt: z.string().datetime(),

  /** Optional notes (no secret values allowed; max 2000 chars) */
  notes: z.string().max(2000).optional(),
});
export type RotationEvent = z.infer<typeof RotationEventSchema>;

export const RotationEventContract = createContract({
  name: 'RotationEvent',
  version: '1',
  description: 'Records a secret rotation event without exposing the value',
  schema: RotationEventSchema,
});

// =============================================================================
// Secret Audit Event
// =============================================================================

export const SecretAuditEventTypeSchema = z.enum([
  /** Secret value retrieved */
  'read',
  /** New secret created */
  'write',
  /** Existing secret value replaced */
  'update',
  /** Rotation (typically followed by a separate RotationEvent) */
  'rotate',
  /** Secret removed */
  'delete',
  /** Attempted access blocked by policy */
  'access-denied',
  /** Index listing (no values touched) */
  'list',
]);
export type SecretAuditEventType = z.infer<typeof SecretAuditEventTypeSchema>;

/**
 * Audit log entry for any secret operation.
 *
 * SECURITY: audit events MUST NOT contain the secret value. The `path`
 * is identifying metadata, not sensitive data. The `error` field, when
 * present, must describe failure mode without leaking the value.
 */
export const SecretAuditEventSchema = z.object({
  /** Event ID */
  id: z.string().min(1).max(200),

  /** Schema version */
  version: z.number().int().default(SECRETS_SCHEMA_VERSION),

  /**
   * Path of the affected secret. The literal `*` is allowed for
   * `list` operations (which span the whole index, not one secret).
   */
  path: z.union([SecretPathSchema, z.literal('*')]),

  /** Type of operation */
  type: SecretAuditEventTypeSchema,

  /** Who took the action */
  actor: SecretActorSchema,

  /** Whether the operation succeeded */
  success: z.boolean(),

  /** Failure reason when success=false (no secret values; max 2000 chars) */
  error: z.string().max(2000).optional(),

  /** When the event happened */
  timestamp: z.string().datetime(),

  /** Optional context (calling component, request ID, etc.) — primitives only */
  context: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});
export type SecretAuditEvent = z.infer<typeof SecretAuditEventSchema>;

export const SecretAuditEventContract = createContract({
  name: 'SecretAuditEvent',
  version: '1',
  description: 'Audit log entry for a secret operation without exposing the value',
  schema: SecretAuditEventSchema,
});

// =============================================================================
// Factory functions
// =============================================================================

/**
 * Creates a rotation event with the current timestamp.
 */
export function createRotationEvent(params: {
  id: string;
  path: string;
  previousHash?: string;
  newHash: string;
  reason: RotationReason;
  actor: SecretActor;
  notes?: string;
}): RotationEvent {
  return RotationEventSchema.parse({
    id: params.id,
    version: SECRETS_SCHEMA_VERSION,
    path: params.path,
    previousHash: params.previousHash,
    newHash: params.newHash,
    reason: params.reason,
    actor: params.actor,
    rotatedAt: new Date().toISOString(),
    notes: params.notes,
  });
}

/**
 * Creates an audit event with the current timestamp.
 */
export function createSecretAuditEvent(params: {
  id: string;
  path: string;
  type: SecretAuditEventType;
  actor: SecretActor;
  success: boolean;
  error?: string;
  context?: Record<string, string | number | boolean>;
}): SecretAuditEvent {
  return SecretAuditEventSchema.parse({
    id: params.id,
    version: SECRETS_SCHEMA_VERSION,
    path: params.path,
    type: params.type,
    actor: params.actor,
    success: params.success,
    error: params.error,
    timestamp: new Date().toISOString(),
    context: params.context,
  });
}
