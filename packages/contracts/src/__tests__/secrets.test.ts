import { describe, expect, it } from 'vitest';
import {
  createRotationEvent,
  createSecretAuditEvent,
  isSecretPath,
  parseSecretPath,
  RotationEventContract,
  RotationEventSchema,
  RotationReasonSchema,
  SECRETS_SCHEMA_VERSION,
  SecretActorSchema,
  SecretActorTypeSchema,
  SecretAuditEventContract,
  SecretAuditEventSchema,
  SecretAuditEventTypeSchema,
  SecretPathSchema,
} from '../secrets/index.js';

const VALID_HASH_A = 'a'.repeat(64);
const VALID_HASH_B = 'b'.repeat(64);

describe('Secret Schemas', () => {
  describe('Constants', () => {
    it('exports schema version', () => {
      expect(SECRETS_SCHEMA_VERSION).toBe(1);
    });
  });

  describe('SecretPathSchema', () => {
    it('accepts the canonical 4-segment path', () => {
      expect(SecretPathSchema.safeParse('revealui/prod/stripe/secret-key').success).toBe(true);
    });

    it('accepts a 3-segment path', () => {
      expect(SecretPathSchema.safeParse('revealui/dev/admin-session-cookie').success).toBe(true);
    });

    it('accepts a 2-segment path', () => {
      expect(SecretPathSchema.safeParse('revdev/license-signing-key').success).toBe(true);
    });

    it('accepts a path with a file extension on the final segment', () => {
      expect(SecretPathSchema.safeParse('keystore/signing-key.json').success).toBe(true);
    });

    it('accepts deep credential paths', () => {
      expect(SecretPathSchema.safeParse('credentials/github/anthropic-api-key').success).toBe(true);
    });

    it('rejects single-segment paths', () => {
      expect(SecretPathSchema.safeParse('revealui').success).toBe(false);
    });

    it('rejects leading slash', () => {
      expect(SecretPathSchema.safeParse('/revealui/prod/stripe/secret-key').success).toBe(false);
    });

    it('rejects trailing slash', () => {
      expect(SecretPathSchema.safeParse('revealui/prod/stripe/secret-key/').success).toBe(false);
    });

    it('rejects consecutive slashes', () => {
      expect(SecretPathSchema.safeParse('revealui//prod/stripe/secret-key').success).toBe(false);
    });

    it('rejects uppercase segments', () => {
      expect(SecretPathSchema.safeParse('revealui/Prod/stripe/secret-key').success).toBe(false);
    });

    it('rejects underscores in segments', () => {
      expect(SecretPathSchema.safeParse('revealui/prod/stripe/secret_key').success).toBe(false);
    });

    it('rejects segments starting with a digit', () => {
      expect(SecretPathSchema.safeParse('revealui/prod/1stripe/secret-key').success).toBe(false);
    });

    it('rejects whitespace', () => {
      expect(SecretPathSchema.safeParse('revealui/prod/stripe /secret-key').success).toBe(false);
    });

    it('rejects empty string', () => {
      expect(SecretPathSchema.safeParse('').success).toBe(false);
    });

    it('rejects paths over 200 chars', () => {
      const tooLong = `revealui/prod/${'x'.repeat(190)}/key`;
      expect(SecretPathSchema.safeParse(tooLong).success).toBe(false);
    });
  });

  describe('parseSecretPath', () => {
    it('splits a 4-segment path into project / subsystems / name', () => {
      const parsed = parseSecretPath('revealui/prod/stripe/secret-key');
      expect(parsed.project).toBe('revealui');
      expect(parsed.subsystems).toEqual(['prod', 'stripe']);
      expect(parsed.name).toBe('secret-key');
    });

    it('splits a 2-segment path with empty subsystems', () => {
      const parsed = parseSecretPath('revdev/license-signing-key');
      expect(parsed.project).toBe('revdev');
      expect(parsed.subsystems).toEqual([]);
      expect(parsed.name).toBe('license-signing-key');
    });

    it('preserves the file extension on the name', () => {
      const parsed = parseSecretPath('keystore/signing-key.json');
      expect(parsed.project).toBe('keystore');
      expect(parsed.subsystems).toEqual([]);
      expect(parsed.name).toBe('signing-key.json');
    });

    it('throws on invalid input', () => {
      expect(() => parseSecretPath('not a path')).toThrow();
    });
  });

  describe('isSecretPath', () => {
    it('returns true for valid paths', () => {
      expect(isSecretPath('revealui/prod/stripe/secret-key')).toBe(true);
    });

    it('returns false for invalid input', () => {
      expect(isSecretPath('not a path')).toBe(false);
      expect(isSecretPath(42)).toBe(false);
      expect(isSecretPath(null)).toBe(false);
      expect(isSecretPath(undefined)).toBe(false);
    });
  });

  describe('SecretActorSchema', () => {
    it('accepts each actor type', () => {
      for (const type of ['user', 'agent', 'system'] as const) {
        const actor = { type, id: `${type}-1`, label: `${type} actor` };
        expect(SecretActorSchema.safeParse(actor).success).toBe(true);
      }
    });

    it('makes label optional', () => {
      expect(SecretActorSchema.safeParse({ type: 'user', id: 'u-1' }).success).toBe(true);
    });

    it('rejects unknown actor types', () => {
      expect(SecretActorSchema.safeParse({ type: 'robot', id: 'r-1' }).success).toBe(false);
    });

    it('rejects missing id', () => {
      expect(SecretActorSchema.safeParse({ type: 'user' }).success).toBe(false);
    });
  });

  describe('SecretActorTypeSchema', () => {
    it('exposes the canonical 3-value enum', () => {
      expect(SecretActorTypeSchema.safeParse('user').success).toBe(true);
      expect(SecretActorTypeSchema.safeParse('agent').success).toBe(true);
      expect(SecretActorTypeSchema.safeParse('system').success).toBe(true);
      expect(SecretActorTypeSchema.safeParse('robot').success).toBe(false);
    });
  });

  describe('RotationReasonSchema', () => {
    it('accepts each reason value', () => {
      for (const reason of [
        'scheduled',
        'manual',
        'breach',
        'compromise',
        'key-loss',
        'unknown',
      ] as const) {
        expect(RotationReasonSchema.safeParse(reason).success).toBe(true);
      }
    });

    it('rejects unknown reasons', () => {
      expect(RotationReasonSchema.safeParse('whim').success).toBe(false);
    });
  });

  describe('RotationEventSchema', () => {
    const baseEvent = {
      id: 'rot-1',
      version: SECRETS_SCHEMA_VERSION,
      path: 'revealui/prod/stripe/secret-key',
      previousHash: VALID_HASH_A,
      newHash: VALID_HASH_B,
      reason: 'scheduled' as const,
      actor: { type: 'system' as const, id: 'rotator' },
      rotatedAt: new Date().toISOString(),
    };

    it('validates a complete rotation event', () => {
      expect(RotationEventSchema.safeParse(baseEvent).success).toBe(true);
    });

    it('allows omitting previousHash for the first creation', () => {
      const { previousHash: _omitted, ...withoutPrev } = baseEvent;
      expect(RotationEventSchema.safeParse(withoutPrev).success).toBe(true);
    });

    it('rejects a non-SHA-256 newHash', () => {
      const invalid = { ...baseEvent, newHash: 'short-hash' };
      expect(RotationEventSchema.safeParse(invalid).success).toBe(false);
    });

    it('rejects uppercase hex in hashes', () => {
      const invalid = { ...baseEvent, newHash: 'A'.repeat(64) };
      expect(RotationEventSchema.safeParse(invalid).success).toBe(false);
    });

    it('rejects an invalid path', () => {
      const invalid = { ...baseEvent, path: 'not a path' };
      expect(RotationEventSchema.safeParse(invalid).success).toBe(false);
    });

    it('rejects notes longer than 2000 chars', () => {
      const invalid = { ...baseEvent, notes: 'x'.repeat(2001) };
      expect(RotationEventSchema.safeParse(invalid).success).toBe(false);
    });

    it('exposes a contract object', () => {
      expect(RotationEventContract.metadata.name).toBe('RotationEvent');
      expect(RotationEventContract.metadata.version).toBe('1');
    });
  });

  describe('createRotationEvent', () => {
    it('builds a valid rotation event with the current timestamp', () => {
      const event = createRotationEvent({
        id: 'rot-2',
        path: 'revealui/prod/stripe/secret-key',
        previousHash: VALID_HASH_A,
        newHash: VALID_HASH_B,
        reason: 'manual',
        actor: { type: 'user', id: 'u-1' },
        notes: 'rotated after vendor advisory',
      });

      expect(event.id).toBe('rot-2');
      expect(event.version).toBe(SECRETS_SCHEMA_VERSION);
      expect(event.previousHash).toBe(VALID_HASH_A);
      expect(event.newHash).toBe(VALID_HASH_B);
      expect(event.reason).toBe('manual');
      expect(event.notes).toBe('rotated after vendor advisory');
      expect(() => new Date(event.rotatedAt)).not.toThrow();
    });

    it('throws when constructed with an invalid hash', () => {
      expect(() =>
        createRotationEvent({
          id: 'rot-3',
          path: 'revealui/prod/stripe/secret-key',
          newHash: 'too-short',
          reason: 'scheduled',
          actor: { type: 'system', id: 'rotator' },
        }),
      ).toThrow();
    });
  });

  describe('SecretAuditEventTypeSchema', () => {
    it('accepts each event type', () => {
      for (const type of [
        'read',
        'write',
        'update',
        'rotate',
        'delete',
        'access-denied',
        'list',
      ] as const) {
        expect(SecretAuditEventTypeSchema.safeParse(type).success).toBe(true);
      }
    });

    it('rejects unknown event types', () => {
      expect(SecretAuditEventTypeSchema.safeParse('shred').success).toBe(false);
    });
  });

  describe('SecretAuditEventSchema', () => {
    const baseEvent = {
      id: 'audit-1',
      version: SECRETS_SCHEMA_VERSION,
      path: 'revealui/prod/stripe/secret-key',
      type: 'read' as const,
      actor: { type: 'agent' as const, id: 'agent-coordinator' },
      success: true,
      timestamp: new Date().toISOString(),
    };

    it('validates a complete audit event', () => {
      expect(SecretAuditEventSchema.safeParse(baseEvent).success).toBe(true);
    });

    it('accepts the wildcard path on list operations', () => {
      const event = { ...baseEvent, path: '*', type: 'list' as const };
      expect(SecretAuditEventSchema.safeParse(event).success).toBe(true);
    });

    it('accepts an error message on failure', () => {
      const event = { ...baseEvent, success: false, error: 'access denied by policy' };
      expect(SecretAuditEventSchema.safeParse(event).success).toBe(true);
    });

    it('accepts primitive context values', () => {
      const event = {
        ...baseEvent,
        context: { component: 'tauri-frontend', requestId: 42, sensitive: false },
      };
      expect(SecretAuditEventSchema.safeParse(event).success).toBe(true);
    });

    it('rejects context with nested objects', () => {
      const event = {
        ...baseEvent,
        context: { meta: { component: 'x' } },
      };
      expect(SecretAuditEventSchema.safeParse(event).success).toBe(false);
    });

    it('rejects an invalid path', () => {
      const event = { ...baseEvent, path: 'not a path' };
      expect(SecretAuditEventSchema.safeParse(event).success).toBe(false);
    });

    it('rejects an invalid event type', () => {
      const event = { ...baseEvent, type: 'shred' };
      expect(SecretAuditEventSchema.safeParse(event).success).toBe(false);
    });

    it('rejects error messages over 2000 chars', () => {
      const event = { ...baseEvent, success: false, error: 'x'.repeat(2001) };
      expect(SecretAuditEventSchema.safeParse(event).success).toBe(false);
    });

    it('exposes a contract object', () => {
      expect(SecretAuditEventContract.metadata.name).toBe('SecretAuditEvent');
      expect(SecretAuditEventContract.metadata.version).toBe('1');
    });
  });

  describe('createSecretAuditEvent', () => {
    it('builds a valid audit event with the current timestamp', () => {
      const event = createSecretAuditEvent({
        id: 'audit-2',
        path: 'revealui/prod/stripe/secret-key',
        type: 'rotate',
        actor: { type: 'user', id: 'u-1' },
        success: true,
      });

      expect(event.id).toBe('audit-2');
      expect(event.version).toBe(SECRETS_SCHEMA_VERSION);
      expect(event.type).toBe('rotate');
      expect(event.success).toBe(true);
      expect(() => new Date(event.timestamp)).not.toThrow();
    });

    it('builds a list event with the wildcard path', () => {
      const event = createSecretAuditEvent({
        id: 'audit-3',
        path: '*',
        type: 'list',
        actor: { type: 'system', id: 'sweep' },
        success: true,
        context: { component: 'rotation-due-check' },
      });

      expect(event.path).toBe('*');
      expect(event.type).toBe('list');
      expect(event.context).toEqual({ component: 'rotation-due-check' });
    });

    it('throws when constructed with an invalid event type', () => {
      expect(() =>
        createSecretAuditEvent({
          id: 'audit-4',
          path: 'revealui/prod/stripe/secret-key',
          // biome-ignore lint/suspicious/noExplicitAny: deliberately invalid for the test
          type: 'shred' as any,
          actor: { type: 'system', id: 'sweep' },
          success: true,
        }),
      ).toThrow();
    });
  });
});
